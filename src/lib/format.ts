// Formats the `createdAt` text of PostgreSQL, for example "2026-10-20 13:24:47.123456+00".

export function formatAdded(createdAt: string): string {
	const iso = createdAt.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return createdAt;
	}
	return new Intl.DateTimeFormat("en-GB", {
		dateStyle: "medium",
		timeStyle: "short",
		timeZone: "Europe/Zurich",
	}).format(date);
}
