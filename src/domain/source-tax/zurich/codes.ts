import { z } from "zod";
import { ZH_2026_CODES } from "./tariff-2026.generated.ts";

/** Every table of the 2026 Zurich file (records 06 and 11). */
export const TariffCode = z.enum(ZH_2026_CODES);
export type TariffCode = z.infer<typeof TariffCode>;
