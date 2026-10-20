// Source: spec.md § 6. Each database enum equals its domain z.enum list.
// The test reads the emitted contract, not a live database.

import { describe, expect, test } from "bun:test";
import { COUNTRY_CODES, Nationality } from "../domain/onboarding/countries.ts";
import { Canton } from "../domain/source-tax/types.ts";
import contractJson from "../prisma/contract.json" with { type: "json" };

const nativeEnums = contractJson.storage.namespaces.public.entries.native_enum;

describe("Prisma enums", () => {
	test("Nationality equals the domain list (same members, same order)", () => {
		expect(nativeEnums.nationality.typeName).toBe("nationality");
		expect(nativeEnums.nationality.members).toEqual([...Nationality.options]);
		expect(nativeEnums.nationality.members).toEqual([...COUNTRY_CODES]);
	});

	test("Canton equals the domain list (same members, same order)", () => {
		expect(nativeEnums.canton.typeName).toBe("canton");
		expect(nativeEnums.canton.members).toEqual([...Canton.options]);
	});
});
