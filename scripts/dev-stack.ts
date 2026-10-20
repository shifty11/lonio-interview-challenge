// Starts PostgreSQL, prepares the database and starts the Next.js dev server. Stops PostgreSQL
// when the dev server exits.
// `db:init` does nothing when the database matches the contract. `db:seed` does nothing when
// the table has rows. So a second run changes nothing.
// Ctrl+C goes to the whole process group: the dev server stops by itself, and this script
// catches the signal, so it can stop the database after the dev server.

import { spawn } from "bun";

async function run(cmd: string[]): Promise<number> {
	return spawn(cmd, { stdio: ["inherit", "inherit", "inherit"] }).exited;
}

async function stopAndExit(code: number): Promise<never> {
	await run(["docker", "compose", "stop"]);
	process.exit(code);
}

const up = await run(["docker", "compose", "up", "-d", "--wait"]);
if (up !== 0) {
	process.exit(up);
}

const init = await run(["bun", "run", "db:init"]);
if (init !== 0) {
	console.error(
		"db:init failed. If the database does not match the contract, run `bun run db:migrate`.",
	);
	await stopAndExit(init);
}

const seed = await run(["bun", "run", "db:seed"]);
if (seed !== 0) {
	await stopAndExit(seed);
}

const dev = spawn(["bun", "run", "dev:next"], {
	stdio: ["inherit", "inherit", "inherit"],
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, () => {
		dev.kill(signal);
	});
}

await stopAndExit(await dev.exited);
