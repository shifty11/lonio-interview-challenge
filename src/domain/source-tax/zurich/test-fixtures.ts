// Shared answer fixtures for the Zurich tests. Not a test file.

export const swiss = { residenceInSwitzerland: true } as const;

export const germanBorderCrosser = {
	residenceInSwitzerland: false,
	countryOfResidence: "DE",
	dailyReturnToGermany: true,
	gre1Gre2: true,
} as const;

/** Unmarried child that justifies H and counts (calculator-spec.md § 4.2 row 1). */
export const hChild = {
	group: "underage",
	childInSameHousehold: true,
	sharedCustody: true,
	sameHousehold: true,
	mainFinancialContributor: "person",
} as const;

/** Child that counts for a married person (calculator-spec.md § 4.3 row 5). */
export const marriedSoleCustodyChild = {
	group: "underage",
	childInSameHousehold: true,
	sharedCustody: false,
} as const;

export const otherChild = { group: "other" } as const;

/** Child that neither justifies H nor counts (calculator-spec.md § 4.2 row 10). */
export const noCountChild = {
	group: "underage",
	childInSameHousehold: false,
	parentalCare: false,
} as const;
