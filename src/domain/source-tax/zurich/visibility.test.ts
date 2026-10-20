// Source: spec.md § 2 (one case per row of the table) and rule R (spec.md § 4).
// The label variants on one id have disjoint rules: the test reads the label too.

import { describe, expect, test } from "bun:test";
import { visibleQuestions } from "../../flow/engine.ts";
import { zhFlow } from "./questions.ts";
import type { ZhDraft } from "./schema.ts";

function visible(draft: ZhDraft): { path: string; label: string }[] {
	return visibleQuestions(zhFlow, draft).flatMap((node) =>
		node.kind === "question"
			? [node]
			: [
					{ path: node.path, label: node.itemLabel },
					...node.items.flatMap((item) => item.questions),
				],
	);
}

const paths = (draft: ZhDraft) => visible(draft).map((q) => q.path);

type Case = {
	name: string;
	source: string;
	draft: ZhDraft;
	shown: string[];
	hidden: string[];
};

const earnedSingle: ZhDraft = { incomeType: "earned", civilStatus: "single" };
const earnedMarried: ZhDraft = { incomeType: "earned", civilStatus: "married" };
const withChild = (
	base: ZhDraft,
	child: NonNullable<NonNullable<ZhDraft["children"]>["list"]>[number],
): ZhDraft => ({
	...base,
	churchMember: false,
	...(base.civilStatus === "married" ? { spouseEmployed: false } : {}),
	children: { hasChildren: true, list: [child] },
});
const child = (index: number, field: string) =>
	`children.list.${index}.${field}`;

const mainCases: Case[] = [
	{
		name: "empty draft shows only incomeType",
		source: "calc-spec § 3 #1",
		draft: {},
		shown: ["incomeType"],
		hidden: ["civilStatus", "churchMember", "residence.residenceInSwitzerland"],
	},
	{
		name: "earned income opens civilStatus",
		source: "calc-spec § 3 #2",
		draft: { incomeType: "earned" },
		shown: ["incomeType", "civilStatus"],
		hidden: ["churchMember"],
	},
	{
		name: "replacement income skips civil status, church and children",
		source: "calc-spec § 3 #1, rule R",
		draft: { incomeType: "replacement" },
		shown: ["residence.residenceInSwitzerland"],
		hidden: ["civilStatus", "churchMember", "children.hasChildren"],
	},
	{
		name: "civilStatus opens churchMember",
		source: "calc-spec § 3 #3",
		draft: earnedSingle,
		shown: ["churchMember"],
		hidden: ["spouseEmployed", "children.hasChildren"],
	},
	{
		name: "married and churchMember open spouseEmployed",
		source: "calc-spec § 3 #4",
		draft: { ...earnedMarried, churchMember: true },
		shown: ["spouseEmployed"],
		hidden: ["children.hasChildren"],
	},
	{
		name: "single does not ask spouseEmployed",
		source: "calc-spec § 3 #4",
		draft: { ...earnedSingle, churchMember: true },
		shown: ["children.hasChildren"],
		hidden: ["spouseEmployed"],
	},
	{
		name: "married and spouseEmployed open hasChildren",
		source: "calc-spec § 3 #5",
		draft: { ...earnedMarried, churchMember: true, spouseEmployed: false },
		shown: ["children.hasChildren"],
		hidden: ["children.list", "residence.residenceInSwitzerland"],
	},
	{
		name: "hasChildren = true opens the group",
		source: "calc-spec § 3 #6",
		draft: {
			...earnedSingle,
			churchMember: true,
			children: { hasChildren: true },
		},
		shown: ["children.list", "residence.residenceInSwitzerland"],
		hidden: [],
	},
	{
		name: "hasChildren = false hides the group",
		source: "calc-spec § 3 #6",
		draft: {
			...earnedSingle,
			churchMember: true,
			children: { hasChildren: false },
		},
		shown: ["residence.residenceInSwitzerland"],
		hidden: ["children.list"],
	},
	{
		name: "rule R: an incomplete child does not hide the residence questions",
		source: "spec.md § 4 rule R",
		draft: withChild(earnedSingle, { group: "underage" }),
		shown: [
			"residence.residenceInSwitzerland",
			child(0, "childInSameHousehold"),
		],
		hidden: [],
	},
];

const childCases: Case[] = [
	{
		name: "group is always asked",
		source: "calc-spec § 4.1",
		draft: withChild(earnedSingle, {}),
		shown: [child(0, "group")],
		hidden: [child(0, "childInSameHousehold")],
	},
	{
		name: "group other asks nothing more",
		source: "calc-spec § 4.1",
		draft: withChild(earnedSingle, { group: "other" }),
		shown: [child(0, "group")],
		hidden: [child(0, "childInSameHousehold")],
	},
	{
		name: "minor opens childInSameHousehold",
		source: "calc-spec § 4.1",
		draft: withChild(earnedSingle, { group: "underage" }),
		shown: [child(0, "childInSameHousehold")],
		hidden: [child(0, "sharedCustody"), child(0, "parentalCare")],
	},
	{
		name: "unmarried minor outside the household opens parentalCare",
		source: "calc-spec § 4.1",
		draft: withChild(earnedSingle, {
			group: "underage",
			childInSameHousehold: false,
		}),
		shown: [child(0, "parentalCare")],
		hidden: [child(0, "sharedCustody")],
	},
	{
		name: "married minor outside the household skips parentalCare",
		source: "calc-spec § 4.1",
		draft: withChild(earnedMarried, {
			group: "underage",
			childInSameHousehold: false,
		}),
		shown: [child(0, "sharedCustody")],
		hidden: [child(0, "parentalCare")],
	},
	{
		name: "minor in the household opens sharedCustody",
		source: "calc-spec § 4.1",
		draft: withChild(earnedSingle, {
			group: "underage",
			childInSameHousehold: true,
		}),
		shown: [child(0, "sharedCustody")],
		hidden: [child(0, "sameHousehold"), child(0, "alternatingCustody")],
	},
	{
		name: "shared custody opens sameHousehold",
		source: "calc-spec § 4.1",
		draft: withChild(earnedSingle, {
			group: "underage",
			childInSameHousehold: true,
			sharedCustody: true,
		}),
		shown: [child(0, "sameHousehold")],
		hidden: [
			child(0, "alternatingCustody"),
			child(0, "mainFinancialContributor"),
		],
	},
	{
		name: "sole custody ends the child",
		source: "calc-spec § 4.1",
		draft: withChild(earnedSingle, {
			group: "underage",
			childInSameHousehold: true,
			sharedCustody: false,
		}),
		shown: [child(0, "sharedCustody")],
		hidden: [child(0, "sameHousehold"), child(0, "mainFinancialContributor")],
	},
	{
		name: "separate households with shared custody open alternatingCustody",
		source: "calc-spec § 4.1",
		draft: withChild(earnedSingle, {
			group: "underage",
			childInSameHousehold: true,
			sharedCustody: true,
			sameHousehold: false,
		}),
		shown: [child(0, "alternatingCustody")],
		hidden: [child(0, "mainFinancialContributor")],
	},
	{
		name: "unmarried, same household: mainFinancialContributor",
		source: "calc-spec § 4.1",
		draft: withChild(earnedSingle, {
			group: "underage",
			childInSameHousehold: true,
			sharedCustody: true,
			sameHousehold: true,
		}),
		shown: [child(0, "mainFinancialContributor")],
		hidden: [child(0, "alternatingCustody")],
	},
	{
		name: "married, same household: no mainFinancialContributor",
		source: "calc-spec § 4.1",
		draft: withChild(earnedMarried, {
			group: "underage",
			childInSameHousehold: true,
			sharedCustody: true,
			sameHousehold: true,
		}),
		shown: [],
		hidden: [
			child(0, "mainFinancialContributor"),
			child(0, "alternatingCustody"),
		],
	},
	{
		name: "alternating custody opens mainFinancialContributor",
		source: "calc-spec § 4.1",
		draft: withChild(earnedSingle, {
			group: "underage",
			childInSameHousehold: true,
			sharedCustody: true,
			sameHousehold: false,
			alternatingCustody: true,
		}),
		shown: [child(0, "mainFinancialContributor")],
		hidden: [],
	},
	{
		name: "unmarried, outside the household, parental care opens alternatingCustody",
		source: "calc-spec § 4.1",
		draft: withChild(earnedSingle, {
			group: "underage",
			childInSameHousehold: false,
			parentalCare: true,
		}),
		shown: [child(0, "alternatingCustody")],
		hidden: [child(0, "mainFinancialContributor")],
	},
	{
		name: "unmarried, outside the household, no parental care ends the child",
		source: "calc-spec § 4.1",
		draft: withChild(earnedSingle, {
			group: "underage",
			childInSameHousehold: false,
			parentalCare: false,
		}),
		shown: [],
		hidden: [child(0, "alternatingCustody")],
	},
	{
		name: "married, outside the household, shared custody opens alternatingCustody",
		source: "calc-spec § 4.1",
		draft: withChild(earnedMarried, {
			group: "underage",
			childInSameHousehold: false,
			sharedCustody: true,
		}),
		shown: [child(0, "alternatingCustody")],
		hidden: [child(0, "parentalCare")],
	},
	{
		name: "first education opens childInSameHousehold, not the minor questions",
		source: "calc-spec § 4.1",
		draft: withChild(earnedSingle, { group: "firstEducation" }),
		shown: [child(0, "childInSameHousehold")],
		hidden: [child(0, "sharedCustody"), child(0, "parentalCare")],
	},
	{
		name: "first education in the household opens sameHousehold",
		source: "calc-spec § 4.1",
		draft: withChild(earnedSingle, {
			group: "firstEducation",
			childInSameHousehold: true,
		}),
		shown: [child(0, "sameHousehold")],
		hidden: [child(0, "financiallySupported")],
	},
	{
		name: "first education, same household, unmarried: mainFinancialContributor",
		source: "calc-spec § 4.1",
		draft: withChild(earnedSingle, {
			group: "firstEducation",
			childInSameHousehold: true,
			sameHousehold: true,
		}),
		shown: [child(0, "mainFinancialContributor")],
		hidden: [child(0, "financiallySupported")],
	},
	{
		name: "first education, same household, married: nothing more",
		source: "calc-spec § 4.1",
		draft: withChild(earnedMarried, {
			group: "firstEducation",
			childInSameHousehold: true,
			sameHousehold: true,
		}),
		shown: [],
		hidden: [
			child(0, "mainFinancialContributor"),
			child(0, "financiallySupported"),
		],
	},
	{
		name: "first education, separate households: financiallySupported",
		source: "calc-spec § 4.1",
		draft: withChild(earnedSingle, {
			group: "firstEducation",
			childInSameHousehold: true,
			sameHousehold: false,
		}),
		shown: [child(0, "financiallySupported")],
		hidden: [child(0, "mainFinancialContributor")],
	},
	{
		name: "first education outside the household: financiallySupported",
		source: "calc-spec § 4.1",
		draft: withChild(earnedSingle, {
			group: "firstEducation",
			childInSameHousehold: false,
		}),
		shown: [child(0, "financiallySupported")],
		hidden: [child(0, "sameHousehold")],
	},
	{
		name: "the second child follows the same rules",
		source: "calc-spec § 4.1",
		draft: {
			...earnedSingle,
			churchMember: false,
			children: {
				hasChildren: true,
				list: [{ group: "other" }, { group: "underage" }],
			},
		},
		shown: [
			child(0, "group"),
			child(1, "group"),
			child(1, "childInSameHousehold"),
		],
		hidden: [child(0, "childInSameHousehold")],
	},
];

const residenceBase: ZhDraft = {
	incomeType: "replacement",
};
const residenceCases: Case[] = [
	{
		name: "residence in Switzerland ends the residence questions",
		source: "calc-spec § 5",
		draft: { ...residenceBase, residence: { residenceInSwitzerland: true } },
		shown: ["residence.residenceInSwitzerland"],
		hidden: ["residence.countryOfResidence"],
	},
	{
		name: "residence abroad opens countryOfResidence",
		source: "calc-spec § 5",
		draft: { ...residenceBase, residence: { residenceInSwitzerland: false } },
		shown: ["residence.countryOfResidence"],
		hidden: [
			"residence.dailyReturnToGermany",
			"residence.dailyReturnToLiechtenstein",
		],
	},
	{
		name: "Germany opens dailyReturnToGermany",
		source: "calc-spec § 5",
		draft: {
			...residenceBase,
			residence: { residenceInSwitzerland: false, countryOfResidence: "DE" },
		},
		shown: ["residence.dailyReturnToGermany"],
		hidden: ["residence.dailyReturnToLiechtenstein", "residence.gre1Gre2"],
	},
	{
		name: "Germany, daily return opens gre1Gre2",
		source: "calc-spec § 5",
		draft: {
			...residenceBase,
			residence: {
				residenceInSwitzerland: false,
				countryOfResidence: "DE",
				dailyReturnToGermany: true,
			},
		},
		shown: ["residence.gre1Gre2"],
		hidden: ["residence.dailyReturnToCountryOfResidenceReasonable"],
	},
	{
		name: "Germany, no daily return opens the reasonable question",
		source: "calc-spec § 5",
		draft: {
			...residenceBase,
			residence: {
				residenceInSwitzerland: false,
				countryOfResidence: "DE",
				dailyReturnToGermany: false,
			},
		},
		shown: ["residence.dailyReturnToCountryOfResidenceReasonable"],
		hidden: ["residence.gre1Gre2", "residence.gre3"],
	},
	{
		name: "Germany, reasonable return opens gre3",
		source: "calc-spec § 5",
		draft: {
			...residenceBase,
			residence: {
				residenceInSwitzerland: false,
				countryOfResidence: "DE",
				dailyReturnToGermany: false,
				dailyReturnToCountryOfResidenceReasonable: true,
			},
		},
		shown: ["residence.gre3"],
		hidden: [],
	},
	{
		name: "Germany, return not reasonable ends the questions",
		source: "calc-spec § 5",
		draft: {
			...residenceBase,
			residence: {
				residenceInSwitzerland: false,
				countryOfResidence: "DE",
				dailyReturnToGermany: false,
				dailyReturnToCountryOfResidenceReasonable: false,
			},
		},
		shown: [],
		hidden: ["residence.gre3"],
	},
	{
		name: "Liechtenstein opens dailyReturnToLiechtenstein",
		source: "calc-spec § 5",
		draft: {
			...residenceBase,
			residence: { residenceInSwitzerland: false, countryOfResidence: "LI" },
		},
		shown: ["residence.dailyReturnToLiechtenstein"],
		hidden: [
			"residence.dailyReturnToGermany",
			"residence.moreThanFortyFiveNonReturnDays",
		],
	},
	{
		name: "Liechtenstein, no daily return opens the 45 days question",
		source: "calc-spec § 5",
		draft: {
			...residenceBase,
			residence: {
				residenceInSwitzerland: false,
				countryOfResidence: "LI",
				dailyReturnToLiechtenstein: false,
			},
		},
		shown: ["residence.moreThanFortyFiveNonReturnDays"],
		hidden: [],
	},
	{
		name: "other country ends the questions",
		source: "calc-spec § 5",
		draft: {
			...residenceBase,
			residence: { residenceInSwitzerland: false, countryOfResidence: "other" },
		},
		shown: ["residence.countryOfResidence"],
		hidden: [
			"residence.dailyReturnToGermany",
			"residence.dailyReturnToLiechtenstein",
		],
	},
];

describe("visibility of the Zurich questions", () => {
	for (const group of [
		{ title: "main questions", cases: mainCases },
		{ title: "child questions", cases: childCases },
		{ title: "residence questions", cases: residenceCases },
	]) {
		describe(group.title, () => {
			for (const { name, source, draft, shown, hidden } of group.cases) {
				test(`${name} (${source})`, () => {
					const actual = paths(draft);
					for (const path of shown) {
						expect(actual, path).toContain(path);
					}
					for (const path of hidden) {
						expect(actual, path).not.toContain(path);
					}
				});
			}
		});
	}
});

describe("label variants", () => {
	const label = (draft: ZhDraft, path: string) => {
		const matches = visible(draft).filter((q) => q.path === path);
		expect(matches.length, path).toBe(1);
		return matches[0]?.label ?? "";
	};

	test("hasChildren: married and single have different labels (calc-spec § 3 #5)", () => {
		const married = label(
			{ ...earnedMarried, churchMember: true, spouseEmployed: true },
			"children.hasChildren",
		);
		const single = label(
			{ ...earnedSingle, churchMember: true },
			"children.hasChildren",
		);
		expect(married).not.toBe(single);
	});

	test("residence variants: earned and replacement have different labels (calc-spec § 5)", () => {
		const replacement = label(
			{ incomeType: "replacement" },
			"residence.residenceInSwitzerland",
		);
		expect(replacement).toContain("replacement income");
		const earned = label(
			{
				...earnedSingle,
				churchMember: true,
				children: { hasChildren: false },
			},
			"residence.residenceInSwitzerland",
		);
		expect(earned).not.toContain("replacement income");
	});

	test("sharedCustody: the variant depends on the household (calc-spec § 4.1)", () => {
		const inHousehold = label(
			withChild(earnedSingle, {
				group: "underage",
				childInSameHousehold: true,
			}),
			child(0, "sharedCustody"),
		);
		const outside = label(
			withChild(earnedMarried, {
				group: "underage",
				childInSameHousehold: false,
			}),
			child(0, "sharedCustody"),
		);
		expect(inHousehold).not.toBe(outside);
	});
});
