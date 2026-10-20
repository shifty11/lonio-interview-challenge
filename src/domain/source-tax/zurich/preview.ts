// previewTariff: the tariff code of a draft, or the open questions.
// The form shows it while the person types. The steps are the same as on the server.

import { missingAnswers, prune } from "../../flow/engine.ts";
import type { TariffPreview } from "../types.ts";
import type { TariffCode } from "./codes.ts";
import { computeTariffCode } from "./compute.ts";
import { zhFlow } from "./questions.ts";
import { ZhAnswersSchema, type ZhDraft } from "./schema.ts";

export type PreviewResult = TariffPreview<TariffCode>;

export function previewTariff(draft: ZhDraft): PreviewResult {
	const pruned = prune(zhFlow, draft);
	const missing = missingAnswers(zhFlow, pruned);
	if (missing.length > 0) {
		return { kind: "incomplete", missing };
	}
	const parsed = ZhAnswersSchema.safeParse(pruned);
	if (!parsed.success) {
		// No open question and no valid answers: the flow data and the schema disagree. This is a bug, not a user error.
		throw new Error(
			`The Zurich flow and ZhAnswersSchema disagree: ${parsed.error.message}`,
		);
	}
	return computeTariffCode(parsed.data);
}
