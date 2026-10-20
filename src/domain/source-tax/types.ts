import { z } from "zod";

export const Canton = z.enum(["ZH"]);
export type Canton = z.infer<typeof Canton>;

export type TariffResult<Code extends string> =
	| { kind: "code"; code: Code; remark: string | null }
	| { kind: "noSourceTax"; text: string; remark: string | null };
