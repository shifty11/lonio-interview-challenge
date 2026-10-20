import { describe, expect, test } from "bun:test";
import { missingAnswers, prune, visibleQuestions } from "./engine.ts";
import { enumerateAnswerPaths } from "./enumerate.ts";
import { getPath, setPath } from "./path.ts";
import type { Flow, Option } from "./question.ts";

// A small flow with no domain meaning: `a` opens `b`, `b = true` opens a group of items.
type Item = { x?: boolean; y?: boolean };
type Root = {
	a?: boolean;
	b?: boolean;
	forward?: boolean;
	late?: boolean;
	list?: Item[];
};

const YES_NO: readonly Option[] = [
	{ value: true, label: "Yes" },
	{ value: false, label: "No" },
];

const flow: Flow<Root, Item> = [
	{
		kind: "question",
		id: "a",
		label: "A",
		options: YES_NO,
		visibleWhen: () => true,
		source: "test",
	},
	{
		kind: "question",
		id: "b",
		label: "B",
		options: YES_NO,
		visibleWhen: (root) => root.a === true,
		source: "test",
	},
	{
		// Forward reference: `late` is asked after this question.
		kind: "question",
		id: "forward",
		label: "Forward",
		options: YES_NO,
		visibleWhen: (root) => root.late === true,
		source: "test",
	},
	{
		kind: "question",
		id: "late",
		label: "Late",
		options: YES_NO,
		visibleWhen: () => true,
		source: "test",
	},
	{
		kind: "group",
		id: "list",
		itemLabel: "Item",
		addLabel: "Add item",
		visibleWhen: (root) => root.b === true,
		items: [
			{
				kind: "question",
				id: "x",
				label: "X",
				options: YES_NO,
				visibleWhen: () => true,
				source: "test",
			},
			{
				kind: "question",
				id: "y",
				label: "Y",
				options: YES_NO,
				visibleWhen: (_root, item) => item.x === true,
				source: "test",
			},
		],
	},
];

describe("getPath and setPath", () => {
	const cases: { name: string; obj: object; path: string; value: unknown }[] = [
		{ name: "top level key", obj: { a: 1 }, path: "a", value: 1 },
		{ name: "nested key", obj: { a: { b: 2 } }, path: "a.b", value: 2 },
		{
			name: "array index",
			obj: { list: [{ x: 1 }, { x: 3 }] },
			path: "list.1.x",
			value: 3,
		},
		{ name: "missing key", obj: { a: 1 }, path: "b.c", value: undefined },
	];
	for (const { name, obj, path, value } of cases) {
		test(`getPath: ${name}`, () => {
			expect(getPath(obj, path)).toBe(value);
		});
	}

	test("setPath creates objects and arrays", () => {
		expect(setPath({}, "a.b", 1)).toEqual({ a: { b: 1 } });
		expect(setPath({}, "list.1.x", true)).toEqual({
			list: [undefined, { x: true }],
		});
	});

	test("setPath does not mutate its input", () => {
		const input = { list: [{ x: 1 }], a: { b: 1 } };
		const snapshot = structuredClone(input);
		const output = setPath(input, "list.0.x", 2);
		expect(input).toEqual(snapshot);
		expect(output).toEqual({ list: [{ x: 2 }], a: { b: 1 } });
	});
});

describe("prune", () => {
	test("drops the answers of hidden questions", () => {
		const draft: Root = { a: false, b: true, list: [{ x: true }] };
		expect(prune(flow, draft)).toEqual({ a: false });
	});

	test("a group that is not visible gives no array", () => {
		const draft: Root = { a: true, b: false, list: [{ x: true }] };
		expect(prune(flow, draft)).toEqual({
			a: true,
			b: false,
		});
	});

	test("a forward reference reads undefined", () => {
		// `forward` comes before `late`, so its predicate sees no `late`.
		const draft: Root = { late: true, forward: true };
		expect(prune(flow, draft)).toEqual({ late: true });
	});

	test("keeps the visible answers of each item", () => {
		const draft: Root = {
			a: true,
			b: true,
			list: [
				{ x: true, y: false },
				{ x: false, y: true },
			],
		};
		expect(prune(flow, draft)).toEqual({
			a: true,
			b: true,
			list: [{ x: true, y: false }, { x: false }],
		});
	});

	const drafts: Root[] = [
		{},
		{ a: true, b: true, list: [{}] },
		{ a: false, b: true, late: true, list: [{ x: true, y: true }] },
		{
			a: true,
			b: true,
			late: false,
			list: [{ x: false, y: true }, { y: false }],
		},
	];
	drafts.forEach((draft, index) => {
		test(`is idempotent (draft ${index})`, () => {
			const once = prune(flow, draft);
			expect(prune(flow, once)).toEqual(once);
		});
	});
});

describe("visibleQuestions", () => {
	test("gives concrete paths for group items", () => {
		const nodes = visibleQuestions(flow, {
			a: true,
			b: true,
			list: [{ x: true }, {}],
		});
		const group = nodes.find((node) => node.kind === "group");
		expect(group?.kind === "group" && group.path).toBe("list");
		const paths =
			group?.kind === "group"
				? group.items.flatMap((item) => item.questions.map((q) => q.path))
				: [];
		expect(paths).toEqual(["list.0.x", "list.0.y", "list.1.x"]);
	});
});

describe("visibleQuestions keys", () => {
	// Two label variants share the path `v` (root) and `list.<i>.w` (item). Only one shows.
	const variantFlow: Flow<Root & { v?: boolean }, Item & { w?: boolean }> = [
		{
			kind: "question",
			id: "a",
			label: "A",
			options: YES_NO,
			visibleWhen: () => true,
			source: "test",
		},
		{
			kind: "question",
			id: "v",
			label: "V when a",
			options: YES_NO,
			visibleWhen: (root) => root.a === true,
			source: "test",
		},
		{
			kind: "question",
			id: "v",
			label: "V when not a",
			options: YES_NO,
			visibleWhen: (root) => root.a === false,
			source: "test",
		},
		{
			kind: "group",
			id: "list",
			itemLabel: "Item",
			addLabel: "Add item",
			visibleWhen: () => true,
			items: [
				{
					kind: "question",
					id: "x",
					label: "X",
					options: YES_NO,
					visibleWhen: () => true,
					source: "test",
				},
				{
					kind: "question",
					id: "w",
					label: "W when x",
					options: YES_NO,
					visibleWhen: (_root, item) => item.x === true,
					source: "test",
				},
				{
					kind: "question",
					id: "w",
					label: "W when not x",
					options: YES_NO,
					visibleWhen: (_root, item) => item.x === false,
					source: "test",
				},
			],
		},
	];

	function keysOf(draft: Root & { v?: boolean }): Record<string, string> {
		const keys: Record<string, string> = {};
		for (const node of visibleQuestions(variantFlow, draft)) {
			if (node.kind === "question") {
				keys[node.label] = node.key;
				continue;
			}
			for (const item of node.items) {
				for (const question of item.questions) {
					keys[question.label] = question.key;
				}
			}
		}
		return keys;
	}

	test("two variants of one root path have two keys", () => {
		const yes = keysOf({ a: true });
		const no = keysOf({ a: false });
		expect(yes["V when a"]).toBeDefined();
		expect(no["V when not a"]).toBeDefined();
		expect(yes["V when a"]).not.toBe(no["V when not a"]);
	});

	test("two variants of one item path have two keys", () => {
		const yes = keysOf({ list: [{ x: true }] });
		const no = keysOf({ list: [{ x: false }] });
		expect(yes["W when x"]).toBeDefined();
		expect(no["W when not x"]).toBeDefined();
		expect(yes["W when x"]).not.toBe(no["W when not x"]);
	});

	test("the key of a question does not change while it stays visible", () => {
		expect(keysOf({ a: true })["V when a"]).toBe(
			keysOf({ a: true, v: true })["V when a"],
		);
	});
});

describe("missingAnswers", () => {
	const cases: { name: string; draft: Root; missing: string[] }[] = [
		{ name: "empty draft", draft: {}, missing: ["a", "late"] },
		{
			name: "group with no array reports item 0",
			draft: { a: true, b: true, late: false },
			missing: ["list.0.x"],
		},
		{
			name: "group with 0 items reports item 0",
			draft: { a: true, b: true, late: false, list: [] },
			missing: ["list.0.x"],
		},
		{
			name: "group item reports its open questions",
			draft: { a: true, b: true, late: false, list: [{ x: true }] },
			missing: ["list.0.y"],
		},
		{
			name: "complete draft",
			draft: { a: true, b: false, late: true },
			missing: [],
		},
	];
	for (const { name, draft, missing } of cases) {
		test(name, () => {
			expect(missingAnswers(flow, draft)).toEqual(missing);
		});
	}
});

describe("enumerateAnswerPaths", () => {
	test("every leaf is complete and prune-stable", () => {
		let leaves = 0;
		for (const { draft } of enumerateAnswerPaths(flow, 2)) {
			leaves++;
			expect(missingAnswers(flow, draft)).toEqual([]);
			expect(prune(flow, draft)).toEqual(draft);
		}
		// a = false: 2 (late). a = true, b = false: 2.
		// a = true, b = true: 2 (late) x (1 item: 3 paths; 2 items: 9 paths) = 24.
		expect(leaves).toBe(2 + 2 + 24);
	});
});
