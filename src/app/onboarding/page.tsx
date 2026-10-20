import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export const metadata = { title: "Onboarding" };

export default function OnboardingPage() {
	return (
		<main className="mx-auto max-w-5xl px-4 py-6">
			<h1 className="text-2xl font-semibold tracking-tight">
				Your personal details
			</h1>
			<p className="mt-1 text-muted-foreground">
				The questions change with your answers. Swiss citizens answer no
				source-tax questions.
			</p>
			<OnboardingForm />
		</main>
	);
}
