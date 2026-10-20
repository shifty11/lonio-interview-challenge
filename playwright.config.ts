import { defineConfig, devices } from "@playwright/test";
import { TEST_DATABASE_URL } from "./tests/e2e/global-setup";

const PORT = 3100;

export default defineConfig({
	testDir: "tests/e2e",
	globalSetup: "./tests/e2e/global-setup.ts",
	// The tests share one database, so they run one after the other.
	workers: 1,
	fullyParallel: false,
	reporter: [["list"]],
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: "retain-on-failure",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: {
		command: `bun run build && bun run start --port ${PORT}`,
		url: `http://localhost:${PORT}`,
		reuseExistingServer: false,
		timeout: 300_000,
		env: { DATABASE_URL: TEST_DATABASE_URL },
	},
});
