// Playwright global setup: drops and creates the test database `lonio_test`, then runs the init.
// The database server is the `postgres` service of docker-compose.yml (`docker compose up -d`).

import { execFileSync } from "node:child_process";

const DATABASE = "lonio_test";

/** Same server and credentials as `.env.example`, other database name. */
export const TEST_DATABASE_URL = `postgresql://lonio:lonio@localhost:54329/${DATABASE}`;

function psql(statement: string): void {
	execFileSync(
		"docker",
		[
			"compose",
			"exec",
			"-T",
			"postgres",
			"psql",
			"-U",
			"lonio",
			"-d",
			"postgres",
			"-v",
			"ON_ERROR_STOP=1",
			"-c",
			statement,
		],
		{ stdio: "inherit" },
	);
}

export default function globalSetup(): void {
	psql(`DROP DATABASE IF EXISTS ${DATABASE} WITH (FORCE)`);
	psql(`CREATE DATABASE ${DATABASE}`);
	execFileSync("bun", ["run", "db:init"], {
		stdio: "inherit",
		env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
	});
}
