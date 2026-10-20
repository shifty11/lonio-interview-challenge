"use client";

// Renders the visible questions of the Zurich flow. The renderer holds no rule about which
// question shows: `visibleQuestions` decides. The only answer with a side effect is
// `children.hasChildren`, which sets the list of children (UI help; `prune` is the correctness
// mechanism).

import { useFormContext, useWatch } from "react-hook-form";
import { visibleQuestions } from "@/domain/flow/engine";
import type { OnboardingDraft } from "@/domain/onboarding/schema";
import { zhFlow } from "@/domain/source-tax/zurich/questions";
import { ChildrenGroup } from "./children-group";
import { ANSWERS_PREFIX, answerPath } from "./draft";
import { QuestionField } from "./question-field";

export function FlowRenderer() {
	const { control, setValue } = useFormContext<OnboardingDraft>();
	const answers = useWatch({ control, name: ANSWERS_PREFIX });
	const nodes = visibleQuestions(zhFlow, answers ?? {});

	return (
		<div>
			{nodes.map((node) => {
				switch (node.kind) {
					case "question":
						return (
							<QuestionField
								key={node.path}
								name={answerPath(node.path)}
								label={node.label}
								options={node.options}
								onAnswer={(value) => {
									if (node.path === "children.hasChildren") {
										setValue(
											answerPath("children.list"),
											value === true ? [{}] : [],
										);
									}
								}}
							/>
						);
					case "group":
						return <ChildrenGroup key={node.path} group={node} />;
					default: {
						const unreachable: never = node;
						return unreachable;
					}
				}
			})}
		</div>
	);
}
