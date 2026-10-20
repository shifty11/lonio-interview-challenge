import { z } from "zod";
import type { Flow } from "../flow/question.ts";

export const Canton = z.enum(["ZH"]);
export type Canton = z.infer<typeof Canton>;

export type TariffResult<Code extends string> =
	| { kind: "code"; code: Code; remark: string | null }
	| { kind: "noSourceTax"; text: string; remark: string | null };

/** The result of a preview: a tariff result, or the paths of the open questions. */
export type TariffPreview<Code extends string> =
	| TariffResult<Code>
	| { kind: "incomplete"; missing: string[] };

/** One canton: its schemas, its question flow and its tariff functions. */
export type SourceTaxModule<
	Draft extends object,
	Answers,
	Code extends string,
	Item extends object,
> = {
	canton: Canton;
	draftSchema: z.ZodType<Draft>;
	answersSchema: z.ZodType<Answers>;
	flow: Flow<Draft, Item>;
	compute: (answers: Answers) => TariffResult<Code>;
	preview: (draft: Draft) => TariffPreview<Code>;
};
