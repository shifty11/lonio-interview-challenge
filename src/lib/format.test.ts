// Source: PostgreSQL timestamptz text output.

import { describe, expect, test } from "bun:test";
import { formatAdded } from "./format.ts";

describe("formatAdded", () => {
	test("formats a PostgreSQL timestamptz in Zurich time", () => {
		expect(formatAdded("2026-10-20 13:24:47.123456+00")).toBe(
			"20 Oct 2026, 15:24",
		);
	});

	test("returns the input when it is not a date", () => {
		expect(formatAdded("not a date")).toBe("not a date");
	});
});
