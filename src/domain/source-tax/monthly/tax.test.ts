import { describe, expect, test } from "bun:test";
import type { TariffFile } from "../estv/record.ts";
import { chf, rappen, ratio, ratioEquals, ratioOf } from "../money.ts";
import { TariffCode } from "../zurich/codes.ts";
import { ZH_2026 } from "../zurich/tariff-2026.generated.ts";
import type { MonthInput } from "./rate-defining.ts";
import { sourceTax } from "./tax.ts";

const zero = rappen(0);
const date = (year: number, month: number, day: number) => ({
	year,
	month,
	day,
});

function monthly(
	code: string,
	periodic: string,
	options: Partial<Pick<MonthInput, "aperiodic">> & {
		period?: Extract<MonthInput["pay"], { kind: "monthly" }>["period"];
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
		aperiodic: options.aperiodic ?? zero,
		employment: { kind: "single" },
	};
}

/** A file with one open band at `rate` in table A0N. For the KS 45 examples, which use rates of other cantons. */
function flatFile(rate: number, minTax = zero): TariffFile {
	return {
		canton: "XX",
		validFrom: "20210101",
		medians: {},
		fees: {},
		tables: {
			A0N: [{ from: rappen(100), width: rappen(100000000), minTax, rate }],
		},
	};
}

type Row = {
	source: string;
	input: MonthInput;
	taxable: string;
	rateDefining: string;
	rate: number;
	tax: string;
};

// source: plan.md appendix "worked examples (2026 Zurich rates)"
const appendix: Row[] = [
	{
		source: "appendix 1: full month",
		input: monthly("A0N", "6000"),
		taxable: "6000",
		rateDefining: "6000",
		rate: 679,
		tax: "407.40",
	},
	{
		source: "appendix 2: married, sole earner, 2 children, church",
		input: monthly("B2Y", "9000"),
		taxable: "9000",
		rateDefining: "9000",
		rate: 328,
		tax: "295.20",
	},
	{
		source: "appendix 3: married, dual earner",
		input: monthly("C0N", "7500"),
		taxable: "7500",
		rateDefining: "7500",
		rate: 889,
		tax: "666.75",
	},
	{
		source: "appendix 4: single parent, 1 child, church",
		input: monthly("H1Y", "5200"),
		taxable: "5200",
		rateDefining: "5200",
		rate: 195,
		tax: "101.40",
	},
	{
		source: "appendix 5: replacement income from an insurer",
		input: monthly("G9N", "3000"),
		taxable: "3000",
		rateDefining: "3000",
		rate: 519,
		tax: "155.70",
	},
	{
		source: "appendix 6: start on 15 March, 16 days",
		input: monthly("A0N", "3200", {
			period: { kind: "start", date: date(2026, 3, 15) },
		}),
		taxable: "3200",
		rateDefining: "6000",
		rate: 679,
		tax: "217.30",
	},
	{
		source: "appendix 7: salary 6000 + bonus 10000",
		input: monthly("A0N", "6000", { aperiodic: chf("10000") }),
		taxable: "16000",
		rateDefining: "16000",
		rate: 1595,
		tax: "2552.00",
	},
	{
		source: "appendix 8: high salary",
		input: monthly("A0N", "120000"),
		taxable: "120000",
		rateDefining: "120000",
		rate: 3127,
		tax: "37524.00",
	},
	{
		source: "appendix 9: cents at a band edge (D3)",
		input: monthly("A0N", "850.40"),
		taxable: "850.40",
		rateDefining: "850.40",
		rate: 24,
		tax: "2.05",
	},
	// source: Swissdec ELM 6.0 § 10.6.1.2 (decision D2)
	{
		source: "Swissdec § 10.6.1.2 example 1: exit on 15 March",
		input: monthly("A0N", "3000", {
			thirteenthMonth: "1250",
			period: { kind: "end", date: date(2026, 3, 15) },
		}),
		taxable: "4250",
		rateDefining: "8500",
		rate: 909,
		tax: "386.35",
	},
	{
		source: "Swissdec § 10.6.1.2 example 2: exit on 1 November",
		input: monthly("A0N", "200", {
			thirteenthMonth: "5016.65",
			period: { kind: "end", date: date(2026, 11, 1) },
		}),
		taxable: "5216.65",
		rateDefining: "156499.50",
		rate: 3127,
		tax: "1631.25",
	},
];

describe("sourceTax with the real 2026 Zurich file", () => {
	for (const row of appendix) {
		test(row.source, () => {
			const result = sourceTax(row.input, ZH_2026);
			expect(result.code).toBe(row.input.code);
			expect(result.taxableSalary).toBe(chf(row.taxable));
			expect(
				ratioEquals(result.rateDefiningSalary, ratioOf(chf(row.rateDefining))),
			).toBe(true);
			expect(result.rate).toBe(row.rate);
			expect(result.tax).toBe(chf(row.tax));
		});
	}

	test("appendix 6 keeps the exact rate-defining salary (3200 / 16 x 30)", () => {
		const result = sourceTax(appendix[5]?.input as MonthInput, ZH_2026);
		expect(
			ratioEquals(result.rateDefiningSalary, ratio(320000n * 30n, 16n)),
		).toBe(true);
	});
});

describe("rounding", () => {
	// source: KS 45 § 6.5 example 1 (rates 11.1%, 11.4%) and example 2 (7.2%): CHF 0.05 steps
	const ks45: {
		source: string;
		input: MonthInput;
		rate: number;
		tax: string;
	}[] = [
		{
			source: "KS 45 § 6.5 example 1 week 1: 1,024 x 11.1% = 113.664 -> 113.65",
			input: hourlyInput("1024", 32),
			rate: 1110,
			tax: "113.65",
		},
		{
			source: "KS 45 § 6.5 example 2: 1,540 x 7.2% = 110.88 -> 110.90",
			input: monthly("A0N", "1540"),
			rate: 720,
			tax: "110.90",
		},
		{
			source: "KS 45 § 6.5 example 1 week 3: 1,485 x 11.4% = 169.29 -> 169.30",
			input: hourlyInput("1485", 45),
			rate: 1140,
			tax: "169.30",
		},
	];
	for (const c of ks45) {
		test(c.source, () => {
			expect(sourceTax(c.input, flatFile(c.rate)).tax).toBe(chf(c.tax));
		});
	}

	test("a half rounds up: 4,250 x 9.09% = 386.325 -> 386.35 (step 5)", () => {
		expect(sourceTax(appendix[9]?.input as MonthInput, ZH_2026).tax).toBe(
			chf("386.35"),
		);
	});

	test("roundingStep 1: 386.325 -> 386.33", () => {
		expect(
			sourceTax(appendix[9]?.input as MonthInput, ZH_2026, { roundingStep: 1 })
				.tax,
		).toBe(chf("386.33"));
	});

	test("roundingStep 1: appendix 9, 2.04096 -> 2.04", () => {
		expect(
			sourceTax(appendix[8]?.input as MonthInput, ZH_2026, { roundingStep: 1 })
				.tax,
		).toBe(chf("2.04"));
	});

	test("roundingStep 1: Swissdec example 2, 1631.246455 -> 1631.25", () => {
		expect(
			sourceTax(appendix[10]?.input as MonthInput, ZH_2026, { roundingStep: 1 })
				.tax,
		).toBe(chf("1631.25"));
	});

	test("the default step is 5", () => {
		expect(sourceTax(appendix[8]?.input as MonthInput, ZH_2026).tax).toBe(
			sourceTax(appendix[8]?.input as MonthInput, ZH_2026, { roundingStep: 5 })
				.tax,
		);
	});
});

describe("minimum tax and low pay", () => {
	test("the tax is at least the minimum tax of the band", () => {
		// 1,000.00 x 1% = 10.00, minimum tax 25.00
		expect(
			sourceTax(monthly("A0N", "1000"), flatFile(100, chf("25"))).tax,
		).toBe(chf("25"));
	});

	test("the raw tax wins above the minimum tax", () => {
		expect(sourceTax(monthly("A0N", "1000"), flatFile(100, chf("5"))).tax).toBe(
			chf("10"),
		);
	});

	test("a rate-defining salary below CHF 1 gives rate 0 and tax 0 (plan.md § 4.3)", () => {
		const result = sourceTax(monthly("A0N", "0.50"), ZH_2026);
		expect(result.rate).toBe(0);
		expect(result.tax).toBe(zero);
	});

	test("hourly pay: the taxable salary is the pay plus the aperiodic pay", () => {
		const input: MonthInput = {
			...hourlyInput("1024", 32),
			aperiodic: chf("100"),
		};
		expect(sourceTax(input, flatFile(1000)).taxableSalary).toBe(chf("1124"));
	});

	test("an unknown code throws", () => {
		const input = { ...monthly("A0N", "1000"), code: TariffCode.parse("B0N") };
		expect(() => sourceTax(input, flatFile(100))).toThrow(/B0N/);
	});
});

function hourlyInput(pay: string, hours: number): MonthInput {
	return {
		code: TariffCode.parse("A0N"),
		pay: { kind: "hourly", pay: chf(pay), hours: ratio(BigInt(hours), 1n) },
		aperiodic: zero,
		employment: { kind: "single" },
	};
}
