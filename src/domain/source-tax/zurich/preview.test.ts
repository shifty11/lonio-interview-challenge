// Source: spec.md § 8, calc-spec § 9 (golden cases #1, #2, #14, #16).

import { describe, expect, test } from "bun:test";
import type { TariffCode } from "./codes.ts";
import { previewTariff } from "./preview.ts";
import type { ZhDraft } from "./schema.ts";

describe("previewTariff", () => {
	test("an empty draft is incomplete (calc-spec § 3 #1)", () => {
		expect(previewTariff({})).toEqual({
			kind: "incomplete",
			missing: ["incomeType"],
		});
	});

	test("a visible group with no child reports child 0 (spec.md § 3)", () => {
		const draft: ZhDraft = {
			incomeType: "earned",
			civilStatus: "single",
			churchMember: false,
			children: { hasChildren: true },
			residence: { residenceInSwitzerland: true },
		};
		expect(previewTariff(draft)).toEqual({
			kind: "incomplete",
			missing: ["children.list.0.group"],
		});
	});

	test("an incomplete child is reported by path (rule R)", () => {
		const draft: ZhDraft = {
			incomeType: "earned",
			civilStatus: "single",
			churchMember: false,
			children: { hasChildren: true, list: [{ group: "underage" }] },
			residence: { residenceInSwitzerland: true },
		};
		expect(previewTariff(draft)).toEqual({
			kind: "incomplete",
			missing: ["children.list.0.childInSameHousehold"],
		});
	});

	const cases: {
		name: string;
		source: string;
		draft: ZhDraft;
		code: TariffCode;
	}[] = [
		{
			name: "single, no church, no children, Switzerland",
			source: "calc-spec § 9 #1",
			draft: {
				incomeType: "earned",
				civilStatus: "single",
				churchMember: false,
				children: { hasChildren: false },
				residence: { residenceInSwitzerland: true },
			},
			code: "A0N",
		},
		{
			name: "married, church, spouse not employed, no children",
			source: "calc-spec § 9 #2",
			draft: {
				incomeType: "earned",
				civilStatus: "married",
				churchMember: true,
				spouseEmployed: false,
				children: { hasChildren: false },
				residence: { residenceInSwitzerland: true },
			},
			code: "B0Y",
		},
		{
			name: "replacement income, Switzerland (G9N)",
			source: "calc-spec § 9 #16, plan.md Fixed decisions",
			draft: {
				incomeType: "replacement",
				residence: { residenceInSwitzerland: true },
			},
			code: "G9N",
		},
	];
	for (const { name, source, draft, code } of cases) {
		test(`${name} (${source})`, () => {
			expect(previewTariff(draft)).toEqual({
				kind: "code",
				code,
				remark: null,
			});
		});
	}

	test("Liechtenstein, daily return: no source tax with a remark (calc-spec § 9 #14)", () => {
		const draft: ZhDraft = {
			incomeType: "replacement",
			residence: {
				residenceInSwitzerland: false,
				countryOfResidence: "LI",
				dailyReturnToLiechtenstein: true,
			},
		};
		expect(previewTariff(draft)).toEqual({
			kind: "noSourceTax",
			text: "No source tax in principle",
			remark: "Subject to the double taxation agreement",
		});
	});

	test("a stale answer is ignored (spec.md § 4)", () => {
		const draft: ZhDraft = {
			incomeType: "replacement",
			civilStatus: "married",
			spouseEmployed: true,
			residence: { residenceInSwitzerland: true },
		};
		expect(previewTariff(draft)).toEqual({
			kind: "code",
			code: "G9N",
			remark: null,
		});
	});
});
