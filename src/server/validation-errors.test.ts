// Source: spec.md § 6 (submitOnboarding: "Required" at each path).

import { describe, expect, test } from "bun:test";
import { requiredErrors } from "./validation-errors.ts";

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
