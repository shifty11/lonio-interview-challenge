// The flow engine: prune, visibleQuestions, missingAnswers.
// Rule: a `visibleWhen` predicate reads earlier questions only. The engine passes the pruned
// prefix, so a forward reference reads `undefined`.

import { getPath, setPath } from "./path.ts";
import type { Flow, Option } from "./question.ts";

export type VisibleQuestion = {
	kind: "question";
	/** Concrete dot path, for example "children.list.1.sameHousehold". */
	path: string;
	/**
	 * Stable identity of the flow entry, for example "children.list.1.sharedCustody#6". Two label
	 * variants of one path have two keys. A renderer uses it as the element key and clears the
	 * value of a path when its key changes.
	 */
	key: string;
	label: string;
	options: readonly Option[];
	source: string;
};

export type VisibleItem = {
	index: number;
	/** Path of the item, for example "children.list.1". */
	path: string;
	questions: VisibleQuestion[];
};

export type VisibleGroup = {
	kind: "group";
	path: string;
	itemLabel: string;
	addLabel: string;
	items: VisibleItem[];
};

export type VisibleNode = VisibleQuestion | VisibleGroup;

type Walk<Root> = { pruned: Root; visible: VisibleNode[] };

function walk<Root extends object, Item extends object>(
	flow: Flow<Root, Item>,
	draft: Root,
): Walk<Root> {
	// A draft type has only optional keys, so the empty object is a valid `Root`.
	let pruned = {} as Root;
	const visible: VisibleNode[] = [];

	for (const [nodeIndex, node] of flow.entries()) {
		switch (node.kind) {
			case "question": {
				if (!node.visibleWhen(pruned)) {
					break;
				}
				visible.push({
					kind: "question",
					path: node.id,
					key: `${node.id}#${nodeIndex}`,
					label: node.label,
					options: node.options,
					source: node.source,
				});
				const answer = getPath(draft, node.id);
				if (answer !== undefined) {
					pruned = setPath(pruned, node.id, answer);
				}
				break;
			}
			case "group": {
				if (!node.visibleWhen(pruned)) {
					break;
				}
				const raw = getPath(draft, node.id);
				const rawItems: unknown[] = Array.isArray(raw) ? raw : [];
				const prunedItems: Item[] = [];
				const items: VisibleItem[] = [];
				// A `for` loop, not `forEach`: `forEach` skips a hole in a sparse list. A hole is an
				// empty item, so each item keeps its index.
				for (let index = 0; index < rawItems.length; index++) {
					const rawItem = rawItems[index];
					let item = {} as Item;
					const questions: VisibleQuestion[] = [];
					const itemPath = `${node.id}.${index}`;
					for (const [questionIndex, question] of node.items.entries()) {
						if (!question.visibleWhen(pruned, item)) {
							continue;
						}
						questions.push({
							kind: "question",
							path: `${itemPath}.${question.id}`,
							key: `${itemPath}.${question.id}#${nodeIndex}.${questionIndex}`,
							label: question.label,
							options: question.options,
							source: question.source,
						});
						const answer = getPath(rawItem, question.id);
						if (answer !== undefined) {
							item = setPath(item, question.id, answer);
						}
					}
					prunedItems.push(item);
					items.push({ index, path: itemPath, questions });
				}
				visible.push({
					kind: "group",
					path: node.id,
					itemLabel: node.itemLabel,
					addLabel: node.addLabel,
					items,
				});
				if (Array.isArray(raw)) {
					pruned = setPath(pruned, node.id, prunedItems);
				}
				break;
			}
			default: {
				const unreachable: never = node;
				return unreachable;
			}
		}
	}
	return { pruned, visible };
}

/**
 * Copies an answer only when its question is visible. A group that is not visible gives no array.
 * Idempotent: `prune(flow, prune(flow, x))` equals `prune(flow, x)`.
 */
export function prune<Root extends object, Item extends object>(
	flow: Flow<Root, Item>,
	draft: Root,
): Root {
	return walk(flow, draft).pruned;
}

/** The visible nodes of the pruned draft, with concrete paths. The renderer reads only this. */
export function visibleQuestions<Root extends object, Item extends object>(
	flow: Flow<Root, Item>,
	draft: Root,
): VisibleNode[] {
	return walk(flow, draft).visible;
}

/**
 * The paths of the visible questions with no answer, in flow order.
 * A visible group with no item reports the paths of item 0: the schema needs one item.
 */
export function missingAnswers<Root extends object, Item extends object>(
	flow: Flow<Root, Item>,
	draft: Root,
): string[] {
	const { pruned, visible } = walk(flow, draft);
	const missing: string[] = [];
	const check = (question: VisibleQuestion) => {
		if (getPath(pruned, question.path) === undefined) {
			missing.push(question.path);
		}
	};

	for (const node of visible) {
		switch (node.kind) {
			case "question":
				check(node);
				break;
			case "group": {
				if (node.items.length > 0) {
					for (const item of node.items) {
						item.questions.forEach(check);
					}
					break;
				}
				// An empty item shows the questions that need no earlier answer.
				const first = walk(flow, setPath(pruned, node.path, [{}]));
				for (const next of first.visible) {
					if (next.kind === "group" && next.path === node.path) {
						next.items[0]?.questions.forEach((question) => {
							missing.push(question.path);
						});
					}
				}
				break;
			}
			default: {
				const unreachable: never = node;
				return unreachable;
			}
		}
	}
	return missing;
}
