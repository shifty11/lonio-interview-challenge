// The Zurich question flow as data, in calculator order. The renderer reads this list.
// Source of the questions and of the visibility rules: calculator-spec.md § 3, § 4.1, § 5.
// Labels are English translations of the German texts in that spec.
//
// A predicate reads earlier questions only. The engine passes the pruned prefix, so an answer
// that is visible implies the visibility of its parents. A predicate need not test them again.
// A label variant is a separate entry on the same `id` with a disjoint `visibleWhen`.

import type {
	Flow,
	ItemQuestion,
	Option,
	Question,
} from "../../flow/question.ts";
import type { ZhDraft, ZhDraftChild } from "./schema.ts";

const YES_NO: readonly Option[] = [
	{ value: true, label: "Yes" },
	{ value: false, label: "No" },
];

const isEarned = (root: ZhDraft) => root.incomeType === "earned";
const isReplacement = (root: ZhDraft) => root.incomeType === "replacement";
const isMarried = (root: ZhDraft) => root.civilStatus === "married";
const isSingle = (root: ZhDraft) => root.civilStatus === "single";

/**
 * Rule R: the residence questions are visible once `children.hasChildren` is answered
 * (earned income), or at once (replacement income). This deviates from calculator-spec.md § 3 row 7,
 * which also waits for a result of every child. With pruning, that wait would delete the
 * residence answers on every child edit. `missingAnswers` reports an incomplete child instead.
 * See plan.md, Fixed decisions.
 */
const residenceVisible = (root: ZhDraft) =>
	isReplacement(root) ||
	(isEarned(root) && root.children?.hasChildren !== undefined);

const residence = (root: ZhDraft) => root.residence;

const SOURCE_MAIN = "calculator-spec.md § 3";
const SOURCE_CHILD = "calculator-spec.md § 4.1";
const SOURCE_RESIDENCE = "calculator-spec.md § 5";

function yesNo(
	id: string,
	label: string,
	visibleWhen: (root: ZhDraft) => boolean,
	source: string,
): Question<ZhDraft> {
	return { kind: "question", id, label, options: YES_NO, visibleWhen, source };
}

function childYesNo(
	id: string,
	label: string,
	visibleWhen: (root: ZhDraft, child: ZhDraftChild) => boolean,
): ItemQuestion<ZhDraft, ZhDraftChild> {
	return {
		kind: "question",
		id,
		label,
		options: YES_NO,
		visibleWhen,
		source: SOURCE_CHILD,
	};
}

const isUnderage = (child: ZhDraftChild) => child.group === "underage";
const isFirstEducation = (child: ZhDraftChild) =>
	child.group === "firstEducation";
const inHousehold = (child: ZhDraftChild) =>
	child.childInSameHousehold === true;
const notInHousehold = (child: ZhDraftChild) =>
	child.childInSameHousehold === false;

export const zhFlow: Flow<ZhDraft, ZhDraftChild> = [
	{
		kind: "question",
		id: "incomeType",
		label: "For which income do you want to find the source-tax tariff?",
		options: [
			{ value: "earned", label: "Earned income" },
			{ value: "replacement", label: "Replacement income" },
		],
		visibleWhen: () => true,
		source: `${SOURCE_MAIN} #1`,
	},
	{
		kind: "question",
		id: "civilStatus",
		label: "Civil status",
		options: [
			{ value: "married", label: "Married or registered partnership" },
			{
				value: "single",
				label: "Single, divorced, separated, widowed",
			},
		],
		visibleWhen: isEarned,
		source: `${SOURCE_MAIN} #2`,
	},
	{
		kind: "question",
		id: "churchMember",
		label: "Religious affiliation",
		options: [
			{
				value: true,
				label: "Roman Catholic, Christian Catholic, Protestant Reformed",
			},
			{ value: false, label: "None or other" },
		],
		visibleWhen: (root) => root.civilStatus !== undefined,
		source: `${SOURCE_MAIN} #3`,
	},
	yesNo(
		"spouseEmployed",
		"Is the spouse or registered partner employed or in receipt of replacement income?",
		(root) => isMarried(root) && root.churchMember !== undefined,
		`${SOURCE_MAIN} #4`,
	),
	yesNo(
		"children.hasChildren",
		"Does the person or the spouse or partner have biological or adopted children?",
		(root) => isMarried(root) && root.spouseEmployed !== undefined,
		`${SOURCE_MAIN} #5`,
	),
	yesNo(
		"children.hasChildren",
		"Does the person have biological or adopted children?",
		(root) => isSingle(root) && root.churchMember !== undefined,
		`${SOURCE_MAIN} #5`,
	),
	{
		kind: "group",
		id: "children.list",
		itemLabel: "Child",
		addLabel: "Add another child",
		visibleWhen: (root) => root.children?.hasChildren === true,
		items: [
			{
				kind: "question",
				id: "group",
				label: "Is the child a minor, or an adult in first education?",
				options: [
					{ value: "underage", label: "Minor" },
					{ value: "firstEducation", label: "Adult in first education" },
					{ value: "other", label: "Neither" },
				],
				visibleWhen: () => true,
				source: SOURCE_CHILD,
			},
			childYesNo(
				"childInSameHousehold",
				"Does the child live in the same household?",
				(_root, child) => isUnderage(child) || isFirstEducation(child),
			),
			childYesNo(
				"parentalCare",
				"Does the person have parental authority?",
				(root, child) =>
					isUnderage(child) && !isMarried(root) && notInHousehold(child),
			),
			{
				kind: "question",
				id: "sharedCustody",
				label: "Parental authority",
				options: [
					{ value: true, label: "Shared custody" },
					{ value: false, label: "Sole custody" },
				],
				visibleWhen: (_root, child) => isUnderage(child) && inHousehold(child),
				source: SOURCE_CHILD,
			},
			childYesNo(
				"sharedCustody",
				"Shared custody",
				(root, child) =>
					isUnderage(child) && isMarried(root) && notInHousehold(child),
			),
			childYesNo(
				"sameHousehold",
				"Common household with the other parent?",
				(_root, child) =>
					(isUnderage(child) &&
						inHousehold(child) &&
						child.sharedCustody === true) ||
					(isFirstEducation(child) && inHousehold(child)),
			),
			childYesNo(
				"alternatingCustody",
				"Alternating custody?",
				(root, child) =>
					isUnderage(child) &&
					((!isMarried(root) &&
						notInHousehold(child) &&
						child.parentalCare === true) ||
						(inHousehold(child) &&
							child.sharedCustody === true &&
							child.sameHousehold === false) ||
						(isMarried(root) &&
							notInHousehold(child) &&
							child.sharedCustody === true)),
			),
			{
				kind: "question",
				id: "mainFinancialContributor",
				label:
					"Who makes the larger financial contribution to the maintenance of the child?",
				options: [
					{ value: "person", label: "The source-taxed person" },
					{ value: "otherParent", label: "The other parent" },
				],
				visibleWhen: (root, child) =>
					(isUnderage(child) &&
						((notInHousehold(child) && child.alternatingCustody === true) ||
							(inHousehold(child) &&
								child.sameHousehold === true &&
								!isMarried(root)) ||
							(inHousehold(child) && child.alternatingCustody === true))) ||
					(isFirstEducation(child) &&
						!isMarried(root) &&
						inHousehold(child) &&
						child.sameHousehold === true),
				source: SOURCE_CHILD,
			},
			childYesNo(
				"financiallySupported",
				"Does the person pay the main part (more than 50%) of the maintenance of the child?",
				(_root, child) =>
					isFirstEducation(child) &&
					((inHousehold(child) && child.sameHousehold === false) ||
						notInHousehold(child)),
			),
		],
	},
	yesNo(
		"residence.residenceInSwitzerland",
		"Is the main residence in Switzerland?",
		(root) => residenceVisible(root) && isEarned(root),
		`${SOURCE_RESIDENCE} (earned income)`,
	),
	yesNo(
		"residence.residenceInSwitzerland",
		"Is the main residence in Switzerland (during or before the replacement income)?",
		(root) => residenceVisible(root) && isReplacement(root),
		`${SOURCE_RESIDENCE} (replacement income)`,
	),
	{
		kind: "question",
		id: "residence.countryOfResidence",
		label: "Country of residence",
		options: [
			{ value: "DE", label: "Germany" },
			{ value: "LI", label: "Liechtenstein" },
			{ value: "other", label: "Other country" },
		],
		visibleWhen: (root) => residence(root)?.residenceInSwitzerland === false,
		source: SOURCE_RESIDENCE,
	},
	yesNo(
		"residence.dailyReturnToGermany",
		"Does the person return daily to the main residence in Germany?",
		(root) => residence(root)?.countryOfResidence === "DE" && isEarned(root),
		`${SOURCE_RESIDENCE} (earned income)`,
	),
	yesNo(
		"residence.dailyReturnToGermany",
		"Does the person return daily to the main residence in Germany (during or before the replacement income)?",
		(root) =>
			residence(root)?.countryOfResidence === "DE" && isReplacement(root),
		`${SOURCE_RESIDENCE} (replacement income)`,
	),
	yesNo(
		"residence.gre1Gre2",
		"Is a certificate of residence provided? (Form Gre-1 or Gre-2)",
		(root) => residence(root)?.dailyReturnToGermany === true,
		SOURCE_RESIDENCE,
	),
	yesNo(
		"residence.dailyReturnToCountryOfResidenceReasonable",
		"Is a daily return in principle reasonable (less than 100 km driving distance)?",
		(root) => residence(root)?.dailyReturnToGermany === false,
		SOURCE_RESIDENCE,
	),
	yesNo(
		"residence.gre3",
		"Is proof of more than 60 non-return days per calendar year due to work provided? (Form Gre-3)",
		(root) =>
			residence(root)?.dailyReturnToCountryOfResidenceReasonable === true,
		SOURCE_RESIDENCE,
	),
	yesNo(
		"residence.dailyReturnToLiechtenstein",
		"Does the person return daily to the main residence in Liechtenstein?",
		(root) => residence(root)?.countryOfResidence === "LI" && isEarned(root),
		`${SOURCE_RESIDENCE} (earned income)`,
	),
	yesNo(
		"residence.dailyReturnToLiechtenstein",
		"Does the person return daily to the main residence in Liechtenstein (during or before the replacement income)?",
		(root) =>
			residence(root)?.countryOfResidence === "LI" && isReplacement(root),
		`${SOURCE_RESIDENCE} (replacement income)`,
	),
	yesNo(
		"residence.moreThanFortyFiveNonReturnDays",
		"More than 45 non-return days per calendar year due to work?",
		(root) => residence(root)?.dailyReturnToLiechtenstein === false,
		SOURCE_RESIDENCE,
	),
];
