// Source: spec.md § 6 (EmployeeRow). A bad stored row gives `employee: null`. No database.

import { describe, expect, test } from "bun:test";
import { parseEmployeeRow, type StoredEmployee } from "./employees.ts";

const base: StoredEmployee = {
	id: "00000000-0000-4000-8000-000000000001",
	firstName: "Luca",
	lastName: "Rossi",
	nationality: "IT",
	canton: "ZH",
	sourceTaxAnswers: {
		incomeType: "earned",
		civilStatus: "single",
		churchMember: false,
		children: { hasChildren: false },
		residence: { residenceInSwitzerland: true },
	},
	createdAt: "2026-10-20 10:00:00+00",
};

describe("parseEmployeeRow", () => {
	test("a valid source-taxed row parses", () => {
		const row = parseEmployeeRow(base);
		expect(row.employee?.nationality).toBe("IT");
	});

	test("a valid Swiss row parses", () => {
		const row = parseEmployeeRow({
			...base,
			nationality: "CH",
			canton: null,
			sourceTaxAnswers: null,
		});
		expect(row.employee).toEqual({
			firstName: "Luca",
			lastName: "Rossi",
			nationality: "CH",
		});
	});

	const bad: [string, Partial<StoredEmployee>][] = [
		["answers of an unknown shape", { sourceTaxAnswers: { incomeType: "x" } }],
		["answers are null for a non-Swiss row", { sourceTaxAnswers: null }],
		["canton is null for a non-Swiss row", { canton: null }],
		["a Swiss row has answers", { nationality: "CH" }],
		[
			"an extra key in the answers",
			{
				sourceTaxAnswers: {
					...JSON.parse(JSON.stringify(base.sourceTaxAnswers)),
					tariffCode: "A0N",
				},
			},
		],
	];
	for (const [name, patch] of bad) {
		test(`${name} gives employee: null and keeps the columns`, () => {
			const row = parseEmployeeRow({ ...base, ...patch });
			expect(row.employee).toBeNull();
			expect(row.firstName).toBe("Luca");
		});
	}
});
