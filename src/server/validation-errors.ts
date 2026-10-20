// Turns the missing paths of `prepareOnboarding` into the error tree of next-safe-action.
// The tree has one `{ _errors: ["Required"] }` node at each path. The type guard checks the
// tree at run time, so no cast is needed.

import type { ValidationErrors } from "next-safe-action";
import type { OnboardingDraftSchema } from "../domain/onboarding/schema.ts";

export type DraftErrors = ValidationErrors<typeof OnboardingDraftSchema>;

type ErrorNode = { _errors?: string[]; [key: string]: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isErrorNode(value: unknown): value is ErrorNode {
	if (!isRecord(value)) {
		return false;
	}
	return Object.entries(value).every(([key, child]) =>
		key === "_errors"
			? Array.isArray(child) && child.every((e) => typeof e === "string")
			: isErrorNode(child),
	);
}

function isDraftErrors(value: unknown): value is DraftErrors {
	return isErrorNode(value);
}

export function requiredErrors(paths: readonly string[]): DraftErrors {
	const root: ErrorNode = {};
	for (const path of paths) {
		let node = root;
		for (const segment of path.split(".")) {
			const next = node[segment];
			if (isErrorNode(next)) {
				node = next;
			} else {
				const created: ErrorNode = {};
				node[segment] = created;
				node = created;
			}
		}
		node._errors = ["Required"];
	}
	if (!isDraftErrors(root)) {
		throw new Error("The error tree is malformed.");
	}
	return root;
}
