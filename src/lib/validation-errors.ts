// Turns the open answers of `prepareOnboarding` into the error tree of next-safe-action.
// A missing answer gets `{ _errors: ["Required"] }`. An invalid answer gets the Zod message.
// The form and the server action both use it. The type guard checks the tree at run time, so no
// cast is needed.

import type { ValidationErrors } from "next-safe-action";
import type { PrepareIssue } from "../domain/onboarding/prepare.ts";
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

/** One node at each issue path. Two issues at one path give two messages at that node. */
export function issueErrors(issues: readonly PrepareIssue[]): DraftErrors {
	const root: ErrorNode = {};
	for (const { path, message } of issues) {
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
		node._errors = [...(node._errors ?? []), message];
	}
	if (!isDraftErrors(root)) {
		throw new Error("The error tree is malformed.");
	}
	return root;
}

export function requiredErrors(paths: readonly string[]): DraftErrors {
	return issueErrors(paths.map((path) => ({ path, message: "Required" })));
}

/** The error tree of a result that is not `ok`. */
export function prepareErrors(
	result:
		| { kind: "missing"; paths: readonly string[] }
		| { kind: "invalid"; issues: readonly PrepareIssue[] },
): DraftErrors {
	switch (result.kind) {
		case "missing":
			return requiredErrors(result.paths);
		case "invalid":
			return issueErrors(result.issues);
		default: {
			const unreachable: never = result;
			return unreachable;
		}
	}
}
