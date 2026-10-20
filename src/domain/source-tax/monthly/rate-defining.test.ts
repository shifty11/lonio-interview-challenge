import { describe, expect, test } from "bun:test";
import {
	chf,
	type Ratio,
	rappen,
	ratio,
	ratioEquals,
	ratioOf,
	roundHalfUp,
} from "../money.ts";
import { TariffCode } from "../zurich/codes.ts";
import { ZH_2026 } from "../zurich/tariff-2026.generated.ts";
import {
	type MonthInput as GenericMonthInput,
	rateDefiningSalary,
} from "./rate-defining.ts";
import type { Period } from "./sv-days.ts";

type MonthInput = GenericMonthInput<TariffCode>;
const A0N = TariffCode.parse("A0N");

/** A percent value from a decimal string, for example `pct("38.46")`. */
function pct(text: string): Ratio {
	const [whole = "0", decimals = ""] = text.split(".");
	return ratio(BigInt(whole + decimals), 10n ** BigInt(decimals.length));
}
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
		taxableOnly: zero,
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
			ownPercent: pct("50"),
			totalPercent: pct("100"),
		}),
		expected: "9000",
	},
	{
		source: "§ 6.4 example 1, K. AG 50% of 100%",
		input: monthly("4000", {
			kind: "levels",
			ownPercent: pct("50"),
			totalPercent: pct("100"),
		}),
		expected: "8000",
	},
	{
		source: "§ 6.4 example 2, M. AG level unknown: own level to 100%",
		input: monthly("4500", { kind: "ownLevelOnly", ownPercent: pct("50") }),
		expected: "9000",
	},
	{
		source: "§ 6.4 example 2, T. AG level unknown: own level to 100%",
		input: monthly("4400", { kind: "ownLevelOnly", ownPercent: pct("40") }),
		expected: "11000",
	},
	{
		source: "§ 6.4 example 3, M. AG total level 90%",
		input: monthly("4500", {
			kind: "levels",
			ownPercent: pct("50"),
			totalPercent: pct("90"),
		}),
		expected: "8100",
	},
	{
		source: "§ 6.4 example 3, T. AG total level 90%",
		input: monthly("4400", {
			kind: "levels",
			ownPercent: pct("40"),
			totalPercent: pct("90"),
		}),
		expected: "9900",
	},
	{
		source:
			"§ 6.4 example 4, G. AG 70% plus bonus 2000 (no conversion of the bonus)",
		input: monthly(
			"4550",
			{ kind: "ownLevelOnly", ownPercent: pct("70") },
			{ aperiodic: "2000" },
		),
		expected: "8500",
	},
	{
		source: "§ 6.4 example 4, H. AG 30%",
		input: monthly("1200", { kind: "ownLevelOnly", ownPercent: pct("30") }),
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
			ownPercent: pct("50"),
			totalPercent: pct("70"),
		}),
		expected: "6300",
	},
	{
		source: "§ 6.4 example 8, P. AG 60% of 100%",
		input: monthly("6000", {
			kind: "levels",
			ownPercent: pct("60"),
			totalPercent: pct("100"),
		}),
		expected: "10000",
	},
	{
		source: "§ 6.4 example 8, IV pension 40% of 100%",
		input: monthly("2000", {
			kind: "levels",
			ownPercent: pct("40"),
			totalPercent: pct("100"),
		}),
		expected: "5000",
	},
	{
		source: "§ 6.4 example 3 of § 6.5, T. AG 50%",
		input: monthly("2400", { kind: "ownLevelOnly", ownPercent: pct("50") }),
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
			"§ 6.5 example 6: 75 hours at 2625 plus the family allowance 1200 (aperiodic: not converted, as in the table of the example). The sick pay 2000 is taxableOnly: it is not rate-defining.",
		input: {
			...hourly("2625", "75"),
			aperiodic: chf("1200"),
			taxableOnly: chf("2000"),
		},
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
		taxableOnly: zero,
		employment: single,
	};
}

function daily(pay: string, days: string): MonthInput {
	return {
		code: A0N,
		pay: { kind: "daily", pay: chf(pay), days: ratio(BigInt(days), 1n) },
		aperiodic: zero,
		taxableOnly: zero,
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
			monthly("3400", { kind: "ownLevelOnly", ownPercent: pct("60") }),
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

	// source: KS 45 § 6.4 example 9. The example uses the median of 2019. The file copy sets MED to 5,425.
	test("§ 6.4 example 9: 500 plus the median 5,425 gives 5,925", () => {
		const file2019 = { ...ZH_2026, medians: { MED: chf("5425") } };
		const result = rateDefiningSalary(
			monthly("500", { kind: "noLevel" }),
			file2019,
		);
		expectChf(result, "5925");
	});

	// source: KS 45 § 6.5 example 2, R. AG: monthly pay 1,540 at the level 38.46% (70 hours / 182), shown as 4,004
	test("§ 6.5 example 2: the decimal level 38.46% gives 4004.16", () => {
		const result = rateDefiningSalary(
			monthly("1540", { kind: "ownLevelOnly", ownPercent: pct("38.46") }),
			ZH_2026,
		);
		expectRatio(result, ratio(154000n * 100n * 100n, 3846n));
		expect(ratioEquals(result, ratioOf(chf("4004.16")))).toBe(false);
		expect(roundHalfUp(result, 1n)).toBe(400416n);
	});

	test("decimal levels are exact: 37.5% of 100%", () => {
		const result = rateDefiningSalary(
			monthly("3000", {
				kind: "levels",
				ownPercent: pct("37.5"),
				totalPercent: pct("100"),
			}),
			ZH_2026,
		);
		expectChf(result, "8000");
	});

	test("the level 100% (own equals total) converts nothing", () => {
		expectChf(
			rateDefiningSalary(
				monthly("3000", { kind: "ownLevelOnly", ownPercent: pct("100") }),
				ZH_2026,
			),
			"3000",
		);
	});

	test("taxableOnly is not rate-defining", () => {
		const input = { ...monthly("3000", single), taxableOnly: chf("999") };
		expectChf(rateDefiningSalary(input, ZH_2026), "3000");
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
	const levels = (ownPercent: Ratio, totalPercent: Ratio): Employment => ({
		kind: "levels",
		ownPercent,
		totalPercent,
	});
	const throwing: { name: string; input: MonthInput }[] = [
		{
			name: "ownPercent 0",
			input: monthly("1000", { kind: "ownLevelOnly", ownPercent: pct("0") }),
		},
		{
			name: "ownPercent 101",
			input: monthly("1000", { kind: "ownLevelOnly", ownPercent: pct("101") }),
		},
		{
			name: "ownPercent negative",
			input: monthly("1000", { kind: "ownLevelOnly", ownPercent: pct("-5") }),
		},
		{
			name: "totalPercent 0",
			input: monthly("1000", levels(pct("0"), pct("0"))),
		},
		{
			name: "totalPercent negative",
			input: monthly("1000", levels(pct("10"), pct("-50"))),
		},
		{
			name: "ownPercent 100.01 (decimal above the range)",
			input: monthly("1000", {
				kind: "ownLevelOnly",
				ownPercent: pct("100.01"),
			}),
		},
		{
			name: "ownPercent just above totalPercent (50.01 of 50)",
			input: monthly("1000", levels(pct("50.01"), pct("50"))),
		},
		{
			name: "ownPercent above totalPercent",
			input: monthly("1000", levels(pct("60"), pct("50"))),
		},
		{
			name: "totalPercent 101",
			input: monthly("1000", levels(pct("50"), pct("101"))),
		},
		{
			name: "hourly pay with a second job",
			input: {
				...hourly("1000", "10"),
				employment: levels(pct("50"), pct("100")),
			},
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
