// Band lookup. Source: plan.md § 4.3, decision D3 (half-open interval, open last band).

import {
	type Rappen,
	type Ratio,
	rappen,
	ratioCompare,
	ratioOf,
} from "../money.ts";
import type { Band, TariffFile } from "./record.ts";

/** CHF 1. Below this rate-defining salary the rate is 0 (plan.md § 4.3). */
const MIN_RATE_DEFINING = ratioOf(rappen(100));

export function rateFor(
	file: TariffFile,
	code: string,
	rateDefining: Ratio,
): { rate: number; minTax: Rappen; band: Band | null } {
	const bands = Object.hasOwn(file.tables, code)
		? file.tables[code]
		: undefined;
	if (bands === undefined || bands.length === 0) {
		throw new Error(`Unknown tariff code: ${code}`);
	}
	if (ratioCompare(rateDefining, MIN_RATE_DEFINING) < 0) {
		return { rate: 0, minTax: rappen(0), band: null };
	}

	// Binary search: the last band with from <= x. The last band of a table has no upper bound.
	let low = 0;
	let high = bands.length - 1;
	while (low < high) {
		const middle = Math.ceil((low + high) / 2);
		const band = bands[middle];
		if (
			band !== undefined &&
			ratioCompare(ratioOf(band.from), rateDefining) <= 0
		) {
			low = middle;
		} else {
			high = middle - 1;
		}
	}
	const band = bands[low];
	if (
		band === undefined ||
		ratioCompare(ratioOf(band.from), rateDefining) > 0
	) {
		throw new Error(`No band of table ${code} holds the rate-defining salary`);
	}
	const isLast = low === bands.length - 1;
	if (
		!isLast &&
		ratioCompare(rateDefining, ratioOf(rappen(band.from + band.width))) >= 0
	) {
		throw new Error(`Table ${code} has a gap after band ${band.from}`);
	}
	return { rate: band.rate, minTax: band.minTax, band };
}
