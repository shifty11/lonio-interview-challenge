// Walks every answer path of a flow. Tests only: no product code imports this file.
// The walk is depth-first. It answers the first open question with each of its options.
// A group with no item gets 1 to `maxItems` empty items, one branch per count.

import { missingAnswers, visibleQuestions } from "./engine.ts";
import { getPath, setPath } from "./path.ts";
import type { Flow } from "./question.ts";

export type AnswerStep = { path: string; value: unknown };

export type AnswerPath<Root> = {
	/** The complete draft at the end of the path. */
	draft: Root;
	/** The steps in order. Each step sets one path. */
	steps: AnswerStep[];
};

function optionsAt<Root extends object, Item extends object>(
	flow: Flow<Root, Item>,
	draft: Root,
	path: string,
): readonly unknown[] {
	for (const node of visibleQuestions(flow, draft)) {
		if (node.kind === "question") {
			if (node.path === path) {
				return node.options.map((option) => option.value);
			}
			continue;
		}
		for (const item of node.items) {
			for (const question of item.questions) {
				if (question.path === path) {
					return question.options.map((option) => option.value);
				}
			}
		}
	}
	throw new Error(`No visible question at ${path}`);
}

function emptyGroupAt<Root extends object, Item extends object>(
	flow: Flow<Root, Item>,
	draft: Root,
	path: string,
): string | undefined {
	for (const node of flow) {
		if (node.kind !== "group" || !path.startsWith(`${node.id}.`)) {
			continue;
		}
		const items = getPath(draft, node.id);
		if (!Array.isArray(items) || items.length === 0) {
			return node.id;
		}
	}
	return undefined;
}

function* walk<Root extends object, Item extends object>(
	flow: Flow<Root, Item>,
	draft: Root,
	steps: AnswerStep[],
	maxItems: number,
): Generator<AnswerPath<Root>> {
	const [path] = missingAnswers(flow, draft);
	if (path === undefined) {
		yield { draft, steps };
		return;
	}
	const groupId = emptyGroupAt(flow, draft, path);
	if (groupId !== undefined) {
		for (let count = 1; count <= maxItems; count++) {
			const items = Array.from({ length: count }, () => ({}));
			yield* walk(
				flow,
				setPath(draft, groupId, items),
				[...steps, { path: groupId, value: items }],
				maxItems,
			);
		}
		return;
	}
	for (const value of optionsAt(flow, draft, path)) {
		yield* walk(
			flow,
			setPath(draft, path, value),
			[...steps, { path, value }],
			maxItems,
		);
	}
}

/** Every complete answer path of the flow, with at most `maxItems` items in a group. */
export function enumerateAnswerPaths<Root extends object, Item extends object>(
	flow: Flow<Root, Item>,
	maxItems: number,
): Generator<AnswerPath<Root>> {
	// A draft type has only optional keys, so the empty object is a valid `Root`.
	return walk(flow, {} as Root, [], maxItems);
}
