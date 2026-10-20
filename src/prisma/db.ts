// The Prisma 8 client. Server only. Bun and Next.js load `.env` themselves.

import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "./contract.d";
import contractJson from "./contract.json" with { type: "json" };

const url = process.env.DATABASE_URL;
if (url === undefined) {
	throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
}

export const db = postgres<Contract>({ contractJson, url });
export type Db = typeof db;
