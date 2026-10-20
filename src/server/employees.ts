// The employee repository. It parses every stored row with `OnboardingSchema`.
// A row that fails the parse gets `employee: null`. The other rows still show.

import type { Nationality } from "../domain/onboarding/countries.ts";
import type { Onboarding } from "../domain/onboarding/schema.ts";
import { OnboardingSchema } from "../domain/onboarding/schema.ts";
import type { Db } from "../prisma/db.ts";

export type EmployeeRow = {
	id: string;
	firstName: string;
	lastName: string;
	nationality: Nationality;
	createdAt: string;
	employee: Onboarding | null;
};

export type EmployeeRepo = {
	create(employee: Onboarding): Promise<{ id: string }>;
	list(): Promise<EmployeeRow[]>;
};

/** The columns of the `employees` table, as the parse needs them. */
export type StoredEmployee = {
	id: string;
	firstName: string;
	lastName: string;
	nationality: Nationality;
	canton: string | null;
	sourceTaxAnswers: unknown;
	createdAt: string;
};

export function parseEmployeeRow(row: StoredEmployee): EmployeeRow {
	const hasSourceTax = row.canton !== null || row.sourceTaxAnswers !== null;
	const candidate = {
		firstName: row.firstName,
		lastName: row.lastName,
		nationality: row.nationality,
		...(hasSourceTax
			? { sourceTax: { canton: row.canton, answers: row.sourceTaxAnswers } }
			: {}),
	};
	const parsed = OnboardingSchema.safeParse(candidate);
	return {
		id: row.id,
		firstName: row.firstName,
		lastName: row.lastName,
		nationality: row.nationality,
		createdAt: row.createdAt,
		employee: parsed.success ? parsed.data : null,
	};
}

export function createEmployeeRepo(db: Db): EmployeeRepo {
	const employees = db.orm.public.Employee;
	return {
		async create(employee) {
			const created = await employees.create(
				employee.nationality === "CH"
					? {
							firstName: employee.firstName,
							lastName: employee.lastName,
							nationality: employee.nationality,
							canton: null,
							sourceTaxAnswers: null,
						}
					: {
							firstName: employee.firstName,
							lastName: employee.lastName,
							nationality: employee.nationality,
							canton: employee.sourceTax.canton,
							sourceTaxAnswers: employee.sourceTax.answers,
						},
			);
			return { id: created.id };
		},
		async list() {
			const rows = await employees.orderBy((e) => e.createdAt.desc()).all();
			return rows.map(parseEmployeeRow);
		},
	};
}
