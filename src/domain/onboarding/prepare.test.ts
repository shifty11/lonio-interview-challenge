// Source: spec.md § 5 (`prepareOnboarding`) and § 8.

import { describe, expect, test } from "bun:test";
import { prepareOnboarding } from "./prepare.ts";
import type { OnboardingDraft } from "./schema.ts";

const A = "sourceTax.answers";

describe("prepareOnboarding", () => {
	test("CH drops sourceTax", () => {
		const draft: OnboardingDraft = {
			firstName: "Anna",
			lastName: "Muster",
			nationality: "CH",
			sourceTax: { canton: "ZH", answers: { incomeType: "earned" } },
		};
		expect(prepareOnboarding(draft)).toEqual({
			kind: "ok",
			value: { firstName: "Anna", lastName: "Muster", nationality: "CH" },
		});
	});

	test("an empty draft reports names and nationality", () => {
		expect(prepareOnboarding({ firstName: "", lastName: " " })).toEqual({
			kind: "missing",
			paths: ["firstName", "lastName", "nationality"],
		});
	});

	test("non-CH without sourceTax reports the first question in the RHF form", () => {
		expect(
			prepareOnboarding({ firstName: "A", lastName: "B", nationality: "IT" }),
		).toEqual({ kind: "missing", paths: [`${A}.incomeType`] });
	});

	test("a visible group with no child reports child 0 in the RHF form", () => {
		const result = prepareOnboarding({
			firstName: "A",
			lastName: "B",
			nationality: "IT",
			sourceTax: {
				canton: "ZH",
				answers: {
					incomeType: "earned",
					civilStatus: "single",
					churchMember: false,
					children: { hasChildren: true },
					residence: { residenceInSwitzerland: true },
				},
			},
		});
		expect(result).toEqual({
			kind: "missing",
			paths: [`${A}.children.list.0.group`],
		});
	});

	test("names and answers are reported together, in order", () => {
		const result = prepareOnboarding({
			firstName: "",
			lastName: "B",
			nationality: "IT",
			sourceTax: { canton: "ZH", answers: { incomeType: "replacement" } },
		});
		expect(result).toEqual({
			kind: "missing",
			paths: ["firstName", `${A}.residence.residenceInSwitzerland`],
		});
	});

	test("stale answers are pruned from the record", () => {
		const result = prepareOnboarding({
			firstName: " A ",
			lastName: "B",
			nationality: "IT",
			sourceTax: {
				canton: "ZH",
				answers: {
					incomeType: "replacement",
					civilStatus: "married",
					spouseEmployed: true,
					residence: { residenceInSwitzerland: true },
				},
			},
		});
		expect(result).toEqual({
			kind: "ok",
			value: {
				firstName: "A",
				lastName: "B",
				nationality: "IT",
				sourceTax: {
					canton: "ZH",
					answers: {
						incomeType: "replacement",
						residence: { residenceInSwitzerland: true },
					},
				},
			},
		});
	});

	test("a name over 100 characters is reported by path", () => {
		const result = prepareOnboarding({
			firstName: "x".repeat(101),
			lastName: "B",
			nationality: "CH",
		});
		expect(result).toEqual({ kind: "missing", paths: ["firstName"] });
	});
});
