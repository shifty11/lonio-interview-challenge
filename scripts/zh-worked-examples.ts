// Prints the worked examples of plans/1-zh-source-tax/plan.md (appendix) and the two
// Swissdec ELM 6.0 § 10.6.1.2 examples. The values come from the real functions and the real 2026 file.
// Run: bun run examples. The script exits with code 1 when a value differs from the expected value.

import { rateFor } from "../src/domain/source-tax/estv/lookup.ts";
import {
	chf,
	formatChf,
	formatRatioChf,
	type Rappen,
	rappen,
} from "../src/domain/source-tax/money.ts";
import type { MonthInput as GenericMonthInput } from "../src/domain/source-tax/monthly/rate-defining.ts";
import type { Period } from "../src/domain/source-tax/monthly/sv-days.ts";
import { sourceTax } from "../src/domain/source-tax/monthly/tax.ts";
import { TariffCode } from "../src/domain/source-tax/zurich/codes.ts";
import { ZH_2026 } from "../src/domain/source-tax/zurich/tariff-2026.generated.ts";

type MonthInput = GenericMonthInput<TariffCode>;

type Example = {
	name: string;
	input: MonthInput;
	/** Expected values, as the plan.md appendix prints them. */
	expected: {
		taxable: string;
		rateDefining: string;
		band: string;
		rate: string;
		raw: string;
		tax: string;
	};
};

const zero = rappen(0);

function monthly(
	code: string,
	periodic: string,
	options: {
		period?: Period;
		aperiodic?: string;
		thirteenthMonth?: string;
	} = {},
): MonthInput {
	return {
		code: TariffCode.parse(code),
		pay: {
			kind: "monthly",
			periodic: chf(periodic),
			thirteenthMonth:
				options.thirteenthMonth === undefined
					? zero
					: chf(options.thirteenthMonth),
			period: options.period ?? { kind: "fullMonth" },
		},
		aperiodic: options.aperiodic === undefined ? zero : chf(options.aperiodic),
		taxableOnly: zero,
		employment: { kind: "single" },
	};
}

const examples: Example[] = [
	{
		name: "Full month",
		input: monthly("A0N", "6000"),
		expected: {
			taxable: "6,000.00",
			rateDefining: "6,000.00",
			band: "5,951-6,000",
			rate: "6.79%",
			raw: "407.40",
			tax: "407.40",
		},
	},
	{
		name: "Married, sole earner, 2 children, church",
		input: monthly("B2Y", "9000"),
		expected: {
			taxable: "9,000.00",
			rateDefining: "9,000.00",
			band: "8,951-9,000",
			rate: "3.28%",
			raw: "295.20",
			tax: "295.20",
		},
	},
	{
		name: "Married, dual earner",
		input: monthly("C0N", "7500"),
		expected: {
			taxable: "7,500.00",
			rateDefining: "7,500.00",
			band: "7,451-7,500",
			rate: "8.89%",
			raw: "666.75",
			tax: "666.75",
		},
	},
	{
		name: "Single parent, 1 child, church",
		input: monthly("H1Y", "5200"),
		expected: {
			taxable: "5,200.00",
			rateDefining: "5,200.00",
			band: "5,151-5,200",
			rate: "1.95%",
			raw: "101.40",
			tax: "101.40",
		},
	},
	{
		name: "Replacement income from insurer",
		input: monthly("G9N", "3000"),
		expected: {
			taxable: "3,000.00",
			rateDefining: "3,000.00",
			band: "2,951-3,000",
			rate: "5.19%",
			raw: "155.70",
			tax: "155.70",
		},
	},
	{
		name: "Start on 15 March (16 days), salary 6,000",
		input: monthly("A0N", "3200", {
			period: { kind: "start", date: { year: 2026, month: 3, day: 15 } },
		}),
		expected: {
			taxable: "3,200.00",
			rateDefining: "6,000.00",
			band: "5,951-6,000",
			rate: "6.79%",
			raw: "217.28",
			tax: "217.30",
		},
	},
	{
		name: "Salary 6,000 + bonus 10,000",
		input: monthly("A0N", "6000", { aperiodic: "10000" }),
		expected: {
			taxable: "16,000.00",
			rateDefining: "16,000.00",
			band: "15,951-16,000",
			rate: "15.95%",
			raw: "2,552.00",
			tax: "2,552.00",
		},
	},
	{
		name: "High salary",
		input: monthly("A0N", "120000"),
		expected: {
			taxable: "120,000.00",
			rateDefining: "120,000.00",
			band: "from 100,001",
			rate: "31.27%",
			raw: "37,524.00",
			tax: "37,524.00",
		},
	},
	{
		name: "Cents at band edge (D3)",
		input: monthly("A0N", "850.40"),
		expected: {
			taxable: "850.40",
			rateDefining: "850.40",
			band: "801-850",
			rate: "0.24%",
			raw: "2.04096",
			tax: "2.05",
		},
	},
	{
		name: "Swissdec 10.6.1.2 example 1: exit on 15 March, 13th month 1,250",
		input: monthly("A0N", "3000", {
			thirteenthMonth: "1250",
			period: { kind: "end", date: { year: 2026, month: 3, day: 15 } },
		}),
		expected: {
			taxable: "4,250.00",
			rateDefining: "8,500.00",
			band: "8,451-8,500",
			rate: "9.09%",
			raw: "386.325",
			tax: "386.35",
		},
	},
	{
		name: "Swissdec 10.6.1.2 example 2: exit on 1 November, 13th month 5,016.65",
		input: monthly("A0N", "200", {
			thirteenthMonth: "5016.65",
			period: { kind: "end", date: { year: 2026, month: 11, day: 1 } },
		}),
		expected: {
			taxable: "5,216.65",
			rateDefining: "156,499.50",
			band: "from 100,001",
			rate: "31.27%",
			raw: "1,631.246455",
			tax: "1,631.25",
		},
	},
];

const withThousands = (rappenValue: number): string =>
	Math.floor(rappenValue / 100)
		.toString()
		.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function bandLabel(
	band: { from: Rappen; width: Rappen } | null,
	last: boolean,
): string {
	if (band === null) {
		return "-";
	}
	return last
		? `from ${withThousands(band.from)}`
		: `${withThousands(band.from)}-${withThousands(band.from + band.width - 100)}`;
}

/** The raw tax as an exact decimal: taxable (Rappen) x rate (1/10,000) is CHF with up to 6 decimals. */
function rawTax(taxable: Rappen, rate: number): string {
	const micro = BigInt(taxable) * BigInt(rate); // 1e-6 CHF
	const whole = micro / 1000000n;
	const fraction = (micro % 1000000n)
		.toString()
		.padStart(6, "0")
		.replace(/0+$/, "")
		.padEnd(2, "0");
	return `${whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}

const rows: string[][] = [
	[
		"Case",
		"Code",
		"Taxable",
		"Rate-defining",
		"Band",
		"Rate",
		"Raw",
		"Tax",
		"Check",
	],
];
let failed = 0;
for (const example of examples) {
	const result = sourceTax(example.input, ZH_2026);
	const { band } = rateFor(ZH_2026, result.code, result.rateDefiningSalary);
	const table = ZH_2026.tables[result.code] ?? [];
	const isLast = band !== null && band === table[table.length - 1];
	const actual = {
		taxable: formatChf(result.taxableSalary),
		raw: rawTax(result.taxableSalary, result.rate),
		rateDefining: formatRatioChf(result.rateDefiningSalary),
		band: bandLabel(band, isLast),
		rate: `${(result.rate / 100).toFixed(2)}%`,
		tax: formatChf(result.tax),
	};
	const matches =
		actual.taxable === example.expected.taxable &&
		actual.rateDefining === example.expected.rateDefining &&
		actual.band === example.expected.band &&
		actual.rate === example.expected.rate &&
		actual.raw === example.expected.raw &&
		actual.tax === example.expected.tax;
	if (!matches) {
		failed++;
	}
	rows.push([
		example.name,
		result.code,
		actual.taxable,
		actual.rateDefining,
		actual.band,
		actual.rate,
		actual.raw,
		actual.tax,
		matches ? "ok" : `DIFFERS (expected ${JSON.stringify(example.expected)})`,
	]);
}

const widths =
	rows[0]?.map((_, column) =>
		Math.max(...rows.map((row) => (row[column] ?? "").length)),
	) ?? [];
for (const row of rows) {
	console.log(
		row
			.map((cell, column) => cell.padEnd(widths[column] ?? 0))
			.join("  ")
			.trimEnd(),
	);
}
if (failed > 0) {
	console.error(`${failed} example(s) differ from the expected values`);
	process.exit(1);
}
console.log(`\nAll ${examples.length} examples match.`);
