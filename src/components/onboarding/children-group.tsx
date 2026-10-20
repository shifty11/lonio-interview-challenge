"use client";

// The repeating group of children. `useFieldArray` owns the list. The questions of each child
// come from the visible group node.

import { useFieldArray, useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import type { VisibleGroup } from "@/domain/flow/engine";
import type { OnboardingDraft } from "@/domain/onboarding/schema";
import { MAX_CHILDREN } from "@/domain/source-tax/zurich/schema";
import { answerPath } from "./draft";
import { QuestionField } from "./question-field";

export function ChildrenGroup({ group }: { group: VisibleGroup }) {
	const { control } = useFormContext<OnboardingDraft>();
	const { fields, append, remove } = useFieldArray({
		control,
		name: "sourceTax.answers.children.list",
	});

	return (
		<div className="mt-3 grid gap-3">
			{fields.map((field, index) => (
				<fieldset key={field.id} className="rounded-lg border p-3.5">
					<legend className="px-1 text-sm font-semibold">
						{group.itemLabel} {index + 1}
					</legend>
					{group.items[index]?.questions.map((question) => (
						<QuestionField
							key={question.key}
							name={answerPath(question.path)}
							label={question.label}
							options={question.options}
						/>
					))}
					{fields.length > 1 ? (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => remove(index)}
						>
							Remove
						</Button>
					) : null}
				</fieldset>
			))}
			{fields.length < MAX_CHILDREN ? (
				<div>
					<Button type="button" variant="outline" onClick={() => append({})}>
						{group.addLabel}
					</Button>
				</div>
			) : null}
		</div>
	);
}
