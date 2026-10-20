// Swissdec ELM 6.0 appendix 1, monthly workbook (sources/rules/Anhang_1_QST_Berechnung_Monat_20260306.xlsx).
// The cases come from the sheets M1-M47 that are in scope: no correction, no canton change, no annual model.
// scripts/extract-swissdec-appendix.py reads these rows of each sheet and month column:
//   QST-Tarifcode, SV-Tage, QST-Satz <code>, QST-Betrag <code>, QST-Lohn <code>, QST-SB-aperiodisch,
//   QST-SB-Lohn, "13. Monatslohn", BG AG 1, BG andere AG, BG Total, Weitere Beschäftigung (X),
//   Anzahl Stunden, Eintritt, Austritt.
// The rate of each month comes from the case sheet (Bern rates), so each month gets a one-band tariff file.
// The sheets do not round the tax. The test compares the tax at `roundingStep: 1` within 1 Rappen.
// notes/impl-result.md lists every skipped sheet and the reason.

import { describe, expect, test } from "bun:test";
import type { TariffFile } from "../estv/record.ts";
import {
	chf,
	type Ratio,
	rappen,
	ratio,
	ratioEquals,
	ratioMul,
	ratioOf,
	roundHalfUp,
} from "../money.ts";
import { TariffCode } from "../zurich/codes.ts";
import type { MonthInput } from "./rate-defining.ts";
import { rateDefiningSalary } from "./rate-defining.ts";
import { type Period, socialInsuranceDays } from "./sv-days.ts";
import {
	type AppendixMonth,
	type AppendixPeriod,
	SWISSDEC_APPENDIX_MONTHLY,
} from "./swissdec-appendix.data.ts";
import { sourceTax } from "./tax.ts";

const MONTH_NAMES = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

function periodOf(period: AppendixPeriod): Period {
	switch (period.kind) {
		case "fullMonth":
			return period;
		case "start":
		case "end": {
			const [year, month, day] = period.date;
			return { kind: period.kind, date: { year, month, day } };
		}
		case "startAndEnd": {
			const [startYear, startMonth, startDay] = period.start;
			const [endYear, endMonth, endDay] = period.end;
			return {
				kind: "startAndEnd",
				start: { year: startYear, month: startMonth, day: startDay },
				end: { year: endYear, month: endMonth, day: endDay },
			};
		}
		default:
			return period satisfies never;
	}
}

function inputOf(month: AppendixMonth): MonthInput {
	const base = {
		code: TariffCode.parse(month.code),
		aperiodic: rappen(month.aperiodic),
		employment: month.employment,
	};
	if (month.hourly !== undefined) {
		return {
			...base,
			pay: {
				kind: "hourly",
				pay: rappen(month.hourly.pay),
				hours: ratio(BigInt(month.hourly.hours), 1n),
			},
		};
	}
	return {
		...base,
		pay: {
			kind: "monthly",
			periodic: rappen(month.periodic),
			thirteenthMonth: rappen(month.thirteenthMonth),
			period: periodOf(month.period),
		},
	};
}

/** A file with one open band at the rate of the sheet. */
function fileOf(month: AppendixMonth): TariffFile {
	return {
		canton: "BE",
		validFrom: "20210101",
		medians: {},
		fees: {},
		tables: {
			[month.code]: [
				{
					from: rappen(100),
					width: rappen(100000000),
					minTax: rappen(0),
					rate: month.rate,
				},
			],
		},
	};
}

/** The sheet shows CHF with up to four decimals. Returns units of 1/10,000 CHF. */
function sheetUnits(chf: string): bigint {
	const [whole = "0", decimals = ""] = chf.split(".");
	return BigInt(whole + decimals.padEnd(4, "0"));
}

function ourUnits(value: Ratio): bigint {
	// Rappen x 100 = 1/10,000 CHF
	return roundHalfUp(ratioMul(value, ratioOf(rappen(100))), 1n);
}

describe("Swissdec appendix 1, monthly model", () => {
	test("at least 8 cases are in scope", () => {
		expect(SWISSDEC_APPENDIX_MONTHLY.length).toBeGreaterThanOrEqual(8);
	});

	for (const appendixCase of SWISSDEC_APPENDIX_MONTHLY) {
		describe(`${appendixCase.sheet}: ${appendixCase.title}`, () => {
			for (const month of appendixCase.months) {
				const name = `${appendixCase.sheet} ${MONTH_NAMES[month.month - 1]} ${appendixCase.year} (${month.code})`;
				test(name, () => {
					const input = inputOf(month);
					const file = fileOf(month);

					// The social-insurance days of the sheet match the model.
					if (input.pay.kind === "monthly") {
						expect(socialInsuranceDays(input.pay.period)).toBe(month.svDays);
					}

					// The rate-defining salary: exact when the sheet shows at most two decimals,
					// else equal to the sheet within its 4 printed decimals.
					const rateDefining = rateDefiningSalary(input, file);
					const sheetValue = month.expectedRateDefining;
					const decimals = sheetValue.split(".")[1] ?? "";
					if (decimals.length <= 2) {
						expect(ratioEquals(rateDefining, ratioOf(chf(sheetValue)))).toBe(
							true,
						);
					} else {
						const difference = ourUnits(rateDefining) - sheetUnits(sheetValue);
						expect(difference >= -1n && difference <= 1n).toBe(true);
					}

					// The tax amount at CHF 0.01 steps is within 1 Rappen of the unrounded sheet value.
					if (month.expectedTax !== null) {
						const result = sourceTax(input, file, { roundingStep: 1 });
						expect(
							Math.abs(result.tax - month.expectedTax),
						).toBeLessThanOrEqual(1);
						expect(result.rate).toBe(month.rate);
					}
				});
			}
		});
	}
});
