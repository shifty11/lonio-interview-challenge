import { describe, expect, test } from "bun:test";
import { chf, rappen, ratio, ratioOf } from "../money.ts";
import { ZH_2026 } from "../zurich/tariff-2026.generated.ts";
import { rateFor } from "./lookup.ts";
import type { TariffFile } from "./record.ts";

const at = (value: number) => ratioOf(rappen(value));

describe("rateFor on the real 2026 Zurich file", () => {
	// source: spec.md § 12 (lookup.test.ts), plan.md § 4.3, decision D3
	test("every code and every band: lower edge, upper edge and a value inside give the file rate", () => {
		let checked = 0;
		for (const [code, bands] of Object.entries(ZH_2026.tables)) {
			bands.forEach((band, index) => {
				const isLast = index === bands.length - 1;
				const expected = { rate: band.rate, minTax: band.minTax, band };
				expect(rateFor(ZH_2026, code, at(band.from))).toEqual(expected);
				if (!isLast) {
					expect(
						rateFor(ZH_2026, code, at(band.from + band.width - 1)),
					).toEqual(expected);
					// halves of a Rappen stay inside the band: from + width - 1/2
					expect(
						rateFor(
							ZH_2026,
							code,
							ratio(BigInt(2 * (band.from + band.width) - 1), 2n),
						),
					).toEqual(expected);
				}
				const inside = band.from + Math.floor((isLast ? 1000 : band.width) / 2);
				expect(rateFor(ZH_2026, code, at(inside))).toEqual(expected);
				checked++;
			});
		}
		// 79 progressive tables of 315 bands, 81 flat codes of record 06, 6 tables of record 11
		expect(checked).toBe(79 * 315 + 81 + 6);
	});

	test("the last band of every table covers CHF 1,000,000 and more", () => {
		for (const [code, bands] of Object.entries(ZH_2026.tables)) {
			const last = bands[bands.length - 1];
			expect(rateFor(ZH_2026, code, at(chf("1000000"))).band).toBe(
				last ?? null,
			);
			expect(rateFor(ZH_2026, code, at(chf("10000000"))).band).toBe(
				last ?? null,
			);
		}
	});

	test("below CHF 1 the rate and the tax are 0", () => {
		for (const x of [ratioOf(rappen(0)), at(99), ratio(199n, 2n)]) {
			expect(rateFor(ZH_2026, "A0N", x)).toEqual({
				rate: 0,
				minTax: rappen(0),
				band: null,
			});
		}
		expect(rateFor(ZH_2026, "A0N", at(100)).band).not.toBeNull();
	});

	test("D3: CHF 850.40 is in band 801-850", () => {
		const result = rateFor(ZH_2026, "A0N", at(chf("850.40")));
		expect(result.band?.from).toBe(chf("801"));
		expect(result.band?.width).toBe(chf("50"));
		expect(result.rate).toBe(24);
	});

	// source: plan.md appendix (rates of the worked examples)
	const appendix: [string, string, number][] = [
		["A0N", "6000", 679],
		["B2Y", "9000", 328],
		["C0N", "7500", 889],
		["H1Y", "5200", 195],
		["G9N", "3000", 519],
		["A0N", "16000", 1595],
		["A0N", "120000", 3127],
	];
	for (const [code, salary, rate] of appendix) {
		test(`appendix rate: ${code} at CHF ${salary}`, () => {
			expect(rateFor(ZH_2026, code, at(chf(salary))).rate).toBe(rate);
		});
	}

	test("a flat-rate table gives its rate at every salary", () => {
		expect(rateFor(ZH_2026, "L0N", at(chf("1"))).rate).toBe(450);
		expect(rateFor(ZH_2026, "L0N", at(chf("999999"))).rate).toBe(450);
		expect(rateFor(ZH_2026, "NON", at(chf("1000000"))).rate).toBe(0);
	});

	test("an unknown code throws", () => {
		expect(() => rateFor(ZH_2026, "XXX", at(chf("1000")))).toThrow(/XXX/);
	});
});

describe("rateFor on a hand-built file", () => {
	const file: TariffFile = {
		canton: "XX",
		validFrom: "20260101",
		medians: {},
		fees: {},
		tables: {
			T: [
				{ from: rappen(100), width: rappen(200), minTax: rappen(5), rate: 10 },
				{ from: rappen(300), width: rappen(100), minTax: rappen(7), rate: 20 },
			],
		},
	};
	test("the half-open interval puts the shared edge in the upper band", () => {
		expect(rateFor(file, "T", at(299)).rate).toBe(10);
		expect(rateFor(file, "T", at(300)).rate).toBe(20);
		expect(rateFor(file, "T", ratio(599n, 2n)).rate).toBe(10);
	});
	test("the minimum tax comes from the band", () => {
		expect(rateFor(file, "T", at(150)).minTax).toBe(rappen(5));
	});
	test("the last band has no upper bound", () => {
		expect(rateFor(file, "T", at(400)).rate).toBe(20);
		expect(rateFor(file, "T", at(99999999)).rate).toBe(20);
	});
});

describe("rateFor reads only own tables", () => {
	// source: spec.md § 8 (an unknown code throws); "constructor" is a property of every object, not a table
	test("code `constructor` throws unknown code", () => {
		expect(() => rateFor(ZH_2026, "constructor", at(chf("1000")))).toThrow(
			/Unknown tariff code: constructor/,
		);
	});
});
