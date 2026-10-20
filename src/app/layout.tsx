import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Geist } from "next/font/google";
import { SiteNav } from "@/components/site-nav";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
	title: "Employee onboarding",
	description:
		"Onboarding form and HR dashboard with the Zurich source tax tariff code.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" className={cn("font-sans", geist.variable)}>
			<body>
				<header className="sticky top-0 z-5 border-b bg-card">
					<div className="mx-auto flex max-w-5xl flex-wrap items-center gap-5 px-4 py-2.5">
						<div className="flex items-center gap-2.5 font-semibold tracking-tight">
							<span
								aria-hidden="true"
								className="size-[22px] rounded-[5px] bg-primary"
							/>
							Onboarding
						</div>
						<SiteNav />
					</div>
				</header>
				{children}
			</body>
		</html>
	);
}
