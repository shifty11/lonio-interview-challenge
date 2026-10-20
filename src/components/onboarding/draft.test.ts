// Tests of the form resolver and the draft helpers. Source: spec.md § 7 (the resolver calls prepareOnboarding).

import { describe, expect, test } from "bun:test";
import type { ResolverOptions } from "react-hook-form";
import type { OnboardingDraft } from "@/domain/onboarding/schema";
import {
	answerPath,
	isAnswerPath,
	onboardingResolver,
	openAnswerCount,
	toDraft,
} from "./draft";

const options: ResolverOptions<OnboardingDraft> = {
	fields: {},
	shouldUseNativeValidation: false,
};

describe("toDraft", () => {
	test("prunes the hidden answers", () => {
		const values: OnboardingDraft = {
			firstName: "A",
			lastName: "B",
			nationality: "IT",
			sourceTax: {
				canton: "ZH",
				answers: { incomeType: "replacement", civilStatus: "single" },
			},
		};
		expect(toDraft(values)).toEqual({
			firstName: "A",
			lastName: "B",
			nationality: "IT",
			sourceTax: { canton: "ZH", answers: { incomeType: "replacement" } },
		});
	});

	test("a Swiss employee has no sourceTax", () => {
		const draft = toDraft({
			firstName: "A",
			lastName: "B",
			nationality: "CH",
			sourceTax: { canton: "ZH", answers: { incomeType: "earned" } },
		});
		expect(draft).toEqual({ firstName: "A", lastName: "B", nationality: "CH" });
	});
});

describe("onboardingResolver", () => {
	test("an empty form has three errors", async () => {
		const result = await onboardingResolver(
			{ firstName: "", lastName: "" },
			undefined,
			options,
		);
		expect(Object.keys(result.errors).sort()).toEqual([
			"firstName",
			"lastName",
			"nationality",
		]);
		expect(result.errors.firstName?.message).toBe("Required");
	});

	test("a complete Swiss form passes", async () => {
		const result = await onboardingResolver(
			{ firstName: "A", lastName: "B", nationality: "CH" },
			undefined,
			options,
		);
		expect(result.errors).toEqual({});
		expect(result.values).toEqual({
			firstName: "A",
			lastName: "B",
			nationality: "CH",
		});
	});

	test("a non-Swiss form without answers marks the first question", async () => {
		const result = await onboardingResolver(
			{ firstName: "A", lastName: "B", nationality: "IT" },
			undefined,
			options,
		);
		expect(result.errors).toHaveProperty("sourceTax.answers.incomeType");
	});
});

test("openAnswerCount counts the open paths", () => {
	expect(openAnswerCount({ firstName: "", lastName: "" })).toBe(3);
	expect(
		openAnswerCount({ firstName: "A", lastName: "B", nationality: "CH" }),
	).toBe(0);
});

describe("answerPath", () => {
	test("accepts the paths of the flow", () => {
		expect(answerPath("children.list.0.group")).toBe(
			"sourceTax.answers.children.list.0.group",
		);
		expect(isAnswerPath("firstName")).toBe(false);
	});

	test("rejects a path outside the answers", () => {
		expect(() => answerPath("../x")).toThrow();
	});
});
