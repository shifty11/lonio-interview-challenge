// Starts PostgreSQL and the Next.js dev server. Stops PostgreSQL when the dev server exits.
// Ctrl+C goes to the whole process group: the dev server stops by itself, and this script
// catches the signal, so it can stop the database after the dev server.

import { spawn } from "bun";

async function run(cmd: string[]): Promise<number> {
	return spawn(cmd, { stdio: ["inherit", "inherit", "inherit"] }).exited;
}

const up = await run(["docker", "compose", "up", "-d", "--wait"]);
if (up !== 0) {
	process.exit(up);
}

const dev = spawn(["bun", "run", "dev:next"], {
	stdio: ["inherit", "inherit", "inherit"],
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, () => {
		dev.kill(signal);
	});
}

const code = await dev.exited;
await run(["docker", "compose", "stop"]);
process.exit(code);
