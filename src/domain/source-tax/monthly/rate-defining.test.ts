import { describe, expect, test } from "bun:test";
import {
	chf,
	type Ratio,
	rappen,
	ratio,
	ratioEquals,
	ratioOf,
} from "../money.ts";
import { TariffCode } from "../zurich/codes.ts";
import { ZH_2026 } from "../zurich/tariff-2026.generated.ts";
import { type MonthInput, rateDefiningSalary } from "./rate-defining.ts";
import type { Period } from "./sv-days.ts";

const A0N = TariffCode.parse("A0N");
const fullMonth: Period = { kind: "fullMonth" };
const zero = rappen(0);

type Employment = MonthInput["employment"];

function monthly(
	periodic: string,
	employment: Employment,
	options: {
		period?: Period;
		aperiodic?: string;
		thirteenthMonth?: string;
	} = {},
): MonthInput {
	return {
		code: A0N,
		pay: {
			kind: "monthly",
			periodic: chf(periodic),
			thirteenthMonth:
				options.thirteenthMonth === undefined
					? zero
					: chf(options.thirteenthMonth),
			period: options.period ?? fullMonth,
		},
		aperiodic: options.aperiodic === undefined ? zero : chf(options.aperiodic),
		employment,
	};
}

const single: Employment = { kind: "single" };
const expectChf = (actual: Ratio, expected: string) =>
	expect(ratioEquals(actual, ratioOf(chf(expected)))).toBe(true);
const expectRatio = (actual: Ratio, expected: Ratio) =>
	expect(ratioEquals(actual, expected)).toBe(true);

type Case = { source: string; input: MonthInput; expected: string };

const date = (year: number, month: number, day: number) => ({
	year,
	month,
	day,
});

const cases: Case[] = [
	// KS 45 § 6.4
	{
		source: "§ 6.4 single employment, part time: no conversion",
		input: monthly("4000", single),
		expected: "4000",
	},
	{
		source: "§ 6.4 example 1, F. AG 50% of 100%",
		input: monthly("4500", {
			kind: "levels",
			ownPercent: 50,
			totalPercent: 100,
		}),
		expected: "9000",
	},
	{
		source: "§ 6.4 example 1, K. AG 50% of 100%",
		input: monthly("4000", {
			kind: "levels",
			ownPercent: 50,
			totalPercent: 100,
		}),
		expected: "8000",
	},
	{
		source: "§ 6.4 example 2, M. AG level unknown: own level to 100%",
		input: monthly("4500", { kind: "ownLevelOnly", ownPercent: 50 }),
		expected: "9000",
	},
	{
		source: "§ 6.4 example 2, T. AG level unknown: own level to 100%",
		input: monthly("4400", { kind: "ownLevelOnly", ownPercent: 40 }),
		expected: "11000",
	},
	{
		source: "§ 6.4 example 3, M. AG total level 90%",
		input: monthly("4500", {
			kind: "levels",
			ownPercent: 50,
			totalPercent: 90,
		}),
		expected: "8100",
	},
	{
		source: "§ 6.4 example 3, T. AG total level 90%",
		input: monthly("4400", {
			kind: "levels",
			ownPercent: 40,
			totalPercent: 90,
		}),
		expected: "9900",
	},
	{
		source:
			"§ 6.4 example 4, G. AG 70% plus bonus 2000 (no conversion of the bonus)",
		input: monthly(
			"4550",
			{ kind: "ownLevelOnly", ownPercent: 70 },
			{ aperiodic: "2000" },
		),
		expected: "8500",
	},
	{
		source: "§ 6.4 example 4, H. AG 30%",
		input: monthly("1200", { kind: "ownLevelOnly", ownPercent: 30 }),
		expected: "4000",
	},
	{
		source: "§ 6.4 example 6, same payer, 80% job: total income known",
		input: monthly("4400", {
			kind: "totalIncomeKnown",
			otherPeriodic: chf("900"),
		}),
		expected: "5300",
	},
	{
		source: "§ 6.4 example 6, same payer, 20% job: total income known",
		input: monthly("900", {
			kind: "totalIncomeKnown",
			otherPeriodic: chf("4400"),
		}),
		expected: "5300",
	},
	{
		source: "§ 6.4 example 7, R. AG 50% of 70%",
		input: monthly("4500", {
			kind: "levels",
			ownPercent: 50,
			totalPercent: 70,
		}),
		expected: "6300",
	},
	{
		source: "§ 6.4 example 8, P. AG 60% of 100%",
		input: monthly("6000", {
			kind: "levels",
			ownPercent: 60,
			totalPercent: 100,
		}),
		expected: "10000",
	},
	{
		source: "§ 6.4 example 8, IV pension 40% of 100%",
		input: monthly("2000", {
			kind: "levels",
			ownPercent: 40,
			totalPercent: 100,
		}),
		expected: "5000",
	},
	{
		source: "§ 6.4 example 3 of § 6.5, T. AG 50%",
		input: monthly("2400", { kind: "ownLevelOnly", ownPercent: 50 }),
		expected: "4800",
	},
	// KS 45 § 6.5, hourly pay
	{
		source: "§ 6.5 example 1, week 1",
		input: hourly("1024", "32"),
		expected: "5760",
	},
	{
		source: "§ 6.5 example 1, week 2",
		input: hourly("1330", "38"),
		expected: "6300",
	},
	{
		source: "§ 6.5 example 1, week 3",
		input: hourly("1485", "45"),
		expected: "5940",
	},
	{
		source: "§ 6.5 example 1, week 4",
		input: hourly("1480", "37"),
		expected: "7200",
	},
	{
		source: "§ 6.5 example 3, Q. AG",
		input: hourly("1610", "70"),
		expected: "4140",
	},
	{
		source: "§ 6.5 example 4, S. AG",
		input: hourly("2520", "72"),
		expected: "6300",
	},
	{
		source: "§ 6.5 example 5, April",
		input: hourly("6825", "195"),
		expected: "6300",
	},
	{
		source: "§ 6.5 example 5, May",
		input: hourly("1750", "50"),
		expected: "6300",
	},
	{
		source:
			"§ 6.5 example 6, wages 2625 for 75 hours plus family allowance 1200 (the sick pay of 2000 is not rate-defining)",
		input: { ...hourly("2625", "75"), aperiodic: chf("1200") },
		expected: "7500",
	},
	// KS 45 § 6.5, daily pay (190.00 x 21.667)
	{
		source: "§ 6.5 example 2, P. AG, 11 days",
		input: daily("2090", "11"),
		expected: "4116.73",
	},
	// KS 45 § 6.6 example 1: end on 16 March, aperiodic pay not converted
	{
		source: "§ 6.6 example 1, S. exits on 16 March 2022",
		input: monthly("3500", single, {
			period: { kind: "end", date: date(2022, 3, 16) },
			aperiodic: "6000",
		}),
		expected: "12562.50",
	},
	// plan.md appendix row 6
	{
		source: "plan.md appendix row 6, start on 15 March",
		input: monthly("3200", single, {
			period: { kind: "start", date: date(2026, 3, 15) },
		}),
		expected: "6000",
	},
	// Swissdec § 10.6.1.2 (decision D2)
	{
		source: "Swissdec § 10.6.1.2 example 1, exit on 15 March, 13th month 1250",
		input: monthly("3000", single, {
			period: { kind: "end", date: date(2026, 3, 15) },
			thirteenthMonth: "1250",
		}),
		expected: "8500",
	},
	{
		source:
			"Swissdec § 10.6.1.2 example 2, exit on 1 November, 13th month 5016.65",
		input: monthly("200", single, {
			period: { kind: "end", date: date(2026, 11, 1) },
			thirteenthMonth: "5016.65",
		}),
		expected: "156499.50",
	},
	// Start and end in one month
	{
		source: "start 5 and end 20 January: 16 days",
		input: monthly("3200", single, {
			period: {
				kind: "startAndEnd",
				start: date(2026, 1, 5),
				end: date(2026, 1, 20),
			},
		}),
		expected: "6000",
	},
	// Full month with a 13th month paid monthly: periodic pay
	{
		source: "13th month in the month: periodic pay",
		input: monthly("5000", single, { thirteenthMonth: "416.67" }),
		expected: "5416.67",
	},
];

function hourly(pay: string, hours: string): MonthInput {
	return {
		code: A0N,
		pay: { kind: "hourly", pay: chf(pay), hours: ratio(BigInt(hours), 1n) },
		aperiodic: zero,
		employment: single,
	};
}

function daily(pay: string, days: string): MonthInput {
	return {
		code: A0N,
		pay: { kind: "daily", pay: chf(pay), days: ratio(BigInt(days), 1n) },
		aperiodic: zero,
		employment: single,
	};
}

describe("rateDefiningSalary", () => {
	for (const c of cases) {
		test(c.source, () => {
			expectChf(rateDefiningSalary(c.input, ZH_2026), c.expected);
		});
	}

	test("§ 6.4 example 5: 60% job gives 5666.67 (exact fraction, no rounding)", () => {
		const result = rateDefiningSalary(
			monthly("3400", { kind: "ownLevelOnly", ownPercent: 60 }),
			ZH_2026,
		);
		expectRatio(result, ratio(34000000n, 60n));
		expect(ratioEquals(result, ratioOf(chf("5666.67")))).toBe(false);
	});

	test("§ 6.5 example 1 total: weighted mean 5319 / 152 x 180 = 6298.89...", () => {
		const result = rateDefiningSalary(hourly("5319", "152"), ZH_2026);
		expectRatio(result, ratio(531900n * 180n, 152n));
	});

	test("§ 6.4 no level: the median of the file is added (plan.md § 3.4 item 4)", () => {
		const result = rateDefiningSalary(
			monthly("500", { kind: "noLevel" }),
			ZH_2026,
		);
		expectChf(result, "6375");
	});

	test("§ 6.4 no level: a file without MED throws", () => {
		expect(() =>
			rateDefiningSalary(monthly("500", { kind: "noLevel" }), {
				...ZH_2026,
				medians: {},
			}),
		).toThrow(/MED/);
	});

	test("an aperiodic amount is added without conversion", () => {
		const result = rateDefiningSalary(
			monthly("3000", single, {
				period: { kind: "end", date: date(2026, 3, 15) },
				aperiodic: "1000",
			}),
			ZH_2026,
		);
		expectChf(result, "7000");
	});
});

describe("rateDefiningSalary throws", () => {
	const levels = (ownPercent: number, totalPercent: number): Employment => ({
		kind: "levels",
		ownPercent,
		totalPercent,
	});
	const throwing: { name: string; input: MonthInput }[] = [
		{
			name: "ownPercent 0",
			input: monthly("1000", { kind: "ownLevelOnly", ownPercent: 0 }),
		},
		{
			name: "ownPercent 101",
			input: monthly("1000", { kind: "ownLevelOnly", ownPercent: 101 }),
		},
		{
			name: "ownPercent 50.5",
			input: monthly("1000", { kind: "ownLevelOnly", ownPercent: 50.5 }),
		},
		{
			name: "ownPercent above totalPercent",
			input: monthly("1000", levels(60, 50)),
		},
		{ name: "totalPercent 101", input: monthly("1000", levels(50, 101)) },
		{
			name: "hourly pay with a second job",
			input: { ...hourly("1000", "10"), employment: levels(50, 100) },
		},
		{
			name: "daily pay with total income known",
			input: {
				...daily("1000", "10"),
				employment: { kind: "totalIncomeKnown", otherPeriodic: chf("100") },
			},
		},
		{ name: "hourly pay with no hours", input: hourly("1000", "0") },
		{ name: "daily pay with no days", input: daily("1000", "0") },
	];
	for (const c of throwing) {
		test(c.name, () => {
			expect(() => rateDefiningSalary(c.input, ZH_2026)).toThrow();
		});
	}
});
