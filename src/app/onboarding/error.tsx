"use client";

// The error boundary of /onboarding. A bug in the flow data or in the preview shows this page
// and not a blank screen.

import { Button } from "@/components/ui/button";

export default function OnboardingError({
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<main className="mx-auto max-w-5xl px-4 py-6">
			<div role="alert" className="grid justify-items-start gap-3">
				<h1 className="text-2xl font-semibold tracking-tight">
					This page cannot load.
				</h1>
				<p className="text-sm text-muted-foreground">
					An error stopped the page. The form does not save your answers. Try
					again.
				</p>
				<Button type="button" onClick={reset}>
					Try again
				</Button>
			</div>
		</main>
	);
}
