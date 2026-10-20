// Social-insurance days of a month. Source: KS 45 § 6.6, Swissdec ELM 6.0 § 10.6.1, plan.md § 3.2, decision D5.

import { assertNever } from "../money.ts";

export type PlainDate = { year: number; month: number; day: number };

export type Period =
	| { kind: "fullMonth" }
	| { kind: "start"; date: PlainDate }
	| { kind: "end"; date: PlainDate }
	| { kind: "startAndEnd"; start: PlainDate; end: PlainDate }; // same month

const DAYS_PER_MONTH = 30;

function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function lastDayOfMonth(year: number, month: number): number {
	switch (month) {
		case 2:
			return isLeapYear(year) ? 29 : 28;
		case 4:
		case 6:
		case 9:
		case 11:
			return 30;
		default:
			return 31;
	}
}

function checkDate({ year, month, day }: PlainDate): void {
	if (
		!Number.isInteger(year) ||
		!Number.isInteger(month) ||
		!Number.isInteger(day)
	) {
		throw new Error("A date needs an integer year, month and day");
	}
	if (month < 1 || month > 12 || day < 1 || day > lastDayOfMonth(year, month)) {
		throw new Error(`Invalid date: ${year}-${month}-${day}`);
	}
}

/**
 * Day number n(d) (KS 45 § 6.6, D5). Day 31 is 30. The last day of February is 30.
 * In a leap year, 28 February is also 30. Other days keep their number.
 */
function dayNumber(date: PlainDate): number {
	checkDate(date);
	const { year, month, day } = date;
	if (month === 2) {
		const isLast = day === lastDayOfMonth(year, month);
		const isLeapDay28 = isLeapYear(year) && day === 28;
		return isLast || isLeapDay28 ? DAYS_PER_MONTH : day;
	}
	return day === 31 ? DAYS_PER_MONTH : day;
}

export function socialInsuranceDays(period: Period): number {
	switch (period.kind) {
		case "fullMonth":
			return DAYS_PER_MONTH;
		case "start":
			return Math.max(DAYS_PER_MONTH - dayNumber(period.date) + 1, 1);
		case "end":
			return Math.min(dayNumber(period.date), DAYS_PER_MONTH);
		case "startAndEnd": {
			const { start, end } = period;
			if (start.year !== end.year || start.month !== end.month) {
				throw new Error("Start and end must be in the same month");
			}
			const startNumber = dayNumber(start);
			const endNumber = dayNumber(end);
			if (end.day < start.day) {
				throw new Error("The end is before the start");
			}
			return Math.max(endNumber - startNumber + 1, 1);
		}
		default:
			return assertNever(period);
	}
}
