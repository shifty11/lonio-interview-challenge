import type { SourceTaxModule } from "../types.ts";
import type { TariffCode } from "./codes.ts";
import { computeTariffCode } from "./compute.ts";
import { previewTariff } from "./preview.ts";
import { zhFlow } from "./questions.ts";
import {
	type ZhAnswers,
	ZhAnswersSchema,
	type ZhDraft,
	type ZhDraftChild,
	ZhDraftSchema,
} from "./schema.ts";

export const zurichModule = {
	canton: "ZH",
	draftSchema: ZhDraftSchema,
	answersSchema: ZhAnswersSchema,
	flow: zhFlow,
	compute: computeTariffCode,
	preview: previewTariff,
} satisfies SourceTaxModule<ZhDraft, ZhAnswers, TariffCode, ZhDraftChild>;
