// Integer money and exact ratios (spec.md § 4).

declare const rappenBrand: unique symbol;

/** An integer number of Rappen (CHF 0.01). */
export type Rappen = number & { readonly [rappenBrand]: true };

/** An exact fraction in Rappen. `den > 0`. It is never rounded (Swissdec § 10.6.1). */
export type Ratio = { readonly num: bigint; readonly den: bigint };

export function rappen(value: number): Rappen {
	if (!Number.isSafeInteger(value)) {
		throw new Error(`Rappen must be a safe integer, got ${value}`);
	}
	return value as Rappen;
}

/** Parses a CHF amount with at most two decimals, for example `"850.40"`. */
export function chf(text: string): Rappen {
	const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);
	if (match === null) {
		throw new Error(`Invalid CHF amount: ${text}`);
	}
	const [, sign, whole, cents = ""] = match;
	const value = Number(`${whole}${cents.padEnd(2, "0")}`);
	return rappen(sign === "-" ? -value : value);
}

export function ratio(num: bigint, den: bigint): Ratio {
	if (den <= 0n) {
		throw new Error(`Ratio denominator must be positive, got ${den}`);
	}
	return { num, den };
}

export function ratioOf(value: Rappen): Ratio {
	return { num: BigInt(value), den: 1n };
}

export function ratioCompare(a: Ratio, b: Ratio): -1 | 0 | 1 {
	const left = a.num * b.den;
	const right = b.num * a.den;
	return left < right ? -1 : left > right ? 1 : 0;
}

export function ratioEquals(a: Ratio, b: Ratio): boolean {
	return ratioCompare(a, b) === 0;
}

export function ratioAdd(a: Ratio, b: Ratio): Ratio {
	return { num: a.num * b.den + b.num * a.den, den: a.den * b.den };
}

export function ratioMul(a: Ratio, b: Ratio): Ratio {
	return { num: a.num * b.num, den: a.den * b.den };
}

export function ratioDiv(a: Ratio, b: Ratio): Ratio {
	if (b.num === 0n) {
		throw new Error("Division by zero");
	}
	return b.num > 0n
		? { num: a.num * b.den, den: a.den * b.num }
		: { num: -a.num * b.den, den: a.den * -b.num };
}

/** Floor division for `bigint` with a positive divisor. */
function floorDiv(num: bigint, den: bigint): bigint {
	const quotient = num / den;
	return num % den !== 0n && num < 0n !== den < 0n ? quotient - 1n : quotient;
}

/** Rounds `value` to a multiple of `step`, halves up (Swissdec § 5.1.1). */
export function roundHalfUp(value: Ratio, step: bigint): bigint {
	// value / step, rounded half up: floor(value / step + 1/2)
	const scaled = floorDiv(
		2n * value.num + value.den * step,
		2n * value.den * step,
	);
	return scaled * step;
}

/** A ratio as a decimal string with two decimals, rounded half up. For display only. */
export function formatRatioChf(value: Ratio): string {
	const cents = roundHalfUp(value, 1n);
	const sign = cents < 0n ? "-" : "";
	const abs = cents < 0n ? -cents : cents;
	const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	return `${sign}${whole}.${(abs % 100n).toString().padStart(2, "0")}`;
}

export function formatChf(value: Rappen): string {
	return formatRatioChf(ratioOf(value));
}

export function assertNever(value: never): never {
	throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
