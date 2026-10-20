// One module per canton. A new canton adds a module and one entry here.

import type { Canton, SourceTaxModule } from "./types.ts";
import type { TariffCode } from "./zurich/codes.ts";
import { zurichModule } from "./zurich/module.ts";
import type { ZhAnswers, ZhDraft, ZhDraftChild } from "./zurich/schema.ts";

export const sourceTaxModules = {
	ZH: zurichModule,
} as const satisfies Record<
	Canton,
	SourceTaxModule<ZhDraft, ZhAnswers, TariffCode, ZhDraftChild>
>;
