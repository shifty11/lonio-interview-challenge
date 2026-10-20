// Source: spec.md § 6 (submitOnboarding: "Required" at each path).

import { describe, expect, test } from "bun:test";
import {
	issueErrors,
	prepareErrors,
	requiredErrors,
} from "./validation-errors.ts";

describe("requiredErrors", () => {
	test("builds one Required node per path, nested by the dot path", () => {
		const tree: unknown = requiredErrors([
			"firstName",
			"sourceTax.answers.children.list.0.group",
			"sourceTax.answers.incomeType",
		]);
		expect(tree).toEqual({
			firstName: { _errors: ["Required"] },
			sourceTax: {
				answers: {
					incomeType: { _errors: ["Required"] },
					children: { list: { 0: { group: { _errors: ["Required"] } } } },
				},
			},
		});
	});

	test("no path gives an empty tree", () => {
		const tree: unknown = requiredErrors([]);
		expect(tree).toEqual({});
	});
});

describe("issueErrors", () => {
	test("puts the message of each issue at its path (Zod message)", () => {
		const tree: unknown = issueErrors([
			{ path: "firstName", message: "Too long" },
			{ path: "firstName", message: "Required" },
		]);
		expect(tree).toEqual({ firstName: { _errors: ["Too long", "Required"] } });
	});
});

describe("prepareErrors", () => {
	test("a missing result gives Required", () => {
		const tree: unknown = prepareErrors({
			kind: "missing",
			paths: ["lastName"],
		});
		expect(tree).toEqual({ lastName: { _errors: ["Required"] } });
	});

	test("an invalid result gives the Zod message", () => {
		const tree: unknown = prepareErrors({
			kind: "invalid",
			issues: [{ path: "lastName", message: "Too long" }],
		});
		expect(tree).toEqual({ lastName: { _errors: ["Too long"] } });
	});
});
