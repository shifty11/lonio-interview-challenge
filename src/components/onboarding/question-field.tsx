"use client";

// One radio group for one visible question. The option index maps to the typed option value,
// so a boolean or an enum value reaches the form state unchanged.

import { useController, useFormContext } from "react-hook-form";
import type { Option } from "@/domain/flow/question";
import type { OnboardingDraft } from "@/domain/onboarding/schema";
import { cn } from "@/lib/utils";
import type { DraftPath } from "./draft";

type Props = {
	/** The path in the form, for example `sourceTax.answers.children.list.0.group`. */
	name: DraftPath;
	label: string;
	options: readonly Option[];
	onAnswer?: (value: string | boolean) => void;
};

export function QuestionField({ name, label, options, onAnswer }: Props) {
	const { control } = useFormContext<OnboardingDraft>();
	const { field, fieldState } = useController({ control, name });
	const invalid = fieldState.error !== undefined;

	return (
		<div
			role="radiogroup"
			aria-label={label}
			aria-invalid={invalid}
			className="grid gap-2 border-t border-dashed py-3 first:border-t-0 first:pt-0"
		>
			<div className="font-medium text-pretty">
				{label}
				{invalid ? (
					<span role="alert" className="ml-2 text-xs text-destructive">
						Required
					</span>
				) : null}
			</div>
			<div className="flex flex-wrap gap-2">
				{options.map((option, index) => (
					<label key={String(option.value)} className="relative">
						<input
							type="radio"
							className="peer sr-only"
							name={name}
							checked={field.value === option.value}
							onChange={() => {
								field.onChange(option.value);
								onAnswer?.(option.value);
							}}
							onBlur={field.onBlur}
							ref={index === 0 ? field.ref : undefined}
						/>
						<span
							className={cn(
								"inline-block cursor-pointer rounded-lg border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary",
								"peer-checked:border-primary peer-checked:bg-accent peer-checked:font-medium peer-checked:text-accent-foreground",
								"peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
								invalid && "border-destructive",
							)}
						>
							{option.label}
						</span>
					</label>
				))}
			</div>
		</div>
	);
}
