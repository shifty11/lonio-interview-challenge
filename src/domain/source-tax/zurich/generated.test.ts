import { describe, expect, test } from "bun:test";
import {
	decodeSource,
	OUTPUT_PATH,
	render,
	SOURCE_PATH,
} from "../../../../scripts/gen-tariff-data.ts";
import { parseTariffFileWithWarnings } from "../estv/record.ts";
import { rappen } from "../money.ts";
import { ZH_2026, ZH_2026_CODES } from "./tariff-2026.generated.ts";

const sourceText = decodeSource(await Bun.file(SOURCE_PATH).arrayBuffer());

describe("generated Zurich 2026 data", () => {
	test("regenerating gives the committed file", async () => {
		expect(render(sourceText)).toBe(await Bun.file(OUTPUT_PATH).text());
	});

	test("the output is deterministic", () => {
		expect(render(sourceText)).toBe(render(sourceText));
	});

	// source: plan.md § 4.2 and § 6, tar26zh.txt record counts
	test("holds the 160 codes of record 06 and the 6 of record 11 in file order", () => {
		expect(ZH_2026_CODES.length).toBe(166);
		expect(ZH_2026_CODES[0]).toBe("A0N");
		expect(ZH_2026_CODES.slice(-6)).toEqual([
			"HEN",
			"HEY",
			"MEN",
			"MEY",
			"NON",
			"NOY",
		]);
		expect(Object.keys(ZH_2026.tables)).toEqual([...ZH_2026_CODES]);
	});

	test("the typed data equals a fresh parse of the real file", () => {
		const parsed = parseTariffFileWithWarnings(sourceText);
		expect(ZH_2026).toEqual(parsed.file);
	});

	test("the real file has 79 progressive tables of 315 bands", () => {
		const progressive = Object.values(ZH_2026.tables).filter(
			(bands) => bands.length === 315,
		);
		expect(progressive.length).toBe(79);
	});

	test("medians and fees", () => {
		expect(ZH_2026.medians.MED).toBe(rappen(587500));
		expect(ZH_2026.fees).toEqual({ PEL: 200, PPA: 200, PSP: 1000 });
	});
});

describe("the real file", () => {
	test("parses with no error and gives only rate warnings", () => {
		const { warnings } = parseTariffFileWithWarnings(sourceText);
		expect(warnings.length).toBe(1898);
		// plan.md § 11.1: the low bands carry the personal tax, so rates fall at the start of a table.
		expect(
			warnings.every((w) =>
				/^line \d+: table [A-Z0-9]+: rate goes down/.test(w),
			),
		).toBe(true);
	});
});
