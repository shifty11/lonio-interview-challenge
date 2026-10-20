import { z } from "zod";
import type { TariffCode } from "./zurich/codes.ts";

export const Canton = z.enum(["ZH"]);
export type Canton = z.infer<typeof Canton>;

export type TariffResult =
	| { kind: "code"; code: TariffCode; remark: string | null }
	| { kind: "noSourceTax"; text: string; remark: string | null };
