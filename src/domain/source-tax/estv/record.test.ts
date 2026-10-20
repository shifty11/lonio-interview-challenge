import { describe, expect, test } from "bun:test";
import { rappen } from "../money.ts";
import {
	type Band,
	parseTariffFile,
	parseTariffFileWithWarnings,
	tariffFileFromData,
	tariffFileToData,
} from "./record.ts";

const froms = (bands: readonly Band[] | undefined): number[] =>
	(bands ?? []).map((b) => b.from);

type Row = {
	type?: string;
	tx?: string;
	canton?: string;
	code: string;
	validFrom?: string;
	from: number;
	width: number;
	children?: number;
	minTax?: number;
	rate: number;
};

function line(r: Row): string {
	return (
		(r.type ?? "06") +
		(r.tx ?? "01") +
		(r.canton ?? "ZH") +
		r.code.padEnd(10) +
		(r.validFrom ?? "20260101") +
		String(r.from).padStart(9, "0") +
		String(r.width).padStart(9, "0") +
		" " +
		String(r.children ?? Number(r.code.charAt(1))).padStart(2, "0") +
		String(r.minTax ?? 0).padStart(9, "0") +
		String(r.rate).padStart(5, "0") +
		"   "
	);
}

const header = `00ZH${" ".repeat(12)}20251208${" ".repeat(70)}`;

function file(rows: string[], count = rows.length + 2): string {
	const trailer = `99${" ".repeat(15)}ZH${String(count).padStart(8, "0")}${" ".repeat(12)}`;
	return [header, ...rows, trailer].join("\r\n");
}

const good = [
	line({ code: "A0N", from: 100, width: 80000, rate: 25 }),
	line({ code: "A0N", from: 80100, width: 5000, rate: 24 }),
	line({ code: "A0N", from: 85100, width: 5000, rate: 23 }),
	line({ code: "P1Y", from: 100, width: 100000000, children: 1, rate: 450 }),
	line({
		type: "11",
		code: "HEN",
		from: 100,
		width: 100000000,
		children: 0,
		rate: 2500,
	}),
	line({
		type: "12",
		code: "PEL",
		from: 100,
		width: 99999900,
		children: 0,
		rate: 200,
	}),
	line({
		type: "13",
		code: "MED",
		from: 100,
		width: 99999900,
		children: 0,
		minTax: 587500,
		rate: 0,
	}),
];

describe("parseTariffFile", () => {
	test("parses a valid file", () => {
		const parsed = parseTariffFile(file(good));
		expect(parsed.canton).toBe("ZH");
		expect(parsed.validFrom).toBe("20260101");
		expect(froms(parsed.tables.A0N)).toEqual([100, 80100, 85100]);
		expect(parsed.tables.A0N?.[0]).toEqual({
			from: rappen(100),
			width: rappen(80000),
			minTax: rappen(0),
			rate: 25,
		});
		expect(Object.keys(parsed.tables)).toEqual(["A0N", "P1Y", "HEN"]);
		expect(parsed.medians.MED).toBe(rappen(587500));
		expect(parsed.fees.PEL).toBe(200);
	});

	test("sorts the bands by from", () => {
		const shuffled = [
			good[2] ?? "",
			good[0] ?? "",
			good[1] ?? "",
			...good.slice(3),
		];
		expect(froms(parseTariffFile(file(shuffled)).tables.A0N)).toEqual([
			100, 80100, 85100,
		]);
	});

	test("accepts LF line ends and a final line end", () => {
		expect(
			parseTariffFile(`${file(good).replaceAll("\r\n", "\n")}\n`).canton,
		).toBe("ZH");
	});

	test("warns when a rate goes down as income goes up", () => {
		const { warnings } = parseTariffFileWithWarnings(file(good));
		expect(warnings.length).toBe(2);
		expect(warnings[0]).toContain("line 3");
	});

	// source: spec.md § 6, one broken fixture per check
	const broken: { name: string; text: string; message: RegExp }[] = [
		{
			name: "no header",
			text: file(good).replace(/^00/, "05"),
			message: /line 1: .*header/,
		},
		{
			name: "no trailer",
			text: file(good).replace(/99 +ZH/, "98 ZH"),
			message: /trailer record 99 is missing/,
		},
		{
			name: "wrong record count",
			text: file(good, 99),
			message: /trailer counts 99 records, the file has 9/,
		},
		{
			name: "table does not start at 1",
			text: file([line({ code: "A0N", from: 200, width: 100, rate: 1 })]),
			message: /line 2: table A0N: band from 200 leaves a gap before 100/,
		},
		{
			name: "gap inside a table",
			text: file([
				line({ code: "A0N", from: 100, width: 100, rate: 1 }),
				line({ code: "A0N", from: 300, width: 100, rate: 1 }),
			]),
			message: /line 3: .*gap before 200/,
		},
		{
			name: "overlap inside a table",
			text: file([
				line({ code: "A0N", from: 100, width: 100, rate: 1 }),
				line({ code: "A0N", from: 150, width: 100, rate: 1 }),
			]),
			message: /line 3: .*overlaps 200/,
		},
		{
			name: "children field differs from the code digit",
			text: file([
				line({ code: "A2N", from: 100, width: 100, children: 1, rate: 1 }),
			]),
			message: /line 2: children field 1 does not match code A2N/,
		},
		{
			name: "G9N with a children field of 9",
			text: file([
				line({ code: "G9N", from: 100, width: 100, children: 9, rate: 1 }),
			]),
			message:
				/line 2: children field 9 does not match code G9N \(expected 0\)/,
		},
		{
			name: "transaction is not 01",
			text: file([
				line({ tx: "02", code: "A0N", from: 100, width: 100, rate: 1 }),
			]),
			message: /line 2: transaction "02" is not 01/,
		},
		{
			name: "non-numeric rate",
			text: file([
				line({ code: "A0N", from: 100, width: 100, rate: 1 }).replace(
					"00001   ",
					"0O001   ",
				),
			]),
			message: /line 2: field rate/,
		},
		{
			name: "canton differs from the header",
			text: file([
				line({ code: "A0N", from: 100, width: 100, rate: 1 }),
				line({ canton: "BE", code: "A1N", from: 100, width: 100, rate: 1 }),
			]),
			message: /line 3: canton "BE" differs from the header/,
		},
		{
			name: "valid-from differs",
			text: file([
				line({ code: "A0N", from: 100, width: 100, rate: 1 }),
				line({
					code: "A1N",
					validFrom: "20270101",
					from: 100,
					width: 100,
					rate: 1,
				}),
			]),
			message: /line 3: valid-from 20270101 differs from 20260101/,
		},
		{
			name: "no data records",
			text: file([]),
			message: /the file has no data records/,
		},
		{
			name: "record 11 HEN with a children field of 1",
			text: file([
				line({
					type: "11",
					code: "HEN",
					from: 100,
					width: 100,
					children: 1,
					rate: 2500,
				}),
			]),
			message:
				/line 2: children field 1 does not match code HEN \(expected 0\)/,
		},
		{
			name: "Q9N with a children field of 9",
			text: file([
				line({ code: "Q9N", from: 100, width: 100, children: 9, rate: 450 }),
			]),
			message:
				/line 2: children field 9 does not match code Q9N \(expected 0\)/,
		},
		{
			name: "unknown record type",
			text: file([
				line({ type: "07", code: "A0N", from: 100, width: 100, rate: 1 }),
			]),
			message: /line 2: unknown record type "07"/,
		},
	];
	for (const c of broken) {
		test(`rejects: ${c.name}`, () => {
			expect(() => parseTariffFile(c.text)).toThrow(c.message);
		});
	}
});

describe("tariffFileFromData", () => {
	test("round-trips through tariffFileToData", () => {
		const parsed = parseTariffFile(file(good));
		expect(tariffFileFromData(tariffFileToData(parsed))).toEqual(parsed);
	});
	test("rejects a fraction", () => {
		expect(() =>
			tariffFileFromData({
				canton: "ZH",
				validFrom: "20260101",
				tables: { A0N: [[1.5, 1, 0, 1]] },
				medians: {},
				fees: {},
			}),
		).toThrow();
	});
});

describe("parseTariffFile with a code that is an object property", () => {
	// source: spec.md § 6 (tables are keyed by the code in the file)
	test("a table named `valueOf` is read as a table", () => {
		const text = file([
			line({ code: "valueOf", from: 100, width: 100, children: 0, rate: 1 }),
		]);
		const tables = parseTariffFile(text).tables;
		expect(Object.keys(tables)).toEqual(["valueOf"]);
		expect(Object.hasOwn(tables, "valueOf")).toBe(true);
	});
});
