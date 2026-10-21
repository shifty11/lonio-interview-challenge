// The form state of the onboarding page: default values, the resolver and the field path guard.
// The resolver calls `prepareOnboarding`, the same function as the server.

import { mapToHookFormErrors } from "@next-safe-action/adapter-react-hook-form";
import type { DefaultValues, FieldPath, Resolver } from "react-hook-form";
import { prune } from "@/domain/flow/engine";
import { prepareOnboarding } from "@/domain/onboarding/prepare";
import type {
	OnboardingDraft,
	OnboardingDraftSchema,
} from "@/domain/onboarding/schema";
import { zhFlow } from "@/domain/source-tax/zurich/questions";
import { prepareErrors } from "@/lib/validation-errors";

export type DraftPath = FieldPath<OnboardingDraft>;

export const ANSWERS_PREFIX = "sourceTax.answers";

const ANSWER_PATH = /^sourceTax\.answers\.[A-Za-z]+(\.[A-Za-z0-9]+)*$/;

/**
 * True for the path of a Zurich answer. The ids of the flow are paths of `ZhDraftSchema`
 * (`schema-paths.test.ts` proves it), so this check is enough for the form.
 */
export function isAnswerPath(path: string): path is DraftPath {
	return ANSWER_PATH.test(path);
}

/** The form path of a flow path, for example `children.list.0.group`. */
export function answerPath(path: string): DraftPath {
	const full = `${ANSWERS_PREFIX}.${path}`;
	if (!isAnswerPath(full)) {
		throw new Error(`The flow path is not a form path: ${path}`);
	}
	return full;
}

export const defaultValues: DefaultValues<OnboardingDraft> = {
	firstName: "",
	lastName: "",
	sourceTax: { canton: "ZH", answers: {} },
};

/**
 * The draft that goes to the resolver and to the server. A Swiss employee has no `sourceTax`.
 * The answers are pruned, so an answer of a hidden question does not go to the server.
 */
export function toDraft(values: OnboardingDraft): OnboardingDraft {
	const { firstName, lastName, nationality } = values;
	if (nationality === undefined) {
		return { firstName, lastName };
	}
	if (nationality === "CH") {
		return { firstName, lastName, nationality };
	}
	return {
		firstName,
		lastName,
		nationality,
		sourceTax: {
			canton: "ZH",
			answers: prune(zhFlow, values.sourceTax?.answers ?? {}),
		},
	};
}

export const onboardingResolver: Resolver<OnboardingDraft> = (values) => {
	const draft = toDraft(values);
	const result = prepareOnboarding(draft);
	if (result.kind === "ok") {
		return { values: draft, errors: {} };
	}
	const errors = mapToHookFormErrors<typeof OnboardingDraftSchema>(
		prepareErrors(result),
	);
	return { values: {}, errors: errors ?? {} };
};

/** The number of open answers, or 0 when the draft is complete. */
export function openAnswerCount(values: OnboardingDraft): number {
	const result = prepareOnboarding(toDraft(values));
	switch (result.kind) {
		case "ok":
			return 0;
		case "missing":
			return result.paths.length;
		case "invalid":
			return result.issues.length;
		default: {
			const unreachable: never = result;
			return unreachable;
		}
	}
}
