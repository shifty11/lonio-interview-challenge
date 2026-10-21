"use client";

// Renders the visible questions of the Zurich flow. The renderer holds no rule about which
// question shows: `visibleQuestions` decides. The only answer with a side effect is
// `children.hasChildren`, which sets the list of children (UI help; `prune` is the correctness
// mechanism).

import { useEffect, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { type VisibleNode, visibleQuestions } from "@/domain/flow/engine";
import type { OnboardingDraft } from "@/domain/onboarding/schema";
import { zhFlow } from "@/domain/source-tax/zurich/questions";
import { ChildrenGroup } from "./children-group";
import { ANSWERS_PREFIX, answerPath } from "./draft";
import { QuestionField } from "./question-field";

/** The key of each visible question, by path. */
function keysByPath(nodes: readonly VisibleNode[]): Map<string, string> {
	const keys = new Map<string, string>();
	for (const node of nodes) {
		switch (node.kind) {
			case "question":
				keys.set(node.path, node.key);
				break;
			case "group":
				for (const item of node.items) {
					for (const question of item.questions) {
						keys.set(question.path, question.key);
					}
				}
				break;
			default: {
				const unreachable: never = node;
				return unreachable;
			}
		}
	}
	return keys;
}

/**
 * Clears the value of a question that the flow hides, so a question that shows again is empty.
 * Also clears the value of a question when another label variant of the same path takes its
 * place. The new variant mounts as a new field (its key differs). React Hook Form gives a new
 * field the value that it holds for the path at render time, and a later `setValue(path,
 * undefined)` does not reach the field, because the field falls back to that first value. So the
 * clear happens in the `subscribe` callback, which runs in the change event, before React renders
 * the new field. A path that keeps its key (for example after "Remove" shifts the children) keeps
 * its value. A hidden path with no value stays as it is: after "Remove", the path of the last
 * child has no value, and a `setValue` on it would add an item to the list.
 *
 * The form does not use the React Hook Form option `shouldUnregister` for this. With that option,
 * a field deletes its value when it unmounts, and React Strict Mode unmounts each new field one
 * time. So a field that mounts with a value (a child after "Add" or "Remove") loses the value.
 */
function useClearHiddenAnswers(initial: readonly VisibleNode[]) {
	const { subscribe, getValues, setValue } = useFormContext<OnboardingDraft>();
	const previous = useRef<Map<string, string>>(keysByPath(initial));

	useEffect(() => {
		return subscribe({
			formState: { values: true },
			callback: () => {
				const next = keysByPath(
					visibleQuestions(zhFlow, getValues(ANSWERS_PREFIX) ?? {}),
				);
				const before = previous.current;
				previous.current = next;
				for (const [path, key] of next) {
					const old = before.get(path);
					if (old !== undefined && old !== key) {
						setValue(answerPath(path), undefined);
					}
				}
				for (const path of before.keys()) {
					const name = answerPath(path);
					if (!next.has(path) && getValues(name) !== undefined) {
						setValue(name, undefined);
					}
				}
			},
		});
	}, [subscribe, getValues, setValue]);
}

export function FlowRenderer() {
	const { control, setValue } = useFormContext<OnboardingDraft>();
	const answers = useWatch({ control, name: ANSWERS_PREFIX });
	const nodes = visibleQuestions(zhFlow, answers ?? {});
	useClearHiddenAnswers(nodes);

	return (
		<div>
			{nodes.map((node) => {
				switch (node.kind) {
					case "question":
						return (
							<QuestionField
								key={node.key}
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
