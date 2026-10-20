// Source: spec.md § 8. Walks every answer path of `zhFlow` with 0, 1 and 2 children.
// The walk proves that the visibility rules give exactly the member sets of `ZhAnswersSchema`.

import { describe, expect, test } from "bun:test";
import { missingAnswers, prune } from "../../flow/engine.ts";
import { enumerateAnswerPaths } from "../../flow/enumerate.ts";
import { setPath } from "../../flow/path.ts";
import { TariffCode } from "./codes.ts";
import { computeTariffCode } from "./compute.ts";
import { zhFlow } from "./questions.ts";
import { ZhAnswersSchema, type ZhDraft } from "./schema.ts";

const MAX_CHILDREN = 2;

describe("every answer path of the Zurich flow", () => {
	const paths = [...enumerateAnswerPaths(zhFlow, MAX_CHILDREN)];

	test("the walk finds paths", () => {
		// Replacement income alone has 10 residence paths. Earned income has many more.
		expect(paths.length).toBeGreaterThan(1000);
	});

	test("each leaf has no missing answer", () => {
		for (const { draft, steps } of paths) {
			expect(missingAnswers(zhFlow, draft), JSON.stringify(steps)).toEqual([]);
		}
	});

	test("each leaf parses with ZhAnswersSchema", () => {
		for (const { draft, steps } of paths) {
			const parsed = ZhAnswersSchema.safeParse(draft);
			expect(parsed.success, JSON.stringify(steps)).toBe(true);
		}
	});

	test("each leaf is prune-stable", () => {
		for (const { draft, steps } of paths) {
			expect(prune(zhFlow, draft), JSON.stringify(steps)).toEqual(draft);
		}
	});

	test("each leaf gives a tariff code of records 06 and 11, or no source tax", () => {
		for (const { draft, steps } of paths) {
			const answers = ZhAnswersSchema.parse(draft);
			const result = computeTariffCode(answers);
			if (result.kind === "code") {
				expect(
					TariffCode.safeParse(result.code).success,
					JSON.stringify(steps),
				).toBe(true);
			} else {
				expect(result.kind).toBe("noSourceTax");
			}
		}
	});

	test("each strict prefix of a path has missing answers", () => {
		for (const { steps } of paths) {
			let draft: ZhDraft = {};
			for (const step of steps.slice(0, -1)) {
				draft = setPath(draft, step.path, step.value);
				expect(
					missingAnswers(zhFlow, draft).length,
					`${step.path} in ${JSON.stringify(steps)}`,
				).toBeGreaterThan(0);
			}
		}
	});

	test("the paths cover 0, 1 and 2 children", () => {
		const counts = new Set(
			paths.map(({ draft }) => draft.children?.list?.length ?? 0),
		);
		expect([...counts].sort()).toEqual([0, 1, 2]);
	});
});
