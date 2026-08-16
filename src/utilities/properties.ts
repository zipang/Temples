/**
 * Split a property path into its keys.
 *
 * Keys are property names or array indexes. Dots and bracket pairs separate
 * the keys, e.g. `"persons[0].address.street"` yields `["persons", "0",
 * "address", "street"]`. Empty segments from repeated separators are dropped.
 *
 * @param path - The path to split, e.g. `"persons[0].address.street"`.
 * @returns The path keys, in order.
 */
export const splitPath = (path: string): string[] => path.split(/[,[\].]+?/).filter(Boolean);

/**
 * Read the value at a property path.
 *
 * The path crosses objects and arrays, e.g. `"persons[0].name"` reads the
 * first element of an array. Falsy values such as `0` and `false` are
 * preserved. A function value is called with its parent object as `this`.
 * When the path stops on `undefined`, `null`, or an empty path, the default
 * value is returned instead. Without a default, `undefined` is returned.
 *
 * @param source - Object or array to read the path from.
 * @param path - Property path, e.g. `"persons[0].name"`.
 * @param defaultValue - Value returned when the path does not resolve.
 * @returns The value at the path, or the default value.
 */
export const getProperty = <T>(source: object, path: string, defaultValue?: T): T | undefined => {
	const steps = splitPath(path);

	let found: unknown = source;
	let parent: object | null = null;

	while (found != null && steps.length > 0) {
		const key = steps.shift() as string;

		parent = found;
		found = (found as Record<string, unknown>)[key];
	}

	if (typeof found === "function") {
		found = (found as (this: object) => unknown).call(parent as object);
	}

	return found === undefined || found === null || found === source ? defaultValue : (found as T);
};

/**
 * Tell whether a property path is present in the source.
 *
 * Unlike `getProperty`, this does not collapse `null` and `undefined` values:
 * a path that resolves to `null` or `undefined` is still present. A path is
 * absent only when an intermediate key is missing. Function values are not
 * evaluated.
 *
 * @param source - Object or array to check the path against.
 * @param path - Property path, e.g. `"persons[0].name"`.
 * @returns True when every key in the path exists on the source.
 */
export const hasProperty = (source: object, path: string): boolean => {
	const steps = splitPath(path);

	if (steps.length === 0) return false;

	let found: unknown = source;

	for (const key of steps) {
		if (found === null || (typeof found !== "object" && typeof found !== "function")) return false;
		if (!Object.hasOwn(found, key)) return false;

		found = (found as Record<string, unknown>)[key];
	}

	return true;
};

/**
 * Tell whether a key is a canonical non-negative integer array index.
 *
 * Only digits form an index: `"0"` and `"10"` qualify, while `"01"`, `"-1"`,
 * `"1abc"`, and `"0x10"` do not. This replaces a `parseInt` heuristic that
 * misclassified keys such as `"1st"` as array indexes.
 *
 * @param key - The candidate key.
 * @returns True when the key is a canonical array index.
 */
const isArrayIndex = (key: string): boolean => /^(0|[1-9][0-9]*)$/.test(key);

/**
 * Set a value at a property path, creating missing containers.
 *
 * Missing intermediate steps become an object, or an array sized to the next
 * index when that key is an array index, e.g. `"persons[2].name"` grows the
 * array to at least three elements. Existing containers are reused. The source
 * object is mutated in place and returned.
 *
 * @param source - Object to write the path into.
 * @param path - Property path, e.g. `"persons[0].name"`.
 * @param value - The value to assign.
 * @returns The source object, for chaining.
 */
export const setProperty = (
	source: Record<string, unknown>,
	path: string,
	value: unknown
): Record<string, unknown> => {
	let current = source;
	const keys = splitPath(path);
	const lastKey = keys.pop();

	if (lastKey === undefined) return source;

	keys.forEach((key, i) => {
		const nextKey = keys[i + 1] ?? lastKey;

		if (current[key] === undefined) {
			current[key] = isArrayIndex(nextKey) ? Array(Number(nextKey) + 1).fill(undefined) : {};
		}

		current = current[key] as Record<string, unknown>;
	});

	current[lastKey] = value;

	return source;
};
