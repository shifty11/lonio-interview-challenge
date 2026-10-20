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

function FieldError({ id, show }: { id: string; show: boolean }) {
	return show ? (
		<p id={id} role="alert" className="text-xs text-destructive">
			Required
		</p>
	) : null;
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
					aria-invalid={errors.firstName !== undefined}
					aria-describedby="firstName-error"
					{...register("firstName")}
				/>
				<FieldError
					id="firstName-error"
					show={errors.firstName !== undefined}
				/>
			</div>
			<div className="grid gap-1.5">
				<Label htmlFor="lastName">Last name</Label>
				<Input
					id="lastName"
					autoComplete="family-name"
					aria-invalid={errors.lastName !== undefined}
					aria-describedby="lastName-error"
					{...register("lastName")}
				/>
				<FieldError id="lastName-error" show={errors.lastName !== undefined} />
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
				<FieldError
					id="nationality-error"
					show={errors.nationality !== undefined}
				/>
			</div>
		</div>
	);
}
