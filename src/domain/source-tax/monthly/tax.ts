// Source-tax amount of the monthly model.
// Sources: Swissdec ELM 6.0 § 10.6.1 and § 5.1.1 (rounding), KS 45 § 6.2, record-format spec § 4.4 (minimum tax),
// plan.md § 5, decision D1.

import { rateFor } from "../estv/lookup.ts";
import type { TariffFile } from "../estv/record.ts";
import {
	assertNever,
	type Rappen,
	type Ratio,
	rappen,
	ratio,
	ratioCompare,
	roundHalfUp,
} from "../money.ts";
import { type MonthInput, rateDefiningSalary } from "./rate-defining.ts";

export type TaxOptions = {
	/** Rappen. The default is 5 (decision D1). */
	roundingStep: 5 | 1;
};

const DEFAULT_OPTIONS: TaxOptions = { roundingStep: 5 };

/** A rate has two decimals as a percentage: hundredths of a percent, so divide by 10,000. */
const RATE_DENOMINATOR = 10000n;

function taxableSalaryOf(input: MonthInput<string>): Rappen {
	const { pay } = input;
	switch (pay.kind) {
		case "monthly":
			return rappen(
				pay.periodic +
					pay.thirteenthMonth +
					input.aperiodic +
					input.taxableOnly,
			);
		case "hourly":
		case "daily":
			return rappen(pay.pay + input.aperiodic + input.taxableOnly);
		default:
			return assertNever(pay);
	}
}

export function sourceTax<Code extends string>(
	input: MonthInput<Code>,
	file: TariffFile,
	options: TaxOptions = DEFAULT_OPTIONS,
): {
	code: Code;
	taxableSalary: Rappen;
	rateDefiningSalary: Ratio;
	/** Hundredths of a percent. */
	rate: number;
	tax: Rappen;
} {
	const taxableSalary = taxableSalaryOf(input);
	const rateDefining = rateDefiningSalary(input, file);
	const { rate, minTax } = rateFor(file, input.code, rateDefining);

	// The taxable salary times the rate, kept exact: an integer over 10,000 (KS 45 § 6.2).
	const raw = ratio(BigInt(taxableSalary) * BigInt(rate), RATE_DENOMINATOR);
	const floor = ratio(BigInt(minTax), 1n);
	const tax = ratioCompare(raw, floor) >= 0 ? raw : floor;
	return {
		code: input.code,
		taxableSalary,
		rateDefiningSalary: rateDefining,
		rate,
		tax: rappen(Number(roundHalfUp(tax, BigInt(options.roundingStep)))),
	};
}
