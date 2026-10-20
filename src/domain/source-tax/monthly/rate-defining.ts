// Rate-defining salary (QST-SB-Lohn) of the monthly model.
// Sources: Swissdec ELM 6.0 § 10.6.1 and § 10.6.1.2, KS 45 § 6.4, § 6.5, § 6.6, ZStB 87.3 no. 9, plan.md § 3.

import type { TariffFile } from "../estv/record.ts";
import {
	assertNever,
	type Rappen,
	type Ratio,
	ratio,
	ratioAdd,
	ratioCompare,
	ratioDiv,
	ratioMul,
	ratioOf,
} from "../money.ts";
import { type Period, socialInsuranceDays } from "./sv-days.ts";

export type MonthInput<Code extends string> = {
	code: Code;
	pay:
		| {
				kind: "monthly";
				/** Salary-certificate items 1, 2 and 7 (Swissdec § 10.6.1). */
				periodic: Rappen;
				/**
				 * 13th month salary of the month. It is periodic pay. The code adds it to `periodic` and
				 * converts it with it (Swissdec ELM 6.0 § 10.6.1.2, decision D2).
				 * KS 45 § 6.3 adds a share of one full 13th month salary instead. The code does not implement it.
				 */
				thirteenthMonth: Rappen;
				period: Period;
		  }
		| { kind: "hourly"; pay: Rappen; hours: Ratio } // KS 45 § 6.5
		| { kind: "daily"; pay: Rappen; days: Ratio }; // KS 45 § 6.5
	/** Salary-certificate items 3, 4 and 5. It is not converted (Swissdec § 10.6.1). */
	aperiodic: Rappen;
	/**
	 * Taxable pay that does not enter the rate-defining salary, for example sick pay from the
	 * employer to an hourly employee (KS 45 § 6.5 example 6).
	 */
	taxableOnly: Rappen;
	/**
	 * KS 45 § 6.4, ZStB 87.3 no. 9. Levels are percent values as exact ratios,
	 * with 0 < ownPercent <= totalPercent <= 100. Decimal levels are allowed.
	 */
	employment:
		| { kind: "single" }
		| { kind: "totalIncomeKnown"; otherPeriodic: Rappen }
		| { kind: "levels"; ownPercent: Ratio; totalPercent: Ratio }
		| { kind: "ownLevelOnly"; ownPercent: Ratio }
		| { kind: "noLevel" };
};

/** Hours of one month (KS 45 § 6.5). */
const HOURS_PER_MONTH = 180n;
/** Days of one month: 21.667 (KS 45 § 6.5). */
const DAYS_PER_MONTH = ratio(21667n, 1000n);
/** Calendar days of one month for the rate (Swissdec § 10.6.1, QST-Tage). */
const QST_DAYS = 30n;

const HUNDRED = ratio(100n, 1n);

// The limit of 100% is a decision of this build, not a rule of KS 45 § 6.4.
// Swissdec appendix 1 M9 (September) has a total level of 101.21%.
// See the commented-out test at the end of rate-defining.test.ts.
function checkPercent(value: Ratio, name: string, max: Ratio): void {
	if (value.num <= 0n || ratioCompare(value, max) > 0) {
		throw new Error(
			`${name} must be above 0 and at most ${max.num}/${max.den}, got ${value.num}/${value.den}`,
		);
	}
}

function positive(value: Ratio, name: string): Ratio {
	if (value.num <= 0n) {
		throw new Error(`${name} must be positive`);
	}
	return value;
}

function applyEmployment(
	periodicPart: Ratio,
	employment: MonthInput<string>["employment"],
	file: TariffFile,
): Ratio {
	switch (employment.kind) {
		case "single":
			return periodicPart;
		case "totalIncomeKnown":
			return ratioAdd(periodicPart, ratioOf(employment.otherPeriodic));
		case "levels": {
			checkPercent(employment.totalPercent, "totalPercent", HUNDRED);
			checkPercent(
				employment.ownPercent,
				"ownPercent",
				employment.totalPercent,
			);
			return ratioMul(
				ratioDiv(periodicPart, employment.ownPercent),
				employment.totalPercent,
			);
		}
		case "ownLevelOnly": {
			checkPercent(employment.ownPercent, "ownPercent", HUNDRED);
			return ratioMul(ratioDiv(periodicPart, employment.ownPercent), HUNDRED);
		}
		case "noLevel": {
			const median = file.medians.MED;
			if (median === undefined) {
				throw new Error("The tariff file has no median (record 13, MED)");
			}
			return ratioAdd(periodicPart, ratioOf(median));
		}
		default:
			return assertNever(employment);
	}
}

export function rateDefiningSalary<Code extends string>(
	input: MonthInput<Code>,
	file: TariffFile,
): Ratio {
	const { pay, employment } = input;
	let converted: Ratio;
	switch (pay.kind) {
		case "monthly": {
			const periodic = ratio(
				BigInt(pay.periodic) + BigInt(pay.thirteenthMonth),
				1n,
			);
			const days = socialInsuranceDays(pay.period);
			const perMonth = ratioMul(
				ratioDiv(periodic, ratio(BigInt(days), 1n)),
				ratio(QST_DAYS, 1n),
			);
			converted = applyEmployment(perMonth, employment, file);
			break;
		}
		case "hourly": {
			// KS 45 § 6.5 covers more than one job and a start or end in the month.
			if (employment.kind !== "single") {
				throw new Error(
					"Hourly pay is converted to 180 hours. The employment must be single",
				);
			}
			const hours = positive(pay.hours, "hours");
			converted = ratioMul(
				ratioDiv(ratioOf(pay.pay), hours),
				ratio(HOURS_PER_MONTH, 1n),
			);
			break;
		}
		case "daily": {
			if (employment.kind !== "single") {
				throw new Error(
					"Daily pay is converted to 21.667 days. The employment must be single",
				);
			}
			const days = positive(pay.days, "days");
			converted = ratioMul(ratioDiv(ratioOf(pay.pay), days), DAYS_PER_MONTH);
			break;
		}
		default:
			return assertNever(pay);
	}
	return ratioAdd(converted, ratioOf(input.aperiodic));
}
