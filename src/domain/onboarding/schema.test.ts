// Source: spec.md § 5 and § 8.

import { describe, expect, test } from "bun:test";
import { COUNTRY_CODES, countryName, Nationality } from "./countries.ts";
import { OnboardingSchema } from "./schema.ts";

const swissAnswers = {
	incomeType: "replacement",
	residence: { residenceInSwitzerland: true },
} as const;

const swiss = { firstName: "Anna", lastName: "Muster", nationality: "CH" };
const italian = {
	firstName: "Luca",
	lastName: "Rossi",
	nationality: "IT",
	sourceTax: { canton: "ZH", answers: swissAnswers },
};

describe("OnboardingSchema", () => {
	test("accepts the CH branch (no sourceTax)", () => {
		expect(OnboardingSchema.safeParse(swiss).success).toBe(true);
	});

	test("accepts the non-CH branch with ZH answers", () => {
		expect(OnboardingSchema.safeParse(italian).success).toBe(true);
	});

	test("trims the names", () => {
		const parsed = OnboardingSchema.parse({ ...swiss, firstName: "  Anna " });
		expect(parsed.firstName).toBe("Anna");
	});

	const rejected: { name: string; source: string; input: unknown }[] = [
		{
			name: "CH with sourceTax",
			source: "spec.md § 5 (CH has no sourceTax)",
			input: { ...swiss, sourceTax: italian.sourceTax },
		},
		{
			name: "non-CH without sourceTax",
			source: "spec.md § 5 (non-CH has sourceTax)",
			input: { ...italian, sourceTax: undefined },
		},
		{
			name: "extra tariffCode key on CH",
			source: "spec.md § 5 (no tariffCode key; the dashboard computes it)",
			input: { ...swiss, tariffCode: "A0N" },
		},
		{
			name: "extra tariffCode key on non-CH",
			source: "spec.md § 5 (no tariffCode key; the dashboard computes it)",
			input: { ...italian, tariffCode: "A0N" },
		},
		{
			name: "tariffCode inside sourceTax",
			source: "spec.md § 5 (no tariffCode key; the dashboard computes it)",
			input: {
				...italian,
				sourceTax: { ...italian.sourceTax, tariffCode: "A0N" },
			},
		},
		{
			name: "empty first name",
			source: "spec.md § 5 (Name: trimmed, 1 to 100 characters)",
			input: { ...swiss, firstName: "" },
		},
		{
			name: "blank last name",
			source: "spec.md § 5 (Name: trimmed, 1 to 100 characters)",
			input: { ...swiss, lastName: "   " },
		},
		{
			name: "name longer than 100",
			source: "spec.md § 5 (Name: trimmed, 1 to 100 characters)",
			input: { ...swiss, lastName: "x".repeat(101) },
		},
		{
			name: "unknown nationality",
			source: "spec.md § 5 (Nationality: ISO 3166-1 alpha-2 list)",
			input: { ...swiss, nationality: "ZZ" },
		},
		{
			name: "lower-case nationality",
			source: "spec.md § 5 (Nationality: ISO 3166-1 alpha-2 list)",
			input: { ...swiss, nationality: "ch" },
		},
		{
			name: "missing nationality",
			source: "spec.md § 5 (Nationality is required)",
			input: { firstName: "A", lastName: "B" },
		},
		{
			name: "incomplete ZH answers",
			source: "spec.md § 5 (sourceTax.answers is ZhAnswersSchema)",
			input: { ...italian, sourceTax: { canton: "ZH", answers: {} } },
		},
		{
			name: "unknown canton",
			source: "spec.md § 5 (sourceTax.canton is a registered canton)",
			input: { ...italian, sourceTax: { canton: "BE", answers: swissAnswers } },
		},
	];
	for (const { name, source, input } of rejected) {
		test(`rejects ${name} (${source})`, () => {
			expect(OnboardingSchema.safeParse(input).success).toBe(false);
		});
	}
});

describe("countries", () => {
	test("the list has no duplicate", () => {
		expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
	});

	test("the list has the codes the app needs", () => {
		for (const code of ["CH", "DE", "LI", "XK"]) {
			expect(Nationality.safeParse(code).success, code).toBe(true);
		}
	});

	test("every code has two upper-case letters", () => {
		for (const code of COUNTRY_CODES) {
			expect(code, code).toMatch(/^[A-Z]{2}$/);
		}
	});

	test("countryName gives the English name", () => {
		expect(countryName("CH")).toBe("Switzerland");
		expect(countryName("DE")).toBe("Germany");
	});
});
