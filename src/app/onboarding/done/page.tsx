import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Onboarding complete" };

export default function OnboardingDonePage() {
	return (
		<main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
			<h1 className="text-3xl font-semibold">Thank you</h1>
			<p className="text-muted-foreground">
				Your data is saved. HR can now see it on the dashboard.
			</p>
			<div className="flex gap-3">
				<Link href="/onboarding" className={buttonVariants()}>
					Add another employee
				</Link>
				<Link href="/hr" className={buttonVariants({ variant: "outline" })}>
					HR dashboard
				</Link>
			</div>
		</main>
	);
}
