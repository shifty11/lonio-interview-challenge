import { describe, expect, test } from "bun:test";
import {
	chf,
	formatChf,
	rappen,
	ratio,
	ratioCompare,
	ratioDiv,
	ratioEquals,
	ratioMul,
	ratioOf,
	roundHalfUp,
} from "./money.ts";

describe("rappen and chf", () => {
	test("chf parses amounts with 0, 1 and 2 decimals", () => {
		expect(chf("850.40")).toBe(rappen(85040));
		expect(chf("6000")).toBe(rappen(600000));
		expect(chf("0.5")).toBe(rappen(50));
	});
	test("chf rejects three decimals", () => {
		expect(() => chf("1.234")).toThrow();
	});
	test("rappen rejects a fraction", () => {
		expect(() => rappen(1.5)).toThrow();
	});
});

describe("ratio", () => {
	test("rejects a non-positive denominator", () => {
		expect(() => ratio(1n, 0n)).toThrow();
		expect(() => ratio(1n, -1n)).toThrow();
	});
	test("compares by cross-multiplication", () => {
		expect(ratioEquals(ratio(1n, 2n), ratio(2n, 4n))).toBe(true);
		expect(ratioCompare(ratio(1n, 3n), ratio(1n, 2n))).toBe(-1);
		expect(ratioCompare(ratio(3n, 2n), ratio(1n, 1n))).toBe(1);
	});
	test("mul and div keep the denominator positive", () => {
		const half = ratioDiv(ratioOf(rappen(1)), ratioOf(rappen(-2)));
		expect(half.den > 0n).toBe(true);
		expect(ratioEquals(half, ratio(-1n, 2n))).toBe(true);
		expect(
			ratioEquals(ratioMul(ratio(1n, 2n), ratio(2n, 3n)), ratio(1n, 3n)),
		).toBe(true);
	});
});

describe("roundHalfUp", () => {
	// source: spec.md § 11 example and the plan.md appendix rows
	const cases: {
		name: string;
		value: [bigint, bigint];
		step: bigint;
		expected: bigint;
	}[] = [
		{
			name: "38632.5 to 5 (spec § 11)",
			value: [386325n, 10n],
			step: 5n,
			expected: 38635n,
		},
		{
			name: "204.096 to 5 (appendix row 9)",
			value: [204096n, 1000n],
			step: 5n,
			expected: 205n,
		},
		{
			name: "21728 to 5 (appendix row 6)",
			value: [21728n, 1n],
			step: 5n,
			expected: 21730n,
		},
		{
			name: "11366.4 to 5 (KS 45)",
			value: [113664n, 10n],
			step: 5n,
			expected: 11365n,
		},
		{ name: "2.5 to 1 goes up", value: [5n, 2n], step: 1n, expected: 3n },
		{
			name: "exact half of the step goes up",
			value: [5n, 2n],
			step: 5n,
			expected: 5n,
		},
		{
			name: "just below half goes down",
			value: [2499n, 1000n],
			step: 5n,
			expected: 0n,
		},
	];
	for (const c of cases) {
		test(c.name, () => {
			expect(roundHalfUp(ratio(...c.value), c.step)).toBe(c.expected);
		});
	}
});

describe("formatChf", () => {
	test("formats with a thousands separator and two decimals", () => {
		expect(formatChf(chf("156499.50"))).toBe("156'499.50");
		expect(formatChf(chf("8.05"))).toBe("8.05");
	});
});
