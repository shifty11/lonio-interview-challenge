import { describe, expect, test } from "bun:test";
import { residenceResult } from "./residence.ts";
import { ResidenceSchema } from "./schema.ts";

const JS = "sources/zh/calculator/main.pretty.js";

type Case = {
	source: string;
	residence: Record<string, unknown>;
	borderCrosser: boolean;
	override: "noSourceTax" | null;
	remark: "dtaReservation" | null;
};

const abroad = { residenceInSwitzerland: false } as const;
const de = { ...abroad, countryOfResidence: "DE" } as const;
const li = { ...abroad, countryOfResidence: "LI" } as const;

// source: calculator-spec.md § 5.1 (Zl.getResult, main.pretty.js:17116-17198)
const cases: Case[] = [
	{
		source: `§ 5.1 row 1 Switzerland, ${JS}:17130`,
		residence: { residenceInSwitzerland: true },
		borderCrosser: false,
		override: null,
		remark: null,
	},
	{
		source: `§ 5.1 row 2 DE daily return, Gre-1/Gre-2, ${JS}:17141`,
		residence: { ...de, dailyReturnToGermany: true, gre1Gre2: true },
		borderCrosser: true,
		override: null,
		remark: null,
	},
	{
		source: `§ 5.1 row 3 DE daily return, no Gre-1/Gre-2, ${JS}:17141`,
		residence: { ...de, dailyReturnToGermany: true, gre1Gre2: false },
		borderCrosser: false,
		override: null,
		remark: null,
	},
	{
		source: `§ 5.1 row 4 DE no daily return, reasonable, Gre-3, ${JS}:17153`,
		residence: {
			...de,
			dailyReturnToGermany: false,
			dailyReturnToCountryOfResidenceReasonable: true,
			gre3: true,
		},
		borderCrosser: false,
		override: null,
		remark: null,
	},
	{
		source: `§ 5.1 row 5 DE no daily return, reasonable, no Gre-3, ${JS}:17153`,
		residence: {
			...de,
			dailyReturnToGermany: false,
			dailyReturnToCountryOfResidenceReasonable: true,
			gre3: false,
		},
		borderCrosser: true,
		override: null,
		remark: null,
	},
	{
		source: `§ 5.1 row 6 DE no daily return, not reasonable, ${JS}:17158`,
		residence: {
			...de,
			dailyReturnToGermany: false,
			dailyReturnToCountryOfResidenceReasonable: false,
		},
		borderCrosser: false,
		override: null,
		remark: null,
	},
	{
		source: `§ 5.1 row 7 LI daily return, ${JS}:17165`,
		residence: { ...li, dailyReturnToLiechtenstein: true },
		borderCrosser: false,
		override: "noSourceTax",
		remark: "dtaReservation",
	},
	{
		source: `§ 5.1 row 8 LI no daily return, over 45 days, ${JS}:17176`,
		residence: {
			...li,
			dailyReturnToLiechtenstein: false,
			moreThanFortyFiveNonReturnDays: true,
		},
		borderCrosser: false,
		override: null,
		remark: "dtaReservation",
	},
	{
		source: `§ 5.1 row 9 LI no daily return, 45 days or fewer, ${JS}:17185`,
		residence: {
			...li,
			dailyReturnToLiechtenstein: false,
			moreThanFortyFiveNonReturnDays: false,
		},
		borderCrosser: false,
		override: "noSourceTax",
		remark: "dtaReservation",
	},
	{
		source: `§ 5.1 row 10 other country, ${JS}:17193`,
		residence: { ...abroad, countryOfResidence: "other" },
		borderCrosser: false,
		override: null,
		remark: null,
	},
];

describe("residenceResult", () => {
	for (const c of cases) {
		test(c.source, () => {
			const residence = ResidenceSchema.parse(c.residence);
			expect(residenceResult(residence)).toEqual({
				borderCrosser: c.borderCrosser,
				override: c.override,
				remark: c.remark,
			});
		});
	}
});
