import { describe, expect, test } from "bun:test";
import type { TariffResult } from "../types.ts";
import { TariffCode } from "./codes.ts";
import { computeTariffCode } from "./compute.ts";
import { ZhAnswersSchema } from "./schema.ts";
import {
	germanBorderCrosser,
	hChild,
	marriedSoleCustodyChild,
	noCountChild,
	otherChild,
	swiss,
} from "./test-fixtures.ts";

const NO_SOURCE_TAX = "No source tax in principle";
const DTA = "Subject to the double taxation agreement";

const germany = {
	residenceInSwitzerland: false,
	countryOfResidence: "DE",
} as const;
const liechtenstein = {
	residenceInSwitzerland: false,
	countryOfResidence: "LI",
} as const;
const noChildren = { hasChildren: false } as const;
const earnedSingle = { incomeType: "earned", civilStatus: "single" } as const;
const earnedMarried = { incomeType: "earned", civilStatus: "married" } as const;

type Expected = TariffResult;

type Case = { source: string; answers: unknown; expected: Expected };

const code = (c: string, remark: string | null = null): Expected => ({
	kind: "code",
	code: TariffCode.parse(c),
	remark,
});

const cases: Case[] = [
	// calculator-spec.md § 9 golden cases
	{
		source: "§ 9 #1",
		answers: {
			...earnedSingle,
			churchMember: false,
			children: noChildren,
			residence: swiss,
		},
		expected: code("A0N"),
	},
	{
		source: "§ 9 #2",
		answers: {
			...earnedMarried,
			churchMember: true,
			spouseEmployed: false,
			children: noChildren,
			residence: swiss,
		},
		expected: code("B0Y"),
	},
	{
		source: "§ 9 #3",
		answers: {
			...earnedMarried,
			churchMember: false,
			spouseEmployed: true,
			children: {
				hasChildren: true,
				list: [
					{
						group: "underage",
						childInSameHousehold: true,
						sharedCustody: true,
						sameHousehold: true,
					},
					{
						group: "underage",
						childInSameHousehold: true,
						sharedCustody: true,
						sameHousehold: true,
					},
				],
			},
			residence: swiss,
		},
		expected: code("C2N"),
	},
	{
		source: "§ 9 #4",
		answers: {
			...earnedSingle,
			churchMember: true,
			children: {
				hasChildren: true,
				list: [
					{
						group: "underage",
						childInSameHousehold: true,
						sharedCustody: false,
					},
				],
			},
			residence: swiss,
		},
		expected: code("H1Y"),
	},
	{
		source: "§ 9 #5",
		answers: {
			...earnedSingle,
			churchMember: false,
			children: { hasChildren: true, list: [noCountChild] },
			residence: swiss,
		},
		expected: code("A0N"),
	},
	{
		source: "§ 9 #6",
		answers: {
			...earnedSingle,
			churchMember: false,
			children: {
				hasChildren: true,
				list: [
					{
						group: "firstEducation",
						childInSameHousehold: false,
						financiallySupported: true,
					},
				],
			},
			residence: swiss,
		},
		expected: code("A1N"),
	},
	{
		source: "§ 9 #7",
		answers: {
			...earnedSingle,
			churchMember: false,
			children: {
				hasChildren: true,
				list: [{ ...hChild, mainFinancialContributor: "otherParent" }],
			},
			residence: swiss,
		},
		expected: code("A0N"),
	},
	{
		source: "§ 9 #8 (10 children, digit capped at 9)",
		answers: {
			...earnedMarried,
			churchMember: false,
			spouseEmployed: false,
			children: {
				hasChildren: true,
				list: Array.from({ length: 10 }, () => marriedSoleCustodyChild),
			},
			residence: swiss,
		},
		expected: code("B9N"),
	},
	{
		source: "§ 9 #9",
		answers: {
			...earnedMarried,
			churchMember: false,
			spouseEmployed: false,
			children: {
				hasChildren: true,
				list: [
					{
						group: "underage",
						childInSameHousehold: false,
						sharedCustody: false,
					},
				],
			},
			residence: swiss,
		},
		expected: code("B0N"),
	},
	{
		source: "§ 9 #10",
		answers: {
			...earnedSingle,
			churchMember: false,
			children: noChildren,
			residence: germanBorderCrosser,
		},
		expected: code("L0N"),
	},
	{
		source: "§ 9 #11",
		answers: {
			...earnedSingle,
			churchMember: false,
			children: noChildren,
			residence: { ...germany, dailyReturnToGermany: true, gre1Gre2: false },
		},
		expected: code("A0N"),
	},
	{
		source: "§ 9 #12",
		answers: {
			...earnedMarried,
			churchMember: true,
			spouseEmployed: true,
			children: noChildren,
			residence: {
				...germany,
				dailyReturnToGermany: false,
				dailyReturnToCountryOfResidenceReasonable: true,
				gre3: false,
			},
		},
		expected: code("N0Y"),
	},
	{
		source: "§ 9 #13",
		answers: {
			...earnedMarried,
			churchMember: true,
			spouseEmployed: true,
			children: noChildren,
			residence: {
				...germany,
				dailyReturnToGermany: false,
				dailyReturnToCountryOfResidenceReasonable: true,
				gre3: true,
			},
		},
		expected: code("C0Y"),
	},
	{
		source: "§ 9 #14",
		answers: {
			...earnedSingle,
			churchMember: false,
			children: noChildren,
			residence: { ...liechtenstein, dailyReturnToLiechtenstein: true },
		},
		expected: { kind: "noSourceTax", text: NO_SOURCE_TAX, remark: DTA },
	},
	{
		source: "§ 9 #15",
		answers: {
			...earnedSingle,
			churchMember: false,
			children: noChildren,
			residence: {
				...liechtenstein,
				dailyReturnToLiechtenstein: false,
				moreThanFortyFiveNonReturnDays: true,
			},
		},
		expected: code("A0N", DTA),
	},
	{
		source: "§ 9 #16 (the calculator shows G; the file table is G9N)",
		answers: { incomeType: "replacement", residence: swiss },
		expected: code("G9N"),
	},
	{
		source: "§ 9 #17 (the calculator shows Q; the file table is Q9N)",
		answers: { incomeType: "replacement", residence: germanBorderCrosser },
		expected: code("Q9N"),
	},
	// calculator-spec.md § 8 built-in examples
	{
		source: "§ 8 example H3N",
		answers: {
			...earnedSingle,
			churchMember: false,
			children: {
				hasChildren: true,
				list: [
					hChild,
					{
						group: "underage",
						childInSameHousehold: false,
						parentalCare: true,
						alternatingCustody: true,
						mainFinancialContributor: "person",
					},
					{
						group: "firstEducation",
						childInSameHousehold: false,
						financiallySupported: true,
					},
					otherChild,
				],
			},
			residence: swiss,
		},
		expected: code("H3N"),
	},
	{
		source: "§ 8 example P3N",
		answers: {
			...earnedSingle,
			churchMember: false,
			children: {
				hasChildren: true,
				list: [
					hChild,
					{
						group: "underage",
						childInSameHousehold: false,
						parentalCare: true,
						alternatingCustody: true,
						mainFinancialContributor: "person",
					},
					{
						group: "firstEducation",
						childInSameHousehold: false,
						financiallySupported: true,
					},
					otherChild,
					otherChild,
					otherChild,
					otherChild,
				],
			},
			residence: {
				...germany,
				dailyReturnToGermany: false,
				dailyReturnToCountryOfResidenceReasonable: true,
				gre3: false,
			},
		},
		expected: code("P3N"),
	},
	// § 6.1 border-crosser map, the cases the golden list does not hold
	{
		source: "§ 6.1 map B to M",
		answers: {
			...earnedMarried,
			churchMember: false,
			spouseEmployed: false,
			children: noChildren,
			residence: germanBorderCrosser,
		},
		expected: code("M0N"),
	},
	{
		source: "§ 6.1 map H to P",
		answers: {
			...earnedSingle,
			churchMember: true,
			children: { hasChildren: true, list: [hChild] },
			residence: germanBorderCrosser,
		},
		expected: code("P1Y"),
	},
	// § 7 item 2: the result follows the current answers, not a stale child result
	{
		source:
			"§ 7 item 2 (single person, child result of the married table: A0N)",
		answers: {
			...earnedSingle,
			churchMember: false,
			children: { hasChildren: true, list: [otherChild] },
			residence: swiss,
		},
		expected: code("A0N"),
	},
	// § 6.3: the override also applies to replacement income
	{
		source: "§ 6.3 override with replacement income",
		answers: {
			incomeType: "replacement",
			residence: {
				...liechtenstein,
				dailyReturnToLiechtenstein: false,
				moreThanFortyFiveNonReturnDays: false,
			},
		},
		expected: { kind: "noSourceTax", text: NO_SOURCE_TAX, remark: DTA },
	},
];

describe("computeTariffCode", () => {
	for (const c of cases) {
		test(c.source, () => {
			const answers = ZhAnswersSchema.parse(c.answers);
			expect(computeTariffCode(answers)).toEqual(c.expected);
		});
	}
});
