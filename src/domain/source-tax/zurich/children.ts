// Child results. Source: calculator-spec.md § 4.2 and § 4.3,
// Zurich calculator bundle sources/zh/calculator/main.pretty.js.

import { assertNever } from "../money.ts";
import type { MarriedChild, UnmarriedChild } from "./schema.ts";

type Contributor = "person" | "otherParent";

function isPerson(contributor: Contributor): boolean {
	switch (contributor) {
		case "person":
			return true;
		case "otherParent":
			return false;
		default:
			return assertNever(contributor);
	}
}

const JUSTIFIES_AND_COUNTS = { justifiesH: true, counts: true } as const;
const NEITHER = { justifiesH: false, counts: false } as const;

/** Result for a person who is not married (calculator-spec.md § 4.2, main.pretty.js:16278-16428). */
export function childResultUnmarried(child: UnmarriedChild): {
	justifiesH: boolean;
	counts: boolean;
} {
	switch (child.group) {
		case "underage":
			if (child.childInSameHousehold) {
				if (child.sharedCustody) {
					if (child.sameHousehold) {
						// § 4.2 rows 1-2, main.pretty.js:16306, 16312
						return isPerson(child.mainFinancialContributor)
							? JUSTIFIES_AND_COUNTS
							: NEITHER;
					}
					if (child.alternatingCustody) {
						// § 4.2 rows 3-4, main.pretty.js:16326, 16332
						return isPerson(child.mainFinancialContributor)
							? JUSTIFIES_AND_COUNTS
							: NEITHER;
					}
					// § 4.2 row 5, main.pretty.js:16340
					return JUSTIFIES_AND_COUNTS;
				}
				// § 4.2 row 6, main.pretty.js:16344
				return JUSTIFIES_AND_COUNTS;
			}
			if (child.parentalCare) {
				if (child.alternatingCustody) {
					// § 4.2 rows 7-8, main.pretty.js:16359, 16365
					return isPerson(child.mainFinancialContributor)
						? JUSTIFIES_AND_COUNTS
						: NEITHER;
				}
				// § 4.2 row 9, main.pretty.js:16370
				return NEITHER;
			}
			// § 4.2 row 10, main.pretty.js:16374
			return NEITHER;
		case "firstEducation":
			if (child.childInSameHousehold) {
				if (child.sameHousehold) {
					// § 4.2 rows 11-12, main.pretty.js:16389, 16395
					return isPerson(child.mainFinancialContributor)
						? JUSTIFIES_AND_COUNTS
						: NEITHER;
				}
				// § 4.2 rows 13-14, main.pretty.js:16404, 16407
				return child.financiallySupported ? JUSTIFIES_AND_COUNTS : NEITHER;
			}
			// § 4.2 rows 15-16, main.pretty.js:16416, 16419
			// The child counts but does not justify H.
			return child.financiallySupported
				? { justifiesH: false, counts: true }
				: NEITHER;
		case "other":
			// § 4.2 row 17, main.pretty.js:16424
			return NEITHER;
		default:
			return assertNever(child);
	}
}

/** Result for a married person (calculator-spec.md § 4.3, main.pretty.js:16152-16277). H is not used. */
export function childResultMarried(child: MarriedChild): { counts: boolean } {
	switch (child.group) {
		case "underage":
			if (child.childInSameHousehold) {
				if (child.sharedCustody) {
					if (child.sameHousehold) {
						// § 4.3 row 1, main.pretty.js:16175
						return { counts: true };
					}
					if (child.alternatingCustody) {
						// § 4.3 rows 2-3, main.pretty.js:16187, 16193
						return { counts: isPerson(child.mainFinancialContributor) };
					}
					// § 4.3 row 4, main.pretty.js:16201. A person who is not married gets yes here.
					return { counts: false };
				}
				// § 4.3 row 5, main.pretty.js:16205
				return { counts: true };
			}
			if (child.sharedCustody) {
				if (child.alternatingCustody) {
					// § 4.3 rows 6-7, main.pretty.js:16220, 16226
					return { counts: isPerson(child.mainFinancialContributor) };
				}
				// § 4.3 row 8, main.pretty.js:16231
				return { counts: false };
			}
			// § 4.3 row 9, main.pretty.js:16235
			return { counts: false };
		case "firstEducation":
			if (child.childInSameHousehold) {
				if (child.sameHousehold) {
					// § 4.3 row 10, main.pretty.js:16246
					return { counts: true };
				}
				// § 4.3 rows 11-12, main.pretty.js:16253, 16256
				return { counts: child.financiallySupported };
			}
			// § 4.3 rows 13-14, main.pretty.js:16265, 16268
			return { counts: child.financiallySupported };
		case "other":
			// § 4.3 row 15, main.pretty.js:16273
			return { counts: false };
		default:
			return assertNever(child);
	}
}
