// Source: calc-spec § 6.1 and § 6.2 (the letter, the digit and the church flag).

import { describe, expect, test } from "bun:test";
import { describeTariffCode } from "./meaning.ts";

const cases = [
	["A0N", "single, no child with the H tariff, 0 children, no church tax"],
	["C1Y", "married, partner employed, 1 child, church tax"],
	["H1Y", "single with a child in the household, 1 child, church tax"],
	["L0N", "border crosser, single (A), 0 children, no church tax"],
	["G9N", "replacement income, no church tax"],
	["Q9N", "replacement income, border crosser, no church tax"],
] as const;

describe("describeTariffCode", () => {
	for (const [code, meaning] of cases) {
		test(code, () => {
			expect(describeTariffCode(code)).toBe(meaning);
		});
	}
});
