"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { returnValidationErrors } from "next-safe-action";
import { OnboardingDraftSchema } from "@/domain/onboarding/schema";
import { issueErrors, requiredErrors } from "@/lib/validation-errors";
import { submitOnboardingCore } from "@/server/onboarding";
import { employeeRepo } from "@/server/repo";
import { actionClient } from "@/server/safe-action";

export const submitOnboarding = actionClient
	.inputSchema(OnboardingDraftSchema)
	.action(async ({ parsedInput }) => {
		const result = await submitOnboardingCore(parsedInput, employeeRepo);
		switch (result.kind) {
			case "missing":
				return returnValidationErrors(
					OnboardingDraftSchema,
					requiredErrors(result.paths),
				);
			case "invalid":
				return returnValidationErrors(
					OnboardingDraftSchema,
					issueErrors(result.issues),
				);
			case "saved": {
				revalidatePath("/hr");
				return redirect("/onboarding/done");
			}
			default: {
				const unreachable: never = result;
				return unreachable;
			}
		}
	});
