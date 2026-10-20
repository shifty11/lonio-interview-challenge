// Parser for the ESTV source-tax tariff file (record format: plan.md § 4.1,
// `sources/estv/qst-tarife-recordformate-loehne-2025-de.pdf` sections 3.3, 4.2-4.4).
// The module is national. It holds no canton logic.

import { type Rappen, rappen } from "../money.ts";

export type Band = {
	readonly from: Rappen;
	readonly width: Rappen;
	readonly minTax: Rappen;
	/** Hundredths of a percent, as the file stores it (`679` = 6.79%). */
	readonly rate: number;
};

export type TariffFile = {
	readonly canton: string;
	/** `YYYYMMDD` */
	readonly validFrom: string;
	/** Records 06 and 11, sorted by `from`. */
	readonly tables: Readonly<Record<string, readonly Band[]>>;
	/** Record 13, for example `MED`. */
	readonly medians: Readonly<Record<string, Rappen>>;
	/** Record 12. The rate is in hundredths of a percent. */
	readonly fees: Readonly<Record<string, number>>;
};

/** One band as plain numbers: `[from, width, minTax, rate]`. The generator writes this form. */
export type BandRow = readonly [
	from: number,
	width: number,
	minTax: number,
	rate: number,
];

/** A `TariffFile` as plain numbers. The generator writes this form. */
export type TariffFileData = {
	readonly canton: string;
	readonly validFrom: string;
	readonly tables: Readonly<Record<string, readonly BandRow[]>>;
	readonly medians: Readonly<Record<string, number>>;
	readonly fees: Readonly<Record<string, number>>;
};

export function tariffFileFromData(data: TariffFileData): TariffFile {
	const tables: Record<string, readonly Band[]> = {};
	for (const [code, rows] of Object.entries(data.tables)) {
		tables[code] = rows.map(([from, width, minTax, rate]) => ({
			from: rappen(from),
			width: rappen(width),
			minTax: rappen(minTax),
			rate,
		}));
	}
	const medians: Record<string, Rappen> = {};
	for (const [key, value] of Object.entries(data.medians)) {
		medians[key] = rappen(value);
	}
	return {
		canton: data.canton,
		validFrom: data.validFrom,
		tables,
		medians,
		fees: { ...data.fees },
	};
}

export function tariffFileToData(file: TariffFile): TariffFileData {
	const tables: Record<string, readonly BandRow[]> = {};
	for (const [code, bands] of Object.entries(file.tables)) {
		tables[code] = bands.map(
			(b) => [b.from, b.width, b.minTax, b.rate] as const,
		);
	}
	return {
		canton: file.canton,
		validFrom: file.validFrom,
		tables,
		medians: { ...file.medians },
		fees: { ...file.fees },
	};
}

export type ParsedTariffFile = {
	readonly file: TariffFile;
	/** A rate goes down while the income goes up. Not an error. */
	readonly warnings: readonly string[];
};

// Field positions, 1-based, as in plan.md § 4.1.
const field = (line: string, from: number, to: number): string =>
	line.slice(from - 1, to);

class LineError extends Error {
	constructor(line: number, message: string) {
		super(`line ${line}: ${message}`);
	}
}

function digits(
	line: string,
	lineNo: number,
	from: number,
	to: number,
	name: string,
): number {
	const text = field(line, from, to);
	if (!/^\d+$/.test(text)) {
		throw new LineError(
			lineNo,
			`field ${name} (pos ${from}-${to}) is not numeric: "${text}"`,
		);
	}
	return Number(text);
}

export function parseTariffFileWithWarnings(text: string): ParsedTariffFile {
	const lines = text.split(/\r?\n/);
	while (lines.length > 0 && lines[lines.length - 1] === "") {
		lines.pop();
	}

	const first = lines[0];
	if (first === undefined || !first.startsWith("00")) {
		throw new LineError(1, "the header record 00 is missing");
	}
	const canton = field(first, 3, 4);
	const last = lines[lines.length - 1];
	const trailer =
		last === undefined ? null : /^99\s+([A-Z]{2})(\d{8})\s*$/.exec(last);
	if (trailer === null) {
		throw new LineError(lines.length, "the trailer record 99 is missing");
	}
	// The trailer counts every line, the header and the trailer included.
	const declared = Number(trailer[2]);
	if (declared !== lines.length) {
		throw new LineError(
			lines.length,
			`the trailer counts ${declared} records, the file has ${lines.length}`,
		);
	}

	let validFrom: string | null = null;
	const tables: Record<string, Band[]> = {};
	const lineOfBand = new Map<Band, number>();
	const medians: Record<string, Rappen> = {};
	const fees: Record<string, number> = {};

	for (let index = 1; index < lines.length - 1; index++) {
		const line = lines[index] ?? "";
		const lineNo = index + 1;
		const type = field(line, 1, 2);
		if (type !== "06" && type !== "11" && type !== "12" && type !== "13") {
			throw new LineError(lineNo, `unknown record type "${type}"`);
		}
		const transaction = field(line, 3, 4);
		if (transaction !== "01") {
			throw new LineError(lineNo, `transaction "${transaction}" is not 01`);
		}
		if (field(line, 5, 6) !== canton) {
			throw new LineError(
				lineNo,
				`canton "${field(line, 5, 6)}" differs from the header`,
			);
		}
		const code = field(line, 7, 16).trim();
		const lineValidFrom = field(line, 17, 24);
		if (validFrom === null) {
			validFrom = lineValidFrom;
		} else if (lineValidFrom !== validFrom) {
			throw new LineError(
				lineNo,
				`valid-from ${lineValidFrom} differs from ${validFrom}`,
			);
		}
		const minTaxOrMedian = rappen(digits(line, lineNo, 46, 54, "minimum tax"));
		const rate = digits(line, lineNo, 55, 59, "rate");

		if (type === "13") {
			medians[code] = minTaxOrMedian;
			continue;
		}
		if (type === "12") {
			fees[code] = rate;
			continue;
		}

		const children = digits(line, lineNo, 44, 45, "children");
		// The children field matches the code digit. G9N and Q9N have 00.
		// A code without a digit (HEN, MEN, NON) has 00.
		const digit = code.charAt(1);
		const expected =
			code === "G9N" || code === "Q9N"
				? 0
				: /^\d$/.test(digit)
					? Number(digit)
					: 0;
		if (children !== expected) {
			throw new LineError(
				lineNo,
				`children field ${children} does not match code ${code} (expected ${expected})`,
			);
		}
		const band: Band = {
			from: rappen(digits(line, lineNo, 25, 33, "income from")),
			width: rappen(digits(line, lineNo, 34, 42, "band width")),
			minTax: minTaxOrMedian,
			rate,
		};
		const table = tables[code] ?? [];
		table.push(band);
		tables[code] = table;
		lineOfBand.set(band, lineNo);
	}

	if (validFrom === null) {
		throw new LineError(2, "the file has no data records");
	}

	const warnings: string[] = [];
	for (const [code, bands] of Object.entries(tables)) {
		bands.sort((a, b) => a.from - b.from);
		let expectedFrom = 100; // CHF 1
		let previous: Band | null = null;
		for (const band of bands) {
			const lineNo = lineOfBand.get(band) ?? 0;
			if (band.from !== expectedFrom) {
				const problem =
					band.from < expectedFrom ? "overlaps" : "leaves a gap before";
				throw new LineError(
					lineNo,
					`table ${code}: band from ${band.from} ${problem} ${expectedFrom}`,
				);
			}
			expectedFrom = band.from + band.width;
			if (previous !== null && band.rate < previous.rate) {
				warnings.push(
					`line ${lineNo}: table ${code}: rate goes down from ${previous.rate} to ${band.rate} at ${band.from}`,
				);
			}
			previous = band;
		}
	}

	return { file: { canton, validFrom, tables, medians, fees }, warnings };
}

export function parseTariffFile(text: string): TariffFile {
	return parseTariffFileWithWarnings(text).file;
}
