// Source: spec.md § 8. A change of an answer drops the answers of the branches that close.

import { describe, expect, test } from "bun:test";
import { prune } from "../../flow/engine.ts";
import { setPath } from "../../flow/path.ts";
import { zhFlow } from "./questions.ts";
import type { ZhDraft } from "./schema.ts";

const married: ZhDraft = {
	incomeType: "earned",
	civilStatus: "married",
	churchMember: true,
	spouseEmployed: false,
	children: {
		hasChildren: true,
		list: [
			{
				group: "underage",
				childInSameHousehold: true,
				sharedCustody: true,
				sameHousehold: true,
			},
		],
	},
	residence: {
		residenceInSwitzerland: false,
		countryOfResidence: "DE",
		dailyReturnToGermany: true,
		gre1Gre2: true,
	},
};

describe("prune idempotence", () => {
	const drafts: { name: string; draft: ZhDraft }[] = [
		{ name: "empty", draft: {} },
		{ name: "married with a child and residence", draft: married },
		{
			name: "stale spouse answer after a switch to single",
			draft: { ...married, civilStatus: "single" },
		},
		{
			name: "stale residence answers after a switch to Liechtenstein",
			draft: setPath(married, "residence.countryOfResidence", "LI"),
		},
	];
	for (const { name, draft } of drafts) {
		test(name, () => {
			const once = prune(zhFlow, draft);
			expect(prune(zhFlow, once)).toEqual(once);
		});
	}
});

describe("a change drops the stale branch", () => {
	test("civilStatus married to single drops spouseEmployed (calc-spec § 3 #4)", () => {
		const pruned = prune(zhFlow, setPath(married, "civilStatus", "single"));
		expect(pruned.spouseEmployed).toBeUndefined();
		expect(pruned.churchMember).toBe(true);
	});

	test("incomeType earned to replacement drops civil status, church and children (calc-spec § 3 #1)", () => {
		const pruned = prune(zhFlow, setPath(married, "incomeType", "replacement"));
		expect(pruned).toEqual({
			incomeType: "replacement",
			residence: married.residence,
		});
	});

	test("child group underage to other drops the child answers (calc-spec § 4.1)", () => {
		const pruned = prune(
			zhFlow,
			setPath(married, "children.list.0.group", "other"),
		);
		expect(pruned.children?.list).toEqual([{ group: "other" }]);
	});

	test("countryOfResidence DE to LI drops the German answers (calc-spec § 5)", () => {
		const pruned = prune(
			zhFlow,
			setPath(married, "residence.countryOfResidence", "LI"),
		);
		expect(pruned.residence).toEqual({
			residenceInSwitzerland: false,
			countryOfResidence: "LI",
		});
	});

	test("residenceInSwitzerland false to true drops the country (calc-spec § 5)", () => {
		const pruned = prune(
			zhFlow,
			setPath(married, "residence.residenceInSwitzerland", true),
		);
		expect(pruned.residence).toEqual({ residenceInSwitzerland: true });
	});

	test("hasChildren true to false drops the list (spec.md § 4)", () => {
		const pruned = prune(
			zhFlow,
			setPath(married, "children.hasChildren", false),
		);
		expect(pruned.children).toEqual({ hasChildren: false });
	});

	test("hasChildren cleared drops the list and the residence (rule R)", () => {
		const pruned = prune(
			zhFlow,
			setPath(married, "children.hasChildren", undefined),
		);
		expect(pruned.children).toBeUndefined();
		expect(pruned.residence).toBeUndefined();
	});
});
