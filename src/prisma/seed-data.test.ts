// Source: spec.md § 6 (seed). Each seed record passes OnboardingSchema.

import { describe, expect, test } from "bun:test";
import { employeeTariff } from "../domain/onboarding/employee-tariff.ts";
import { prepareOnboarding } from "../domain/onboarding/prepare.ts";
import { seedEmployees } from "./seed-data.ts";

const expected: Record<string, string> = {
	"Anna Keller": "swiss",
	"Luca Rossi": "A0N",
	"Marta Silva": "H1Y",
	"Jan Novak": "C2N",
	"Klaus Weber": "L0N",
	"Mia Frick": "noSourceTax",
	"Priya Nair": "G9N",
};

describe("seed employees", () => {
	test("there are seven", () => {
		expect(seedEmployees).toHaveLength(7);
	});

	for (const { source, ...draft } of seedEmployees) {
		const name = `${draft.firstName} ${draft.lastName}`;
		test(`${name} passes the schema (${source})`, () => {
			const prepared = prepareOnboarding(draft);
			if (prepared.kind === "missing") {
				throw new Error(prepared.paths.join(", "));
			}
			const tariff = employeeTariff(prepared.value);
			const label: string = tariff.kind === "code" ? tariff.code : tariff.kind;
			expect(label).toBe(expected[name] ?? "unknown");
		});
	}
});
