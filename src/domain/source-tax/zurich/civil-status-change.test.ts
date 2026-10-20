// Source: calc-spec § 7.2 (live check 2026-10-20). The calculator keeps the married child result
// after a change of the civil status and shows `H0N`. This app computes from the current answers.

import { expect, test } from "bun:test";
import { prune } from "../../flow/engine.ts";
import { setPath } from "../../flow/path.ts";
import { previewTariff } from "./preview.ts";
import { zhFlow } from "./questions.ts";
import type { ZhDraft } from "./schema.ts";

test("married, then single: the code is A0N, not H0N (calc-spec § 7.2)", () => {
	// Step 1: earned, married, no church, partner employed, one child "neither", residence Switzerland.
	const married: ZhDraft = {
		incomeType: "earned",
		civilStatus: "married",
		churchMember: false,
		spouseEmployed: true,
		children: { hasChildren: true, list: [{ group: "other" }] },
		residence: { residenceInSwitzerland: true },
	};
	expect(previewTariff(married)).toEqual({
		kind: "code",
		code: "C0N",
		remark: null,
	});

	// Step 2: change the civil status.
	const single = setPath(married, "civilStatus", "single");
	expect(prune(zhFlow, single).spouseEmployed).toBeUndefined();

	// Step 3: the result follows the current answers.
	expect(previewTariff(single)).toEqual({
		kind: "code",
		code: "A0N",
		remark: null,
	});
});
