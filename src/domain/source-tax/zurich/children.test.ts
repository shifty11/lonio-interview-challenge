import { describe, expect, test } from "bun:test";
import { childResultMarried, childResultUnmarried } from "./children.ts";
import { MarriedChildSchema, UnmarriedChildSchema } from "./schema.ts";

const JS = "sources/zh/calculator/main.pretty.js";

type UnmarriedCase = {
	source: string;
	child: Record<string, unknown>;
	justifiesH: boolean;
	counts: boolean;
};

const underage = { group: "underage" } as const;
const firstEducation = { group: "firstEducation" } as const;

// source: calculator-spec.md § 4.2 (getResultForUnmarriedPeople, main.pretty.js:16278-16428)
const unmarried: UnmarriedCase[] = [
	{
		source: `§ 4.2 row 1, ${JS}:16306`,
		child: {
			...underage,
			childInSameHousehold: true,
			sharedCustody: true,
			sameHousehold: true,
			mainFinancialContributor: "person",
		},
		justifiesH: true,
		counts: true,
	},
	{
		source: `§ 4.2 row 2, ${JS}:16312`,
		child: {
			...underage,
			childInSameHousehold: true,
			sharedCustody: true,
			sameHousehold: true,
			mainFinancialContributor: "otherParent",
		},
		justifiesH: false,
		counts: false,
	},
	{
		source: `§ 4.2 row 3, ${JS}:16326`,
		child: {
			...underage,
			childInSameHousehold: true,
			sharedCustody: true,
			sameHousehold: false,
			alternatingCustody: true,
			mainFinancialContributor: "person",
		},
		justifiesH: true,
		counts: true,
	},
	{
		source: `§ 4.2 row 4, ${JS}:16332`,
		child: {
			...underage,
			childInSameHousehold: true,
			sharedCustody: true,
			sameHousehold: false,
			alternatingCustody: true,
			mainFinancialContributor: "otherParent",
		},
		justifiesH: false,
		counts: false,
	},
	{
		source: `§ 4.2 row 5, ${JS}:16340`,
		child: {
			...underage,
			childInSameHousehold: true,
			sharedCustody: true,
			sameHousehold: false,
			alternatingCustody: false,
		},
		justifiesH: true,
		counts: true,
	},
	{
		source: `§ 4.2 row 6, ${JS}:16344`,
		child: { ...underage, childInSameHousehold: true, sharedCustody: false },
		justifiesH: true,
		counts: true,
	},
	{
		source: `§ 4.2 row 7, ${JS}:16359`,
		child: {
			...underage,
			childInSameHousehold: false,
			parentalCare: true,
			alternatingCustody: true,
			mainFinancialContributor: "person",
		},
		justifiesH: true,
		counts: true,
	},
	{
		source: `§ 4.2 row 8, ${JS}:16365`,
		child: {
			...underage,
			childInSameHousehold: false,
			parentalCare: true,
			alternatingCustody: true,
			mainFinancialContributor: "otherParent",
		},
		justifiesH: false,
		counts: false,
	},
	{
		source: `§ 4.2 row 9, ${JS}:16370`,
		child: {
			...underage,
			childInSameHousehold: false,
			parentalCare: true,
			alternatingCustody: false,
		},
		justifiesH: false,
		counts: false,
	},
	{
		source: `§ 4.2 row 10, ${JS}:16374`,
		child: { ...underage, childInSameHousehold: false, parentalCare: false },
		justifiesH: false,
		counts: false,
	},
	{
		source: `§ 4.2 row 11, ${JS}:16389`,
		child: {
			...firstEducation,
			childInSameHousehold: true,
			sameHousehold: true,
			mainFinancialContributor: "person",
		},
		justifiesH: true,
		counts: true,
	},
	{
		source: `§ 4.2 row 12, ${JS}:16395`,
		child: {
			...firstEducation,
			childInSameHousehold: true,
			sameHousehold: true,
			mainFinancialContributor: "otherParent",
		},
		justifiesH: false,
		counts: false,
	},
	{
		source: `§ 4.2 row 13, ${JS}:16404`,
		child: {
			...firstEducation,
			childInSameHousehold: true,
			sameHousehold: false,
			financiallySupported: true,
		},
		justifiesH: true,
		counts: true,
	},
	{
		source: `§ 4.2 row 14, ${JS}:16407`,
		child: {
			...firstEducation,
			childInSameHousehold: true,
			sameHousehold: false,
			financiallySupported: false,
		},
		justifiesH: false,
		counts: false,
	},
	{
		source: `§ 4.2 row 15, ${JS}:16416 (counts, but no H)`,
		child: {
			...firstEducation,
			childInSameHousehold: false,
			financiallySupported: true,
		},
		justifiesH: false,
		counts: true,
	},
	{
		source: `§ 4.2 row 16, ${JS}:16419`,
		child: {
			...firstEducation,
			childInSameHousehold: false,
			financiallySupported: false,
		},
		justifiesH: false,
		counts: false,
	},
	{
		source: `§ 4.2 row 17, ${JS}:16424`,
		child: { group: "other" },
		justifiesH: false,
		counts: false,
	},
];

type MarriedCase = {
	source: string;
	child: Record<string, unknown>;
	counts: boolean;
};

// source: calculator-spec.md § 4.3 (getResultForMarriedPeople, main.pretty.js:16152-16277)
const married: MarriedCase[] = [
	{
		source: `§ 4.3 row 1, ${JS}:16175`,
		child: {
			...underage,
			childInSameHousehold: true,
			sharedCustody: true,
			sameHousehold: true,
		},
		counts: true,
	},
	{
		source: `§ 4.3 row 2, ${JS}:16187`,
		child: {
			...underage,
			childInSameHousehold: true,
			sharedCustody: true,
			sameHousehold: false,
			alternatingCustody: true,
			mainFinancialContributor: "person",
		},
		counts: true,
	},
	{
		source: `§ 4.3 row 3, ${JS}:16193`,
		child: {
			...underage,
			childInSameHousehold: true,
			sharedCustody: true,
			sameHousehold: false,
			alternatingCustody: true,
			mainFinancialContributor: "otherParent",
		},
		counts: false,
	},
	{
		source: `§ 4.3 row 4, ${JS}:16201 (not married: yes)`,
		child: {
			...underage,
			childInSameHousehold: true,
			sharedCustody: true,
			sameHousehold: false,
			alternatingCustody: false,
		},
		counts: false,
	},
	{
		source: `§ 4.3 row 5, ${JS}:16205`,
		child: { ...underage, childInSameHousehold: true, sharedCustody: false },
		counts: true,
	},
	{
		source: `§ 4.3 row 6, ${JS}:16220`,
		child: {
			...underage,
			childInSameHousehold: false,
			sharedCustody: true,
			alternatingCustody: true,
			mainFinancialContributor: "person",
		},
		counts: true,
	},
	{
		source: `§ 4.3 row 7, ${JS}:16226`,
		child: {
			...underage,
			childInSameHousehold: false,
			sharedCustody: true,
			alternatingCustody: true,
			mainFinancialContributor: "otherParent",
		},
		counts: false,
	},
	{
		source: `§ 4.3 row 8, ${JS}:16231`,
		child: {
			...underage,
			childInSameHousehold: false,
			sharedCustody: true,
			alternatingCustody: false,
		},
		counts: false,
	},
	{
		source: `§ 4.3 row 9, ${JS}:16235`,
		child: { ...underage, childInSameHousehold: false, sharedCustody: false },
		counts: false,
	},
	{
		source: `§ 4.3 row 10, ${JS}:16246 (no main contributor question)`,
		child: {
			...firstEducation,
			childInSameHousehold: true,
			sameHousehold: true,
		},
		counts: true,
	},
	{
		source: `§ 4.3 row 11, ${JS}:16253`,
		child: {
			...firstEducation,
			childInSameHousehold: true,
			sameHousehold: false,
			financiallySupported: true,
		},
		counts: true,
	},
	{
		source: `§ 4.3 row 12, ${JS}:16256`,
		child: {
			...firstEducation,
			childInSameHousehold: true,
			sameHousehold: false,
			financiallySupported: false,
		},
		counts: false,
	},
	{
		source: `§ 4.3 row 13, ${JS}:16265`,
		child: {
			...firstEducation,
			childInSameHousehold: false,
			financiallySupported: true,
		},
		counts: true,
	},
	{
		source: `§ 4.3 row 14, ${JS}:16268`,
		child: {
			...firstEducation,
			childInSameHousehold: false,
			financiallySupported: false,
		},
		counts: false,
	},
	{
		source: `§ 4.3 row 15, ${JS}:16273`,
		child: { group: "other" },
		counts: false,
	},
];

describe("childResultUnmarried", () => {
	for (const c of unmarried) {
		test(c.source, () => {
			const child = UnmarriedChildSchema.parse(c.child);
			expect(childResultUnmarried(child)).toEqual({
				justifiesH: c.justifiesH,
				counts: c.counts,
			});
		});
	}
});

describe("childResultMarried", () => {
	for (const c of married) {
		test(c.source, () => {
			const child = MarriedChildSchema.parse(c.child);
			expect(childResultMarried(child)).toEqual({ counts: c.counts });
		});
	}
});
