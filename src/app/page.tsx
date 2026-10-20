import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function HomePage() {
	return (
		<main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
			<h1 className="text-3xl font-semibold">Employee onboarding</h1>
			<p className="text-muted-foreground">
				Enter your personal data in the onboarding form. HR sees every employee
				who completed the form, with the suggested Zurich source tax tariff
				code.
			</p>
			<div className="flex gap-3">
				<Link href="/onboarding" className={buttonVariants()}>
					Start onboarding
				</Link>
				<Link href="/hr" className={buttonVariants({ variant: "outline" })}>
					HR dashboard
				</Link>
			</div>
		</main>
	);
}
