// prepareOnboarding: from a draft to a complete record, or to the paths of the open answers.
// The form resolver and the server call it. Pruning is the correctness mechanism: a hidden
// answer never reaches the record.

import { missingAnswers, prune } from "../flow/engine.ts";
import { sourceTaxModules } from "../source-tax/registry.ts";
import {
	type Onboarding,
	type OnboardingDraft,
	OnboardingSchema,
} from "./schema.ts";

/** An answer that is present and wrong, with the Zod message, for example "Too long". */
export type PrepareIssue = { path: string; message: string };

export type PrepareResult =
	| { kind: "ok"; value: Onboarding }
	| { kind: "missing"; paths: string[] }
	| { kind: "invalid"; issues: PrepareIssue[] };

const ANSWERS = "sourceTax.answers";

export function prepareOnboarding(draft: OnboardingDraft): PrepareResult {
	const { firstName, lastName, nationality } = draft;
	const paths: string[] = [];
	if (firstName.trim() === "") {
		paths.push("firstName");
	}
	if (lastName.trim() === "") {
		paths.push("lastName");
	}
	if (nationality === undefined) {
		paths.push("nationality");
	}

	const base = { firstName, lastName, nationality };
	if (nationality === undefined) {
		return { kind: "missing", paths };
	}
	if (nationality === "CH") {
		return finish(base, paths);
	}

	const zurich = sourceTaxModules.ZH;
	const answers = prune(zurich.flow, draft.sourceTax?.answers ?? {});
	for (const path of missingAnswers(zurich.flow, answers)) {
		paths.push(`${ANSWERS}.${path}`);
	}
	return finish({ ...base, sourceTax: { canton: "ZH", answers } }, paths);
}

function finish(candidate: unknown, paths: string[]): PrepareResult {
	if (paths.length > 0) {
		return { kind: "missing", paths };
	}
	const parsed = OnboardingSchema.safeParse(candidate);
	if (parsed.success) {
		return { kind: "ok", value: parsed.data };
	}
	// An answer that is present but invalid, for example a name of more than 100 characters.
	return {
		kind: "invalid",
		issues: parsed.error.issues.map((issue) => ({
			path: issue.path.join("."),
			message: issue.message,
		})),
	};
}
