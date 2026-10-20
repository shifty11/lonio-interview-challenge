// The plain-English meaning of a Zurich tariff code (letter + digit + Y/N).
// Source: calc-spec § 6.1 (letter, digit, church flag), § 6.2 (G, Q) and § 7.4 (G and Q have
// no church-tax part).

import type { TariffCode } from "./codes.ts";

/** The first letters of the codes in the tariff file. */
type Letter = TariffCode extends infer Code
	? Code extends `${infer First}${string}`
		? First
		: never
	: never;

// Every letter of the file has a text. A letter that is not in the map is a compile error.
// `E` is in the file, and the app never computes it.
const LETTERS: Readonly<Record<Letter, string>> = {
	E: "tariff E (the app does not compute it)",
	A: "single",
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

export type TariffPart = {
	name: "letter" | "digit" | "church";
	char: string;
	text: string;
};

function isLetter(value: string | undefined): value is Letter {
	return value !== undefined && Object.hasOwn(LETTERS, value);
}

/**
 * The three parts of a code with their meaning. The digit and the church flag of `G` and `Q`
 * carry no meaning (calc-spec § 7.4): their text is "not used".
 */
export function describeTariffParts(code: TariffCode): TariffPart[] {
	const match = CODE_PATTERN.exec(code);
	const letter = match?.[1];
	const digit = match?.[2];
	const church = match?.[3];
	if (!isLetter(letter) || digit === undefined || church === undefined) {
		throw new Error(`Not a Zurich tariff code: ${code}`);
	}
	const unused = letter === "G" || letter === "Q";
	return [
		{ name: "letter", char: letter, text: LETTERS[letter] },
		{
			name: "digit",
			char: digit,
			text: unused
				? "not used"
				: `${digit} ${digit === "1" ? "child" : "children"}`,
		},
		{
			name: "church",
			char: church,
			text: unused
				? "not used"
				: church === "Y"
					? "church tax"
					: "no church tax",
		},
	];
}

export function describeTariffCode(code: TariffCode): string {
	const [letter, digit, church] = describeTariffParts(code);
	if (letter === undefined || digit === undefined || church === undefined) {
		throw new Error(`Not a Zurich tariff code: ${code}`);
	}
	if (letter.char === "G" || letter.char === "Q") {
		return letter.text;
	}
	return `${letter.text}, ${digit.text}, ${church.text}`;
}
