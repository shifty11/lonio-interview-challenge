// Residence result. Source: calculator-spec.md § 5.1,
// Zurich calculator bundle sources/zh/calculator/main.pretty.js (Zl.getResult, lines 17116-17198).

import { assertNever } from "../money.ts";
import type { Residence } from "./schema.ts";

export type ResidenceResult = {
	borderCrosser: boolean;
	override: "noSourceTax" | null;
	remark: "dtaReservation" | null;
};

const NOT_BORDER: ResidenceResult = {
	borderCrosser: false,
	override: null,
	remark: null,
};
const BORDER: ResidenceResult = {
	borderCrosser: true,
	override: null,
	remark: null,
};

export function residenceResult(residence: Residence): ResidenceResult {
	if (residence.residenceInSwitzerland) {
		// § 5.1 row 1, main.pretty.js:17130
		return NOT_BORDER;
	}
	switch (residence.countryOfResidence) {
		case "DE":
			if (residence.dailyReturnToGermany) {
				// § 5.1 rows 2-3, main.pretty.js:17141
				return residence.gre1Gre2 ? BORDER : NOT_BORDER;
			}
			if (residence.dailyReturnToCountryOfResidenceReasonable) {
				// § 5.1 rows 4-5, main.pretty.js:17153
				return residence.gre3 ? NOT_BORDER : BORDER;
			}
			// § 5.1 row 6, main.pretty.js:17158
			return NOT_BORDER;
		case "LI":
			if (residence.dailyReturnToLiechtenstein) {
				// § 5.1 row 7, main.pretty.js:17165
				return {
					borderCrosser: false,
					override: "noSourceTax",
					remark: "dtaReservation",
				};
			}
			if (residence.moreThanFortyFiveNonReturnDays) {
				// § 5.1 row 8, main.pretty.js:17176. The remark shows. The code stays.
				return {
					borderCrosser: false,
					override: null,
					remark: "dtaReservation",
				};
			}
			// § 5.1 row 9, main.pretty.js:17185
			return {
				borderCrosser: false,
				override: "noSourceTax",
				remark: "dtaReservation",
			};
		case "other":
			// § 5.1 row 10, main.pretty.js:17193
			return NOT_BORDER;
		default:
			return assertNever(residence);
	}
}
