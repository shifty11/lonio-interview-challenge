import { describe, expect, test } from "bun:test";
import {
	MarriedChildSchema,
	UnmarriedChildSchema,
	ZhAnswersSchema,
} from "./schema.ts";
import { hChild, swiss } from "./test-fixtures.ts";

const base = { churchMember: false, residence: swiss } as const;
const single = {
	incomeType: "earned",
	civilStatus: "single",
	...base,
} as const;
const married = {
	incomeType: "earned",
	civilStatus: "married",
	spouseEmployed: false,
	...base,
} as const;

describe("ZhAnswersSchema", () => {
	// source: calculator-spec.md § 3 (question order) and § 6.1
	test("a complete single person parses", () => {
		expect(
			ZhAnswersSchema.safeParse({ ...single, children: { hasChildren: false } })
				.success,
		).toBe(true);
	});

	test("a married child on a single person fails", () => {
		// source: spec.md § 12 (schema.test.ts), calculator-spec.md § 4.1 (shared custody outside the household is a married question)
		const marriedOnly = {
			group: "underage",
			childInSameHousehold: false,
			sharedCustody: true,
			alternatingCustody: false,
		};
		expect(
			ZhAnswersSchema.safeParse({
				...single,
				children: { hasChildren: true, list: [marriedOnly] },
			}).success,
		).toBe(false);
		expect(
			ZhAnswersSchema.safeParse({
				...married,
				children: { hasChildren: true, list: [marriedOnly] },
			}).success,
		).toBe(true);
	});

	// source: calculator-spec.md § 4.1 (parental care is a question for a person who is not married)
	test("an unmarried child on a married person fails", () => {
		const unmarriedOnly = {
			group: "underage",
			childInSameHousehold: false,
			parentalCare: true,
			alternatingCustody: false,
		};
		expect(
			ZhAnswersSchema.safeParse({
				...single,
				children: { hasChildren: true, list: [unmarriedOnly] },
			}).success,
		).toBe(true);
		expect(
			ZhAnswersSchema.safeParse({
				...married,
				children: { hasChildren: true, list: [unmarriedOnly] },
			}).success,
		).toBe(false);
	});

	// source: calculator-spec.md § 7 item 1 (hidden answers are cleared), spec.md § 5.1 (strict objects)
	test("an answer off the path fails (strict)", () => {
		const noKids = { hasChildren: false } as const;
		expect(
			ZhAnswersSchema.safeParse({
				...single,
				spouseEmployed: true,
				children: noKids,
			}).success,
		).toBe(false);
		expect(
			ZhAnswersSchema.safeParse({ ...married, children: noKids, extra: 1 })
				.success,
		).toBe(false);
		expect(
			ZhAnswersSchema.safeParse({
				incomeType: "replacement",
				residence: swiss,
				churchMember: false,
			}).success,
		).toBe(false);
		expect(
			ZhAnswersSchema.safeParse({
				...single,
				children: { hasChildren: false, list: [] },
			}).success,
		).toBe(false);
		expect(
			ZhAnswersSchema.safeParse({
				...single,
				residence: { residenceInSwitzerland: true, countryOfResidence: "DE" },
				children: noKids,
			}).success,
		).toBe(false);
	});

	// source: calculator-spec.md § 6.1 (no result with an empty child list), spec.md § 5.1
	test("hasChildren true with an empty list fails", () => {
		expect(
			ZhAnswersSchema.safeParse({
				...single,
				children: { hasChildren: true, list: [] },
			}).success,
		).toBe(false);
	});

	// source: spec.md § 5.1 (`true` has `list`)
	test("hasChildren true without a list fails", () => {
		expect(
			ZhAnswersSchema.safeParse({ ...single, children: { hasChildren: true } })
				.success,
		).toBe(false);
	});

	// source: calculator-spec.md § 6.2 (all other main answers are empty)
	test("replacement income holds the residence only", () => {
		expect(
			ZhAnswersSchema.safeParse({ incomeType: "replacement", residence: swiss })
				.success,
		).toBe(true);
		expect(
			ZhAnswersSchema.safeParse({ incomeType: "replacement" }).success,
		).toBe(false);
	});

	// source: spec.md § 5.1 (enums)
	test("an unknown enum value fails", () => {
		expect(
			ZhAnswersSchema.safeParse({
				...single,
				civilStatus: "divorced",
				children: { hasChildren: false },
			}).success,
		).toBe(false);
		expect(
			UnmarriedChildSchema.safeParse({
				...hChild,
				mainFinancialContributor: "nobody",
			}).success,
		).toBe(false);
	});
});

describe("child schemas", () => {
	// source: calculator-spec.md § 4.1 and § 4.3 row 10 (a married person gets no main-contributor question)
	test("a hidden answer on a child fails (mainFinancialContributor for a married person)", () => {
		const child = {
			group: "firstEducation",
			childInSameHousehold: true,
			sameHousehold: true,
			mainFinancialContributor: "person",
		};
		expect(MarriedChildSchema.safeParse(child).success).toBe(false);
		expect(UnmarriedChildSchema.safeParse(child).success).toBe(true);
	});
});
