import { describe, expect, test } from "bun:test";
import { type Period, type PlainDate, socialInsuranceDays } from "./sv-days.ts";

const d = (year: number, month: number, day: number): PlainDate => ({
	year,
	month,
	day,
});

type Case = { source: string; period: Period; days: number };

// source: plan.md § 3.2 table (KS 45 § 6.6 special cases, "gleiche Methode wie für die Berechnung der Sozialversicherungstage")
const cases: Case[] = [
	{
		source: "start 31 March 2023",
		period: { kind: "start", date: d(2023, 3, 31) },
		days: 1,
	},
	{
		source: "start 30 March 2023",
		period: { kind: "start", date: d(2023, 3, 30) },
		days: 1,
	},
	{
		source: "start 29 March 2023",
		period: { kind: "start", date: d(2023, 3, 29) },
		days: 2,
	},
	{
		source: "start 29 Feb 2024 (leap year)",
		period: { kind: "start", date: d(2024, 2, 29) },
		days: 1,
	},
	{
		source: "start 28 Feb 2024 (leap year)",
		period: { kind: "start", date: d(2024, 2, 28) },
		days: 1,
	},
	{
		source: "start 28 Feb 2023",
		period: { kind: "start", date: d(2023, 2, 28) },
		days: 1,
	},
	{
		source: "start 27 Feb 2023",
		period: { kind: "start", date: d(2023, 2, 27) },
		days: 4,
	},
	{
		source: "end 31 March 2023",
		period: { kind: "end", date: d(2023, 3, 31) },
		days: 30,
	},
	{
		source: "end 30 March 2023",
		period: { kind: "end", date: d(2023, 3, 30) },
		days: 30,
	},
	{
		source: "end 29 March 2023",
		period: { kind: "end", date: d(2023, 3, 29) },
		days: 29,
	},
	{
		source: "end 29 Feb 2024 (leap year)",
		period: { kind: "end", date: d(2024, 2, 29) },
		days: 30,
	},
	{
		source: "end 28 Feb 2024 (leap year)",
		period: { kind: "end", date: d(2024, 2, 28) },
		days: 30,
	},
	{
		source: "end 28 Feb 2023",
		period: { kind: "end", date: d(2023, 2, 28) },
		days: 30,
	},
	{
		source: "end 27 Feb 2023",
		period: { kind: "end", date: d(2023, 2, 27) },
		days: 27,
	},
	// source: KS 45 § 6.6 example 1 (end 16 March) and Swissdec § 10.6.1.2 examples 1 and 2
	{
		source: "end 16 March 2022 (KS 45 § 6.6 example 1)",
		period: { kind: "end", date: d(2022, 3, 16) },
		days: 16,
	},
	{
		source: "end 15 March (Swissdec § 10.6.1.2 example 1)",
		period: { kind: "end", date: d(2026, 3, 15) },
		days: 15,
	},
	{
		source: "end 1 November (Swissdec § 10.6.1.2 example 2)",
		period: { kind: "end", date: d(2026, 11, 1) },
		days: 1,
	},
	// source: plan.md appendix row 6
	{
		source: "start 15 March (plan.md appendix row 6)",
		period: { kind: "start", date: d(2026, 3, 15) },
		days: 16,
	},
	{
		source: "start 1 January: a full month",
		period: { kind: "start", date: d(2026, 1, 1) },
		days: 30,
	},
	{
		source: "end 30 April",
		period: { kind: "end", date: d(2026, 4, 30) },
		days: 30,
	},
	{ source: "full month", period: { kind: "fullMonth" }, days: 30 },
	// startAndEnd: max(n(end) - n(start) + 1, 1)
	{
		source: "start and end 5-20 January",
		period: { kind: "startAndEnd", start: d(2026, 1, 5), end: d(2026, 1, 20) },
		days: 16,
	},
	{
		source: "start 10 and end 31 March",
		period: { kind: "startAndEnd", start: d(2026, 3, 10), end: d(2026, 3, 31) },
		days: 21,
	},
	{
		source: "start and end on the same day",
		period: { kind: "startAndEnd", start: d(2026, 5, 7), end: d(2026, 5, 7) },
		days: 1,
	},
	{
		source: "start 31 and end 31 March",
		period: { kind: "startAndEnd", start: d(2026, 3, 31), end: d(2026, 3, 31) },
		days: 1,
	},
	{
		source: "start 1 and end 28 February 2026",
		period: { kind: "startAndEnd", start: d(2026, 2, 1), end: d(2026, 2, 28) },
		days: 30,
	},
	{
		source: "start 1 and end 28 February 2024",
		period: { kind: "startAndEnd", start: d(2024, 2, 1), end: d(2024, 2, 28) },
		days: 30,
	},
];

describe("socialInsuranceDays", () => {
	for (const c of cases) {
		test(c.source, () => {
			expect(socialInsuranceDays(c.period)).toBe(c.days);
		});
	}

	// source: spec.md § 9 (startAndEnd: n(end) - n(start) + 1)
	test("start and end 1-15 February 2026 count 15 days", () => {
		expect(
			socialInsuranceDays({
				kind: "startAndEnd",
				start: d(2026, 2, 1),
				end: d(2026, 2, 15),
			}),
		).toBe(15);
	});
});

describe("socialInsuranceDays throws", () => {
	const throwing: { name: string; period: Period }[] = [
		{
			name: "start and end in other months",
			period: {
				kind: "startAndEnd",
				start: d(2026, 3, 10),
				end: d(2026, 4, 5),
			},
		},
		{
			name: "start and end in other years",
			period: {
				kind: "startAndEnd",
				start: d(2025, 12, 10),
				end: d(2026, 12, 20),
			},
		},
		{
			name: "end before start",
			period: {
				kind: "startAndEnd",
				start: d(2026, 3, 20),
				end: d(2026, 3, 10),
			},
		},
		{
			name: "29 February in a common year",
			period: { kind: "end", date: d(2023, 2, 29) },
		},
		{ name: "31 April", period: { kind: "start", date: d(2026, 4, 31) } },
		{ name: "month 13", period: { kind: "end", date: d(2026, 13, 1) } },
		{ name: "day 0", period: { kind: "start", date: d(2026, 1, 0) } },
		{
			name: "a fraction as day",
			period: { kind: "start", date: d(2026, 1, 1.5) },
		},
	];
	// source: spec.md § 9 (throw cases: another month, end before start) and a calendar check of the date
	for (const c of throwing) {
		test(c.name, () => {
			expect(() => socialInsuranceDays(c.period)).toThrow();
		});
	}
});
