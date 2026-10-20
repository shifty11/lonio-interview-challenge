// The seven example employees of the seed. They follow the golden cases of calc-spec § 9.
// Each record passes `OnboardingSchema` (src/prisma/seed-data.test.ts).

import type { OnboardingDraft } from "../domain/onboarding/schema.ts";

type SeedEmployee = OnboardingDraft & { source: string };

export const seedEmployees: readonly SeedEmployee[] = [
	{
		// A Swiss employee gets no source-tax questions (brief).
		source: "challenge.md: Swiss employee",
		firstName: "Anna",
		lastName: "Keller",
		nationality: "CH",
	},
	{
		source: "calc-spec § 9 #1",
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
	},
	{
		source: "calc-spec § 9 #4",
		firstName: "Marta",
		lastName: "Silva",
		nationality: "PT",
		sourceTax: {
			canton: "ZH",
			answers: {
				incomeType: "earned",
				civilStatus: "single",
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
				residence: { residenceInSwitzerland: true },
			},
		},
	},
	{
		source: "calc-spec § 9 #3 (sole custody variant)",
		firstName: "Jan",
		lastName: "Novak",
		nationality: "CZ",
		sourceTax: {
			canton: "ZH",
			answers: {
				incomeType: "earned",
				civilStatus: "married",
				churchMember: false,
				spouseEmployed: true,
				children: {
					hasChildren: true,
					list: [
						{
							group: "underage",
							childInSameHousehold: true,
							sharedCustody: false,
						},
						{
							group: "underage",
							childInSameHousehold: true,
							sharedCustody: false,
						},
					],
				},
				residence: { residenceInSwitzerland: true },
			},
		},
	},
	{
		source: "calc-spec § 9 #10",
		firstName: "Klaus",
		lastName: "Weber",
		nationality: "DE",
		sourceTax: {
			canton: "ZH",
			answers: {
				incomeType: "earned",
				civilStatus: "single",
				churchMember: false,
				children: { hasChildren: false },
				residence: {
					residenceInSwitzerland: false,
					countryOfResidence: "DE",
					dailyReturnToGermany: true,
					gre1Gre2: true,
				},
			},
		},
	},
	{
		source: "calc-spec § 9 #14 (replacement income)",
		firstName: "Mia",
		lastName: "Frick",
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
	},
	{
		source: "calc-spec § 9 #16",
		firstName: "Priya",
		lastName: "Nair",
		nationality: "IN",
		sourceTax: {
			canton: "ZH",
			answers: {
				incomeType: "replacement",
				residence: { residenceInSwitzerland: true },
			},
		},
	},
];
