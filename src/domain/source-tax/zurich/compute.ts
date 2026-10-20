// computeTariffCode. Source: calculator-spec.md § 6.1, § 6.2, § 6.3,
// Zurich calculator bundle sources/zh/calculator/main.pretty.js.

import { assertNever } from "../money.ts";
import type { TariffResult } from "../types.ts";
import { childResultMarried, childResultUnmarried } from "./children.ts";
import { TariffCode } from "./codes.ts";
import { residenceResult } from "./residence.ts";
import type { ZhAnswers } from "./schema.ts";

/** German original: "Grundsätzlich keine Quellensteuerpflicht" (calculator-spec.md § 5.1, main.pretty.js:17166). */
export const NO_SOURCE_TAX_TEXT = "No source tax in principle";

/** German original: "Unter Vorbehalt des Doppelbesteuerungsabkommens" (calculator-spec.md § 5.1, main.pretty.js:17168). */
export const DTA_RESERVATION_TEXT = "Subject to the double taxation agreement";

const MAX_CHILD_DIGIT = 9;

type Letter = "A" | "B" | "C" | "H";

/** Border-crosser map (calculator-spec.md § 6.1, main.pretty.js:15820-15823). */
function borderCrosserLetter(letter: Letter): "L" | "M" | "N" | "P" {
	switch (letter) {
		case "A":
			return "L";
		case "B":
			return "M";
		case "C":
			return "N";
		case "H":
			return "P";
		default:
			return assertNever(letter);
	}
}

function letterAndDigit(
	answers: Extract<ZhAnswers, { incomeType: "earned" }>,
): {
	letter: Letter;
	digit: number;
} {
	switch (answers.civilStatus) {
		case "married": {
			// calculator-spec.md § 6.1, main.pretty.js:15877-15889
			const letter = answers.spouseEmployed ? "C" : "B";
			if (!answers.children.hasChildren) {
				return { letter, digit: 0 };
			}
			const counting = answers.children.list.filter(
				(child) => childResultMarried(child).counts,
			);
			return { letter, digit: counting.length };
		}
		case "single": {
			// calculator-spec.md § 6.1, main.pretty.js:15891-15917
			if (!answers.children.hasChildren) {
				return { letter: "A", digit: 0 };
			}
			const results = answers.children.list.map(childResultUnmarried);
			const letter = results.some((result) => result.justifiesH) ? "H" : "A";
			return {
				letter,
				digit: results.filter((result) => result.counts).length,
			};
		}
		default:
			return assertNever(answers);
	}
}

export function computeTariffCode(
	answers: ZhAnswers,
): TariffResult<TariffCode> {
	const residence = residenceResult(answers.residence);
	const remark = residence.remark === null ? null : DTA_RESERVATION_TEXT;

	// calculator-spec.md § 6.3, main.pretty.js:15829-15853: the override replaces the code.
	if (residence.override !== null) {
		return { kind: "noSourceTax", text: NO_SOURCE_TAX_TEXT, remark };
	}

	switch (answers.incomeType) {
		case "replacement": {
			// calculator-spec.md § 6.2, main.pretty.js:15920-15942. The file tables are G9N and Q9N.
			const letter = residence.borderCrosser ? "Q" : "G";
			return { kind: "code", code: TariffCode.parse(`${letter}9N`), remark };
		}
		case "earned": {
			const { letter, digit } = letterAndDigit(answers);
			const group = residence.borderCrosser
				? borderCrosserLetter(letter)
				: letter;
			const church = answers.churchMember ? "Y" : "N";
			const code = `${group}${Math.min(digit, MAX_CHILD_DIGIT)}${church}`;
			return { kind: "code", code: TariffCode.parse(code), remark };
		}
		default:
			return assertNever(answers);
	}
}
