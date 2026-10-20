// Complete answers of the Zurich tariff-code questionnaire.
// Questions and visibility: calculator-spec.md § 3, § 4.1, § 5. Field names: plans/2-onboarding-app/plan.md § 1.
//
// Each union member holds exactly the answers that are visible on one answer path.
// A boolean answer that opens different follow-up questions is a `z.literal` discriminator.
// A terminal answer (`mainFinancialContributor`, `financiallySupported`, `gre1Gre2`, `gre3`,
// `moreThanFortyFiveNonReturnDays`) is a plain field. The result functions read it.
// Every leaf repeats the literals of its parent unions, so each nested union can find its
// member by the key of the outer union (Zod v4 nested discriminated unions).

import { z } from "zod";

export const IncomeType = z.enum(["earned", "replacement"]);
export const CivilStatus = z.enum(["married", "single"]);
export const ChildGroup = z.enum(["underage", "firstEducation", "other"]);
export const MainFinancialContributor = z.enum(["person", "otherParent"]);
export const CountryOfResidence = z.enum(["DE", "LI", "other"]);

const yes = z.literal(true);
const no = z.literal(false);

const underage = { group: z.literal("underage") } as const;
const firstEducation = { group: z.literal("firstEducation") } as const;
const other = { group: z.literal("other") } as const;

/** A child of a person who is not married. One member per answer path of calculator-spec.md § 4.2. */
export const UnmarriedChildSchema = z.discriminatedUnion("group", [
	z.discriminatedUnion("childInSameHousehold", [
		z.discriminatedUnion("sharedCustody", [
			z.discriminatedUnion("sameHousehold", [
				// § 4.2 rows 1-2
				z.strictObject({
					...underage,
					childInSameHousehold: yes,
					sharedCustody: yes,
					sameHousehold: yes,
					mainFinancialContributor: MainFinancialContributor,
				}),
				z.discriminatedUnion("alternatingCustody", [
					// § 4.2 rows 3-4
					z.strictObject({
						...underage,
						childInSameHousehold: yes,
						sharedCustody: yes,
						sameHousehold: no,
						alternatingCustody: yes,
						mainFinancialContributor: MainFinancialContributor,
					}),
					// § 4.2 row 5
					z.strictObject({
						...underage,
						childInSameHousehold: yes,
						sharedCustody: yes,
						sameHousehold: no,
						alternatingCustody: no,
					}),
				]),
			]),
			// § 4.2 row 6
			z.strictObject({
				...underage,
				childInSameHousehold: yes,
				sharedCustody: no,
			}),
		]),
		z.discriminatedUnion("parentalCare", [
			z.discriminatedUnion("alternatingCustody", [
				// § 4.2 rows 7-8
				z.strictObject({
					...underage,
					childInSameHousehold: no,
					parentalCare: yes,
					alternatingCustody: yes,
					mainFinancialContributor: MainFinancialContributor,
				}),
				// § 4.2 row 9
				z.strictObject({
					...underage,
					childInSameHousehold: no,
					parentalCare: yes,
					alternatingCustody: no,
				}),
			]),
			// § 4.2 row 10
			z.strictObject({
				...underage,
				childInSameHousehold: no,
				parentalCare: no,
			}),
		]),
	]),
	z.discriminatedUnion("childInSameHousehold", [
		z.discriminatedUnion("sameHousehold", [
			// § 4.2 rows 11-12
			z.strictObject({
				...firstEducation,
				childInSameHousehold: yes,
				sameHousehold: yes,
				mainFinancialContributor: MainFinancialContributor,
			}),
			// § 4.2 rows 13-14
			z.strictObject({
				...firstEducation,
				childInSameHousehold: yes,
				sameHousehold: no,
				financiallySupported: z.boolean(),
			}),
		]),
		// § 4.2 rows 15-16
		z.strictObject({
			...firstEducation,
			childInSameHousehold: no,
			financiallySupported: z.boolean(),
		}),
	]),
	// § 4.2 row 17
	z.strictObject({ ...other }),
]);
export type UnmarriedChild = z.infer<typeof UnmarriedChildSchema>;

/** A child of a married person. One member per answer path of calculator-spec.md § 4.3. */
export const MarriedChildSchema = z.discriminatedUnion("group", [
	z.discriminatedUnion("childInSameHousehold", [
		z.discriminatedUnion("sharedCustody", [
			z.discriminatedUnion("sameHousehold", [
				// § 4.3 row 1
				z.strictObject({
					...underage,
					childInSameHousehold: yes,
					sharedCustody: yes,
					sameHousehold: yes,
				}),
				z.discriminatedUnion("alternatingCustody", [
					// § 4.3 rows 2-3
					z.strictObject({
						...underage,
						childInSameHousehold: yes,
						sharedCustody: yes,
						sameHousehold: no,
						alternatingCustody: yes,
						mainFinancialContributor: MainFinancialContributor,
					}),
					// § 4.3 row 4
					z.strictObject({
						...underage,
						childInSameHousehold: yes,
						sharedCustody: yes,
						sameHousehold: no,
						alternatingCustody: no,
					}),
				]),
			]),
			// § 4.3 row 5
			z.strictObject({
				...underage,
				childInSameHousehold: yes,
				sharedCustody: no,
			}),
		]),
		z.discriminatedUnion("sharedCustody", [
			z.discriminatedUnion("alternatingCustody", [
				// § 4.3 rows 6-7
				z.strictObject({
					...underage,
					childInSameHousehold: no,
					sharedCustody: yes,
					alternatingCustody: yes,
					mainFinancialContributor: MainFinancialContributor,
				}),
				// § 4.3 row 8
				z.strictObject({
					...underage,
					childInSameHousehold: no,
					sharedCustody: yes,
					alternatingCustody: no,
				}),
			]),
			// § 4.3 row 9
			z.strictObject({
				...underage,
				childInSameHousehold: no,
				sharedCustody: no,
			}),
		]),
	]),
	z.discriminatedUnion("childInSameHousehold", [
		z.discriminatedUnion("sameHousehold", [
			// § 4.3 row 10
			z.strictObject({
				...firstEducation,
				childInSameHousehold: yes,
				sameHousehold: yes,
			}),
			// § 4.3 rows 11-12
			z.strictObject({
				...firstEducation,
				childInSameHousehold: yes,
				sameHousehold: no,
				financiallySupported: z.boolean(),
			}),
		]),
		// § 4.3 rows 13-14
		z.strictObject({
			...firstEducation,
			childInSameHousehold: no,
			financiallySupported: z.boolean(),
		}),
	]),
	// § 4.3 row 15
	z.strictObject({ ...other }),
]);
export type MarriedChild = z.infer<typeof MarriedChildSchema>;

/** The residence questions. One member per answer path of calculator-spec.md § 5.1. */
export const ResidenceSchema = z.discriminatedUnion("residenceInSwitzerland", [
	// § 5.1 row 1
	z.strictObject({ residenceInSwitzerland: yes }),
	z.discriminatedUnion("countryOfResidence", [
		z.discriminatedUnion("dailyReturnToGermany", [
			// § 5.1 rows 2-3
			z.strictObject({
				residenceInSwitzerland: no,
				countryOfResidence: z.literal("DE"),
				dailyReturnToGermany: yes,
				gre1Gre2: z.boolean(),
			}),
			z.discriminatedUnion("dailyReturnToCountryOfResidenceReasonable", [
				// § 5.1 rows 4-5
				z.strictObject({
					residenceInSwitzerland: no,
					countryOfResidence: z.literal("DE"),
					dailyReturnToGermany: no,
					dailyReturnToCountryOfResidenceReasonable: yes,
					gre3: z.boolean(),
				}),
				// § 5.1 row 6
				z.strictObject({
					residenceInSwitzerland: no,
					countryOfResidence: z.literal("DE"),
					dailyReturnToGermany: no,
					dailyReturnToCountryOfResidenceReasonable: no,
				}),
			]),
		]),
		z.discriminatedUnion("dailyReturnToLiechtenstein", [
			// § 5.1 row 7
			z.strictObject({
				residenceInSwitzerland: no,
				countryOfResidence: z.literal("LI"),
				dailyReturnToLiechtenstein: yes,
			}),
			// § 5.1 rows 8-9
			z.strictObject({
				residenceInSwitzerland: no,
				countryOfResidence: z.literal("LI"),
				dailyReturnToLiechtenstein: no,
				moreThanFortyFiveNonReturnDays: z.boolean(),
			}),
		]),
		// § 5.1 row 10
		z.strictObject({
			residenceInSwitzerland: no,
			countryOfResidence: z.literal("other"),
		}),
	]),
]);
export type Residence = z.infer<typeof ResidenceSchema>;

const MarriedChildren = z.discriminatedUnion("hasChildren", [
	z.strictObject({ hasChildren: no }),
	z.strictObject({
		hasChildren: yes,
		list: z.array(MarriedChildSchema).min(1),
	}),
]);

const UnmarriedChildren = z.discriminatedUnion("hasChildren", [
	z.strictObject({ hasChildren: no }),
	z.strictObject({
		hasChildren: yes,
		list: z.array(UnmarriedChildSchema).min(1),
	}),
]);

const earned = { incomeType: z.literal("earned") } as const;

/** The complete answer set. Calculator-spec.md § 3. */
export const ZhAnswersSchema = z.discriminatedUnion("incomeType", [
	z.discriminatedUnion("civilStatus", [
		z.strictObject({
			...earned,
			civilStatus: z.literal("married"),
			churchMember: z.boolean(),
			spouseEmployed: z.boolean(),
			children: MarriedChildren,
			residence: ResidenceSchema,
		}),
		z.strictObject({
			...earned,
			civilStatus: z.literal("single"),
			churchMember: z.boolean(),
			children: UnmarriedChildren,
			residence: ResidenceSchema,
		}),
	]),
	z.strictObject({
		incomeType: z.literal("replacement"),
		residence: ResidenceSchema,
	}),
]);
export type ZhAnswers = z.infer<typeof ZhAnswersSchema>;
