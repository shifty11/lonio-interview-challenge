// Inserts the seven example employees. Run it with `bun run db:seed` on an empty table.

import { prepareOnboarding } from "../domain/onboarding/prepare.ts";
import { employeeRepo } from "../server/repo.ts";
import { seedEmployees } from "./seed-data.ts";

const existing = await employeeRepo.list();
if (existing.length > 0) {
	console.log(
		`The table has ${existing.length} employees. The seed does nothing.`,
	);
	process.exit(0);
}

for (const { source, ...draft } of seedEmployees) {
	const prepared = prepareOnboarding(draft);
	if (prepared.kind === "missing") {
		throw new Error(
			`Seed record "${draft.firstName} ${draft.lastName}" (${source}) is incomplete: ${prepared.paths.join(", ")}`,
		);
	}
	await employeeRepo.create(prepared.value);
}
console.log(`Seeded ${seedEmployees.length} employees.`);
process.exit(0);
