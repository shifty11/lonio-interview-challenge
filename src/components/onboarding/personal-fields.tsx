"use client";

// First name, last name and a searchable nationality select.

import { Controller, useFormContext } from "react-hook-form";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COUNTRY_CODES, countryName } from "@/domain/onboarding/countries";
import type { OnboardingDraft } from "@/domain/onboarding/schema";

type CountryItem = { value: (typeof COUNTRY_CODES)[number]; label: string };

const COUNTRIES: readonly CountryItem[] = COUNTRY_CODES.map((code) => ({
	value: code,
	label: countryName(code),
})).sort((a, b) => a.label.localeCompare(b.label, "en"));

/** The message of the field: "Required" for a missing answer, the Zod message for an invalid one. */
function FieldError({
	id,
	error,
}: {
	id: string;
	error: { message?: string | undefined } | undefined;
}) {
	return error === undefined ? null : (
		<p id={id} role="alert" className="text-xs text-destructive">
			{error.message ?? "Required"}
		</p>
	);
}

export function PersonalFields() {
	const {
		register,
		control,
		formState: { errors },
	} = useFormContext<OnboardingDraft>();

	return (
		<div className="grid gap-3.5 sm:grid-cols-2">
			<div className="grid gap-1.5">
				<Label htmlFor="firstName">First name</Label>
				<Input
					id="firstName"
					autoComplete="given-name"
					maxLength={100}
					aria-invalid={errors.firstName !== undefined}
					aria-describedby="firstName-error"
					{...register("firstName")}
				/>
				<FieldError id="firstName-error" error={errors.firstName} />
			</div>
			<div className="grid gap-1.5">
				<Label htmlFor="lastName">Last name</Label>
				<Input
					id="lastName"
					autoComplete="family-name"
					maxLength={100}
					aria-invalid={errors.lastName !== undefined}
					aria-describedby="lastName-error"
					{...register("lastName")}
				/>
				<FieldError id="lastName-error" error={errors.lastName} />
			</div>
			<div className="grid gap-1.5 sm:col-span-2">
				<Label htmlFor="nationality">Nationality</Label>
				<Controller
					control={control}
					name="nationality"
					render={({ field }) => (
						<Combobox
							items={COUNTRIES}
							value={COUNTRIES.find((c) => c.value === field.value) ?? null}
							onValueChange={(item) => field.onChange(item?.value)}
						>
							<ComboboxInput
								id="nationality"
								placeholder="Search a country"
								aria-invalid={errors.nationality !== undefined}
								aria-describedby="nationality-error"
								onBlur={field.onBlur}
								ref={field.ref}
							/>
							<ComboboxContent>
								<ComboboxEmpty>No country found.</ComboboxEmpty>
								<ComboboxList>
									{(item: CountryItem) => (
										<ComboboxItem key={item.value} value={item}>
											{item.label} ({item.value})
										</ComboboxItem>
									)}
								</ComboboxList>
							</ComboboxContent>
						</Combobox>
					)}
				/>
				<FieldError id="nationality-error" error={errors.nationality} />
			</div>
		</div>
	);
}
