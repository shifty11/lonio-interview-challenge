// Source: calc-spec § 6.1 and § 6.2 (the letter, the digit and the church flag) and § 7.4
// (G and Q have no church-tax part).

import { describe, expect, test } from "bun:test";
import { describeTariffCode, describeTariffParts } from "./meaning.ts";
import { ZH_2026_CODES } from "./tariff-2026.generated.ts";

const cases = [
	["A0N", "single, 0 children, no church tax", "calc-spec § 6.1"],
	["C1Y", "married, partner employed, 1 child, church tax", "calc-spec § 6.1"],
	[
		"H1Y",
		"single with a child in the household, 1 child, church tax",
		"calc-spec § 6.1",
	],
	[
		"L0N",
		"border crosser, single (A), 0 children, no church tax",
		"calc-spec § 6.1",
	],
	["G9N", "replacement income", "calc-spec § 6.2, § 7.4"],
	["Q9N", "replacement income, border crosser", "calc-spec § 6.2, § 7.4"],
] as const;

describe("describeTariffCode", () => {
	for (const [code, meaning, source] of cases) {
		test(`${code} (${source})`, () => {
			expect(describeTariffCode(code)).toBe(meaning);
		});
	}
});

describe("describeTariffParts", () => {
	test("C2Y has a text for each part (calc-spec § 6.1)", () => {
		expect(describeTariffParts("C2Y")).toEqual([
			{ name: "letter", char: "C", text: "married, partner employed" },
			{ name: "digit", char: "2", text: "2 children" },
			{ name: "church", char: "Y", text: "church tax" },
		]);
	});

	test("G9N has no children and no church meaning (calc-spec § 7.4)", () => {
		expect(describeTariffParts("G9N")).toEqual([
			{ name: "letter", char: "G", text: "replacement income" },
			{ name: "digit", char: "9", text: "not used" },
			{ name: "church", char: "N", text: "not used" },
		]);
	});
});

describe("every code of the tariff file", () => {
	// HEN, HEY, MEN, MEY, NON and NOY have no digit. The app never computes them.
	test("with a digit has a meaning (tariff file, records 06 and 11)", () => {
		for (const code of ZH_2026_CODES) {
			if (/^[A-Z]\d[YN]$/.test(code)) {
				expect(describeTariffCode(code).length).toBeGreaterThan(0);
			}
		}
	});
});
