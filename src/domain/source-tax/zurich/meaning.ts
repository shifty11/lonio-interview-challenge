// The plain-English meaning of a Zurich tariff code (letter + digit + Y/N).
// Source: calc-spec § 6.1 (letter, digit, church flag) and § 6.2 (G, Q).

import type { TariffCode } from "./codes.ts";

const LETTERS: Readonly<Record<string, string>> = {
	A: "single, no child with the H tariff",
	B: "married, partner not employed",
	C: "married, partner employed",
	H: "single with a child in the household",
	L: "border crosser, single (A)",
	M: "border crosser, married, partner not employed (B)",
	N: "border crosser, married, partner employed (C)",
	P: "border crosser, single with a child (H)",
	G: "replacement income",
	Q: "replacement income, border crosser",
};

const CODE_PATTERN = /^([A-Z])(\d)([YN])$/;

export function describeTariffCode(code: TariffCode): string {
	const match = CODE_PATTERN.exec(code);
	const letter = match?.[1];
	const digit = match?.[2];
	const church = match?.[3];
	if (letter === undefined || digit === undefined || church === undefined) {
		return code;
	}
	const base = LETTERS[letter] ?? letter;
	const isReplacement = letter === "G" || letter === "Q";
	const children = isReplacement
		? ""
		: `, ${digit} ${digit === "1" ? "child" : "children"}`;
	const tax = church === "Y" ? "church tax" : "no church tax";
	return `${base}${children}, ${tax}`;
}
