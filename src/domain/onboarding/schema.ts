// The onboarding record. A Swiss employee has no source-tax block.
// Every other nationality has one, because the brief treats every non-Swiss person as source-taxed.
// The schemas are strict: an extra key, for example a `tariffCode`, fails the parse.

import { z } from "zod";
import { ZhAnswersSchema, ZhDraftSchema } from "../source-tax/zurich/schema.ts";
import { Nationality } from "./countries.ts";

export const Name = z.string().trim().min(1, "Required").max(100);

/** The form state. Every answer can be empty. */
export const OnboardingDraftSchema = z.strictObject({
	firstName: z.string(),
	lastName: z.string(),
	nationality: Nationality.optional(),
	sourceTax: z
		.strictObject({ canton: z.literal("ZH"), answers: ZhDraftSchema })
		.optional(),
});
export type OnboardingDraft = z.infer<typeof OnboardingDraftSchema>;

/** The complete record. The tariff code is not part of it: the dashboard computes it. */
export const OnboardingSchema = z.discriminatedUnion("nationality", [
	z.strictObject({
		firstName: Name,
		lastName: Name,
		nationality: z.literal("CH"),
	}),
	z.strictObject({
		firstName: Name,
		lastName: Name,
		nationality: Nationality.exclude(["CH"]),
		sourceTax: z.strictObject({
			canton: z.literal("ZH"),
			answers: ZhAnswersSchema,
		}),
	}),
]);
export type Onboarding = z.infer<typeof OnboardingSchema>;
