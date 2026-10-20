// The core of the onboarding action. It has no Next.js import, so a test can call it.
// The input is a draft. The server prunes it and parses it with the strict schema.
// A tariff code in the input fails the draft schema before this function runs.
// The code is never stored: the dashboard computes it.

import {
	type PrepareIssue,
	prepareOnboarding,
} from "../domain/onboarding/prepare.ts";
import type { OnboardingDraft } from "../domain/onboarding/schema.ts";
import type { EmployeeRepo } from "./employees.ts";

export type SubmitResult =
	| { kind: "saved"; id: string }
	| { kind: "missing"; paths: string[] }
	| { kind: "invalid"; issues: PrepareIssue[] };

export async function submitOnboardingCore(
	input: OnboardingDraft,
	repo: EmployeeRepo,
): Promise<SubmitResult> {
	const prepared = prepareOnboarding(input);
	switch (prepared.kind) {
		case "missing":
			return { kind: "missing", paths: prepared.paths };
		case "invalid":
			return { kind: "invalid", issues: prepared.issues };
		case "ok": {
			const { id } = await repo.create(prepared.value);
			return { kind: "saved", id };
		}
		default: {
			const unreachable: never = prepared;
			return unreachable;
		}
	}
}
