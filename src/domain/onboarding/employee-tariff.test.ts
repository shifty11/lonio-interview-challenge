// Source: spec.md § 5 and § 8; calc-spec § 9 (#1, #14).

import { describe, expect, test } from "bun:test";
import { employeeTariff } from "./employee-tariff.ts";
import { OnboardingSchema } from "./schema.ts";

describe("employeeTariff", () => {
	test("CH gives swiss", () => {
		const employee = OnboardingSchema.parse({
			firstName: "Anna",
			lastName: "Muster",
			nationality: "CH",
		});
		expect(employeeTariff(employee)).toEqual({ kind: "swiss" });
	});

	test("a source-taxed employee gets a code (calc-spec § 9 #1)", () => {
		const employee = OnboardingSchema.parse({
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
		expect(employeeTariff(employee)).toEqual({
			kind: "code",
			code: "A0N",
			remark: null,
		});
	});

	test("Liechtenstein with a daily return gives noSourceTax (calc-spec § 9 #14)", () => {
		const employee = OnboardingSchema.parse({
			firstName: "Mia",
			lastName: "Beck",
			nationality: "LI",
			sourceTax: {
				canton: "ZH",
				answers: {
					incomeType: "replacement",
					residence: {
						residenceInSwitzerland: false,
						countryOfResidence: "LI",
						dailyReturnToLiechtenstein: true,
					},
				},
			},
		});
		expect(employeeTariff(employee)).toEqual({
			kind: "noSourceTax",
			text: "No source tax in principle",
			remark: "Subject to the double taxation agreement",
		});
	});
});
