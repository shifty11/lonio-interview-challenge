// Source: spec.md § 6 and § 8 (core action with a fake repository).

import { describe, expect, test } from "bun:test";
import type {
	Onboarding,
	OnboardingDraft,
} from "../domain/onboarding/schema.ts";
import { OnboardingDraftSchema } from "../domain/onboarding/schema.ts";
import type { EmployeeRepo } from "./employees.ts";
import { submitOnboardingCore } from "./onboarding.ts";

function fakeRepo(): { repo: EmployeeRepo; created: Onboarding[] } {
	const created: Onboarding[] = [];
	const repo: EmployeeRepo = {
		async create(employee) {
			created.push(employee);
			return { id: `id-${created.length}` };
		},
		async list() {
			return [];
		},
	};
	return { repo, created };
}

const complete: OnboardingDraft = {
	firstName: "Luca",
	lastName: "Rossi",
	nationality: "IT",
	sourceTax: {
		canton: "ZH",
		answers: {
			incomeType: "earned",
			civilStatus: "single",
			churchMember: false,
			children: { hasChildren: false },
			residence: { residenceInSwitzerland: true },
		},
	},
};

describe("submitOnboardingCore", () => {
	test("a complete draft is saved (calc-spec § 9 #1)", async () => {
		const { repo, created } = fakeRepo();
		const result = await submitOnboardingCore(complete, repo);
		expect(result).toEqual({ kind: "saved", id: "id-1" });
		expect(created).toHaveLength(1);
	});

	test("an incomplete draft reports the missing paths and saves nothing", async () => {
		const { repo, created } = fakeRepo();
		const result = await submitOnboardingCore(
			{ firstName: "", lastName: "Rossi" },
			repo,
		);
		expect(result).toEqual({
			kind: "missing",
			paths: ["firstName", "nationality"],
		});
		expect(created).toHaveLength(0);
	});

	test("the repository gets the pruned answers (spec.md § 3, prune)", async () => {
		const { repo, created } = fakeRepo();
		const stale: OnboardingDraft = {
			...complete,
			sourceTax: {
				canton: "ZH",
				answers: {
					incomeType: "earned",
					civilStatus: "single",
					spouseEmployed: true,
					churchMember: false,
					children: { hasChildren: false },
					residence: { residenceInSwitzerland: true },
				},
			},
		};
		await submitOnboardingCore(stale, repo);
		expect(created[0]).toEqual({
			firstName: "Luca",
			lastName: "Rossi",
			nationality: "IT",
			sourceTax: {
				canton: "ZH",
				answers: {
					incomeType: "earned",
					civilStatus: "single",
					churchMember: false,
					children: { hasChildren: false },
					residence: { residenceInSwitzerland: true },
				},
			},
		});
	});

	test("a Swiss draft drops the source-tax block", async () => {
		const { repo, created } = fakeRepo();
		await submitOnboardingCore({ ...complete, nationality: "CH" }, repo);
		expect(created[0]).toEqual({
			firstName: "Luca",
			lastName: "Rossi",
			nationality: "CH",
		});
	});

	test("a tariff code in the input fails the draft schema (plan.md § 3)", () => {
		const parsed = OnboardingDraftSchema.safeParse({
			...complete,
			tariffCode: "A0N",
		});
		expect(parsed.success).toBe(false);
	});
});
