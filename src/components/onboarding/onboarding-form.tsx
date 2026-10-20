"use client";

// The onboarding form. The shared Zod schema types the server action. The resolver calls
// `prepareOnboarding`. `shouldUnregister` drops the value of a hidden question, so a question
// that shows again is empty. The server prunes again: the form state is not trusted.

import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { FormProvider, useWatch } from "react-hook-form";
import { submitOnboarding } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { defaultValues, onboardingResolver, openAnswerCount } from "./draft";
import { FlowRenderer } from "./flow-renderer";
import { PersonalFields } from "./personal-fields";
import { TariffPreview } from "./tariff-preview";

function SourceTaxBlock() {
	const nationality = useWatch({ name: "nationality" });
	if (nationality === undefined) {
		return (
			<p className="text-sm text-muted-foreground">
				Select your nationality first. Then the source-tax questions appear.
			</p>
		);
	}
	if (nationality === "CH") {
		return (
			<p className="rounded-lg bg-ok-soft p-3.5 text-ok">
				Swiss citizen: no source tax. You do not need to give more details.
			</p>
		);
	}
	return <FlowRenderer />;
}

export function OnboardingForm() {
	const { form, action, handleSubmitWithAction } = useHookFormAction(
		submitOnboarding,
		onboardingResolver,
		{ formProps: { shouldUnregister: true, defaultValues } },
	);
	const values = form.watch();
	const submitted = form.formState.submitCount > 0;
	const open = submitted ? openAnswerCount(values) : 0;

	return (
		<FormProvider {...form}>
			<div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_320px] md:items-start">
				<form onSubmit={handleSubmitWithAction} noValidate>
					<Card className="gap-0 p-0">
						<section className="p-5">
							<h2 className="mb-3.5 text-base font-semibold">Person</h2>
							<PersonalFields />
						</section>
						<section className="border-t p-5">
							<div className="mb-3.5 flex flex-wrap items-baseline gap-2.5">
								<h2 className="text-base font-semibold">
									Source tax, canton of Zurich
								</h2>
								<span className="text-sm text-muted-foreground">
									Details for the tariff code
								</span>
							</div>
							<SourceTaxBlock />
						</section>
						<div className="flex flex-wrap items-center justify-end gap-2.5 border-t px-5 py-4">
							{open > 0 ? (
								<span
									role="status"
									className="mr-auto text-sm text-destructive"
								>
									{open} {open === 1 ? "answer is" : "answers are"} missing
								</span>
							) : null}
							{action.result.serverError !== undefined ? (
								<span role="alert" className="mr-auto text-sm text-destructive">
									{action.result.serverError}
								</span>
							) : null}
							<Button type="submit" disabled={action.isPending}>
								{action.isPending ? "Submitting…" : "Submit"}
							</Button>
						</div>
					</Card>
				</form>
				<aside className="max-md:order-first">
					<TariffPreview />
				</aside>
			</div>
		</FormProvider>
	);
}
