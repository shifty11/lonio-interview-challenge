// Dot paths. A numeric segment indexes an array.

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

const INDEX = /^\d+$/;

export function getPath(obj: unknown, path: string): unknown {
	let current: unknown = obj;
	for (const segment of path.split(".")) {
		if (typeof current !== "object" || current === null) {
			return undefined;
		}
		current = Reflect.get(current, segment);
	}
	return current;
}

function setIn(
	node: unknown,
	segments: readonly string[],
	value: unknown,
): unknown {
	const [head, ...rest] = segments;
	if (head === undefined) {
		return value;
	}
	if (INDEX.test(head)) {
		const copy = Array.isArray(node) ? [...node] : [];
		const index = Number(head);
		copy[index] = setIn(copy[index], rest, value);
		return copy;
	}
	const base = isRecord(node) ? node : {};
	return { ...base, [head]: setIn(base[head], rest, value) };
}

/**
 * Returns a copy of `obj` with `value` at `path`. It does not mutate `obj`.
 * The caller passes a draft: every key of a draft is optional, so the copy keeps the type of `obj`.
 */
export function setPath<T extends object>(
	obj: T,
	path: string,
	value: unknown,
): T {
	return setIn(obj, path.split("."), value) as T;
}
