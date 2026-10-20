import { describe, expect, test } from "bun:test";
import { TariffCode } from "./codes.ts";
import { ZH_2026, ZH_2026_CODES } from "./tariff-2026.generated.ts";

const digits = (from: number, to: number): number[] =>
	Array.from({ length: to - from + 1 }, (_, i) => from + i);

// source: calculator-spec.md § 6.1 and § 6.2, plan.md § 1.2 (H has 1-9 children)
const buildable: string[] = [
	...["A", "B", "C", "L", "M", "N"].flatMap((letter) =>
		digits(0, 9).map((d) => `${letter}${d}`),
	),
	...["H", "P"].flatMap((letter) => digits(1, 9).map((d) => `${letter}${d}`)),
]
	.flatMap((prefix) => [`${prefix}N`, `${prefix}Y`])
	.concat(["G9N", "Q9N"]);

describe("TariffCode", () => {
	test("holds every code that computeTariffCode can build", () => {
		expect(buildable.length).toBe(6 * 10 * 2 + 2 * 9 * 2 + 2);
		for (const code of buildable) {
			expect(TariffCode.safeParse(code).success).toBe(true);
		}
	});

	test("every buildable code has a table in the file", () => {
		for (const code of buildable) {
			expect(ZH_2026.tables[code]).toBeDefined();
		}
	});

	test("rejects codes the file does not hold", () => {
		for (const code of [
			"H0N",
			"P0N",
			"G0N",
			"Q0N",
			"G9Y",
			"A10N",
			"G",
			"Q",
			"",
		]) {
			expect(TariffCode.safeParse(code).success).toBe(false);
		}
	});

	test("is the generated list in file order", () => {
		expect(TariffCode.options).toEqual([...ZH_2026_CODES]);
	});
});
