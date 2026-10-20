// Writes the Prisma `native_enum` blocks from the domain `z.enum` lists.
// The blocks sit between marker comments in src/prisma/contract.prisma.
// A second run gives no diff.

import { COUNTRY_CODES } from "../src/domain/onboarding/countries.ts";
import { Canton } from "../src/domain/source-tax/types.ts";

const CONTRACT_PATH = new URL("../src/prisma/contract.prisma", import.meta.url);
const BEGIN = "// BEGIN GENERATED ENUMS";
const END = "// END GENERATED ENUMS";

function enumBlock(
	name: string,
	pgName: string,
	members: readonly string[],
): string {
	const lines = members.map((member) => `  ${member} = "${member}"`);
	return [`native_enum ${name} {`, ...lines, `  @@map("${pgName}")`, "}"].join(
		"\n",
	);
}

export function renderEnums(): string {
	return [
		enumBlock("Nationality", "nationality", COUNTRY_CODES),
		enumBlock("Canton", "canton", Canton.options),
	].join("\n\n");
}

export function replaceBetweenMarkers(source: string, body: string): string {
	const begin = source.indexOf(BEGIN);
	const end = source.indexOf(END);
	if (begin === -1 || end === -1 || end < begin) {
		throw new Error(
			`Markers "${BEGIN}" and "${END}" not found in the contract.`,
		);
	}
	return `${source.slice(0, begin + BEGIN.length)}\n${body}\n${source.slice(end)}`;
}

if (import.meta.main) {
	const file = Bun.file(CONTRACT_PATH);
	const next = replaceBetweenMarkers(await file.text(), renderEnums());
	await Bun.write(CONTRACT_PATH, next);
	console.log("Prisma enums written to src/prisma/contract.prisma");
}
