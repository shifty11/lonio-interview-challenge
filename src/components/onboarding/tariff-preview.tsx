"use client";

// The tariff preview. It calls `previewTariff` on the watched draft, as the server does.

import { useFormContext, useWatch } from "react-hook-form";
import { Card } from "@/components/ui/card";
import type { OnboardingDraft } from "@/domain/onboarding/schema";
import { describeTariffCode } from "@/domain/source-tax/zurich/meaning";
import { previewTariff } from "@/domain/source-tax/zurich/preview";
import { ANSWERS_PREFIX } from "./draft";

function State({
	tone,
	children,
}: {
	tone: "warn" | "ok";
	children: React.ReactNode;
}) {
	return (
		<div
			className={
				tone === "warn"
					? "rounded-lg bg-warn-soft px-3 py-2.5 text-sm text-warn"
					: "rounded-lg bg-ok-soft px-3 py-2.5 text-sm text-ok"
			}
		>
			{children}
		</div>
	);
}

/** The three characters of a code: letter, digit and church flag. */
function codeParts(code: string) {
	const [letter = "", digit = "", church = ""] = code;
	return [
		{ name: "letter", char: letter },
		{ name: "digit", char: digit },
		{ name: "church", char: church },
	];
}

function Remark({ text }: { text: string | null }) {
	return text === null ? null : (
		<p className="border-l-2 border-warn pl-2.5 text-sm text-warn">{text}</p>
	);
}

function Body() {
	const { control } = useFormContext<OnboardingDraft>();
	const nationality = useWatch({ control, name: "nationality" });
	const answers = useWatch({ control, name: ANSWERS_PREFIX });

	if (nationality === undefined) {
		return <State tone="warn">Nationality is missing</State>;
	}
	if (nationality === "CH") {
		return <State tone="ok">No source tax</State>;
	}
	const preview = previewTariff(answers ?? {});
	switch (preview.kind) {
		case "incomplete": {
			const n = preview.missing.length;
			return (
				<State tone="warn">
					Not complete · {n} open {n === 1 ? "question" : "questions"}
				</State>
			);
		}
		case "noSourceTax":
			return (
				<>
					<State tone="ok">{preview.text}</State>
					<Remark text={preview.remark} />
				</>
			);
		case "code":
			return (
				<>
					<div
						role="img"
						aria-label={`Tariff ${preview.code}`}
						data-testid="tariff-code"
						className="flex gap-1.5"
					>
						{codeParts(preview.code).map((part) => (
							<span
								key={part.name}
								className="min-w-13 rounded-lg bg-accent px-3 pt-2.5 pb-2 text-center font-mono text-3xl leading-none font-semibold text-accent-foreground"
							>
								{part.char}
							</span>
						))}
					</div>
					<p className="text-sm text-muted-foreground">
						{describeTariffCode(preview.code)}
					</p>
					<Remark text={preview.remark} />
				</>
			);
		default: {
			const unreachable: never = preview;
			return unreachable;
		}
	}
}

export function TariffPreview() {
	return (
		<Card
			aria-live="polite"
			aria-label="Tariff preview"
			className="sticky top-4 grid gap-3.5 p-5"
		>
			<span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
				Tariff preview
			</span>
			<Body />
		</Card>
	);
}
