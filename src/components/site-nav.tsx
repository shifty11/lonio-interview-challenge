"use client";

// The links of the top bar. The link of the current route has the accent style.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
	{ href: "/onboarding", label: "Employee" },
	{ href: "/hr", label: "HR" },
] as const;

export function SiteNav() {
	const pathname = usePathname();
	return (
		<nav aria-label="Main" className="ml-auto flex gap-1">
			{LINKS.map((link) => {
				const active =
					pathname === link.href || pathname.startsWith(`${link.href}/`);
				return (
					<Link
						key={link.href}
						href={link.href}
						aria-current={active ? "page" : undefined}
						className={cn(
							"flex items-baseline gap-2 rounded-lg px-3 py-1.5 text-muted-foreground",
							active && "bg-accent font-medium text-accent-foreground",
						)}
					>
						{link.label}
						<span className="font-mono text-[11px] opacity-70">
							{link.href}
						</span>
					</Link>
				);
			})}
		</nav>
	);
}
