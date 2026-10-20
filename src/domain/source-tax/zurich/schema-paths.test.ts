// Source: spec.md § 8. Every question id of `zhFlow` is a path of `ZhDraftSchema` and of at least
// one member of `ZhAnswersSchema`. An array index is written `#` here.

import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { zhFlow } from "./questions.ts";
import { ZhAnswersSchema, ZhDraftSchema } from "./schema.ts";

function collect(
	schema: z.core.$ZodType,
	prefix: string,
	into: Set<string>,
): void {
	if (prefix !== "") {
		into.add(prefix);
	}
	const join = (key: string) => (prefix === "" ? key : `${prefix}.${key}`);
	if (schema instanceof z.ZodOptional) {
		collect(schema.unwrap(), prefix, into);
	} else if (schema instanceof z.ZodArray) {
		collect(schema.element, join("#"), into);
	} else if (schema instanceof z.ZodUnion) {
		// A discriminated union is a union. A path of any member counts.
		for (const option of schema.options) {
			collect(option, prefix, into);
		}
	} else if (schema instanceof z.ZodObject) {
		for (const [key, child] of Object.entries(schema.shape)) {
			collect(child, join(key), into);
		}
	}
}

function pathsOf(schema: z.core.$ZodType): Set<string> {
	const into = new Set<string>();
	collect(schema, "", into);
	return into;
}

const questionIds = zhFlow.flatMap((node) =>
	node.kind === "question"
		? [node.id]
		: [node.id, ...node.items.map((item) => `${node.id}.#.${item.id}`)],
);

describe("question ids and schema paths", () => {
	const draftPaths = pathsOf(ZhDraftSchema);
	const answerPaths = pathsOf(ZhAnswersSchema);

	test("the flow has questions", () => {
		expect(questionIds.length).toBeGreaterThan(20);
	});

	for (const id of new Set(questionIds)) {
		test(`${id} is a path of ZhDraftSchema`, () => {
			expect(draftPaths.has(id)).toBe(true);
		});
		test(`${id} is a path of a member of ZhAnswersSchema`, () => {
			expect(answerPaths.has(id)).toBe(true);
		});
	}

	test("every leaf path of ZhAnswersSchema is a question id", () => {
		// `children.hasChildren` and `residence.residenceInSwitzerland` are questions too.
		const containers = new Set([
			"children",
			"residence",
			"children.list",
			"children.list.#",
		]);
		const ids = new Set(questionIds);
		for (const path of answerPaths) {
			if (!containers.has(path)) {
				expect(ids.has(path), path).toBe(true);
			}
		}
	});
});
