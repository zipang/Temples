/**
 * Value that flows from data into a rendered DOM node.
 *
 * Text content, attributes, and input values are all scalar: strings,
 * numbers, and booleans. Objects and functions are not meaningful rendered
 * values, so the resolver contract excludes them.
 */
export type RenderValue = string | number | boolean;

/**
 * The recursive dictionary shape that Temples renders against.
 *
 * Every key is a string. Every value is a scalar, a parameterless function
 * that returns a scalar, or another dictionary of the same shape. Declared as
 * an interface so the recursive reference resolves without a circular-alias
 * error.
 */
export interface TemplesData {
	[key: string]: TemplesDataValue;
}

/**
 * A value held in a Temples data dictionary.
 *
 * A value is a scalar (`RenderValue`), a parameterless function returning a
 * scalar, a nested dictionary, or an array of values. The function is called
 * with its parent dictionary as `this`, so methods can reference sibling
 * properties. Arrays feed `data-iterate`.
 */
export type TemplesDataValue =
	| RenderValue
	| ((this: TemplesData) => RenderValue)
	| TemplesData
	| TemplesDataValue[];

/**
 * The result of walking a dotted path against a data dictionary.
 */
type ResolvedPath = { value: TemplesDataValue | undefined; parent: TemplesData };

/**
 * Walk a dotted property path against a Temples data dictionary.
 *
 * Intermediate steps must be dictionaries; a path that crosses a scalar, an
 * array, or a missing value does not resolve. The final step may be any
 * value, including an array or a function.
 *
 * @param path - Dotted path, e.g. `"article.author.name"`.
 * @param data - Root data dictionary to resolve the path against.
 * @returns The resolved value with its parent, or null when the path stops early.
 */
const resolvePath = (path: string, data: TemplesData): ResolvedPath | null => {
	const steps = (path ?? "").trim().split(".");

	let current: TemplesDataValue | undefined = data;
	let parent: TemplesData = data;

	for (const step of steps) {
		if (current == null || typeof current !== "object" || Array.isArray(current)) return null;

		parent = current;
		current = current[step];
	}

	return { value: current, parent };
};

/**
 * Resolve a dotted property path against a Temples data dictionary.
 *
 * A leaf is a scalar or a parameterless function: the function is called with
 * its parent dictionary as `this` and its result is used. A function that
 * returns `null` or `undefined` yields an empty string. Falsy scalars such as
 * `0` and `false` are preserved; only `null` and `undefined` collapse to an
 * empty string. A path that resolves to a dictionary or an array yields an
 * empty string.
 *
 * @param path - Dotted path, e.g. `"article.author.name"`.
 * @param data - Root data dictionary to resolve the path against.
 * @returns Resolved scalar value, function result, or empty string when missing.
 */
export const evalProperty = (path: string, data: TemplesData): RenderValue => {
	const resolved = resolvePath(path, data);

	if (resolved === null || resolved.value == null) return "";

	const { value, parent } = resolved;

	if (typeof value === "function") {
		const result: RenderValue | null | undefined = value.call(parent);

		return result == null ? "" : result;
	}

	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return value;
	}

	return "";
};

/**
 * Write a value at a dotted path, creating missing intermediate dictionaries.
 *
 * An intermediate that is not a dictionary is replaced by an empty
 * dictionary. A dotted key lets a render delta address a nested path
 * directly, e.g. `"article.title"`.
 *
 * @param data - The dictionary to write into.
 * @param path - Dotted path, e.g. `"article.title"`.
 * @param value - The value to write at the path.
 */
const setPath = (data: TemplesData, path: string, value: TemplesDataValue): void => {
	const parts = path.split(".");
	const last = parts.pop();

	if (last === undefined) return;

	let current: TemplesData = data;

	for (const part of parts) {
		const next = current[part];
		const branch: TemplesData =
			next != null && typeof next === "object" && !Array.isArray(next) ? next : {};

		current[part] = branch;
		current = branch;
	}

	current[last] = value;
};

/**
 * Give the renderer one stable root element to bind against and re-render.
 *
 * An HTML string is a fragment, not an element: it can contain several
 * sibling elements or only text, so it has no single element identity. The
 * challenge is to collapse any fragment to one element. Parsing inside a
 * throwaway container does that: the first element child becomes the root,
 * and the container is discarded. A bare container is returned only when the
 * fragment yields no element at all. A DOM element source is already a root
 * and is returned unchanged.
 *
 * @param source - DOM element or HTML string.
 * @returns A single element usable as the template root.
 */
const toElement = (source: Element | string): Element => {
	if (typeof source === "string") {
		const container = document.createElement("div");
		container.innerHTML = source.trim();

		return container.firstElementChild ?? container;
	}

	return source;
};

type ParsedBinding =
	| { kind: "text"; path: string }
	| { kind: "html"; path: string }
	| { kind: "value"; path: string }
	| { kind: "attr"; attr: string; path: string }
	| { kind: "class"; range: string[]; path: string };

/**
 * A form control whose value is set through the `value` property.
 */
interface ValueControl extends HTMLElement {
	value: string;
}

/**
 * Detect the form controls that expose a writable `value` property.
 *
 * INPUT and TEXTAREA support property assignment in the browser and in
 * linkedom. SELECT is excluded because linkedom exposes a readonly `value`.
 *
 * @param el - The candidate element.
 * @returns True when the element is an INPUT or TEXTAREA.
 */
const isValueControl = (el: Element): el is ValueControl => {
	const tag = el.tagName;

	return tag === "INPUT" || tag === "TEXTAREA";
};

/**
 * Detect the form controls whose shorthand binding targets the value.
 *
 * @param el - The candidate element.
 * @returns True when the element is an INPUT, TEXTAREA, or SELECT.
 */
const isFormControl = (el: Element): boolean => {
	const tag = el.tagName;

	return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
};

/**
 * Set the `value` on a form control, or the `value` attribute otherwise.
 *
 * @param el - The target element.
 * @param value - The string value to set.
 */
const setValue = (el: Element, value: string): void => {
	if (isValueControl(el)) {
		el.value = value;
	} else {
		el.setAttribute("value", value);
	}
};

/**
 * Apply a `class[range]=path` toggle to an element.
 *
 * Every class name in the range is removed, then the evaluated value is
 * re-added when it belongs to the range. All other class names stay intact.
 *
 * @param el - The target element.
 * @param range - The class names the binding toggles.
 * @param active - The evaluated value.
 */
const applyClass = (el: Element, range: string[], active: string): void => {
	const classes = new Set(Array.from(el.classList));

	for (const name of range) classes.delete(name);
	if (range.includes(active)) classes.add(active);

	el.setAttribute("class", Array.from(classes).join(" "));
};

/**
 * Extract the toggled class range from a `class[a|b|c]` expression.
 *
 * @param left - The attribute part of the binding expression.
 * @returns The range of class names, or null when the form is not `class[...]`.
 */
const parseClassRange = (left: string): string[] | null => {
	const open = left.indexOf("[");
	const close = left.indexOf("]", open);

	if (open === -1 || close === -1) return null;

	if (left.slice(0, open).trim().toLowerCase() !== "class") return null;

	return left
		.slice(open + 1, close)
		.split("|")
		.map((name) => name.trim())
		.filter((name) => name.length > 0);
};

/**
 * Parse one `data-bind` expression into a typed binding.
 *
 * Supported forms: `text=path`, `html=path`, `value=path`, `<attr>=path`,
 * `class[a|b|c]=path`, and the shorthand `path`. The shorthand targets the
 * value on form controls and the text otherwise.
 *
 * @param expr - A single expression, without commas.
 * @param el - The bound element, used to resolve the shorthand target.
 * @returns Parsed binding, or null when the kind is not supported.
 */
const parseExpression = (expr: string, el: Element): ParsedBinding | null => {
	const eq = expr.indexOf("=");

	if (eq === -1) {
		const path = expr.trim();

		return { kind: isFormControl(el) ? "value" : "text", path };
	}

	const left = expr.slice(0, eq).trim();
	const path = expr.slice(eq + 1).trim();
	const name = left.toLowerCase();

	if (name === "text") return { kind: "text", path };
	if (name === "html") return { kind: "html", path };
	if (name === "value") return { kind: "value", path };

	const range = parseClassRange(left);
	if (range !== null) return { kind: "class", range, path };

	if (/^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/.test(name)) {
		return { kind: "attr", attr: name, path };
	}

	return null;
};

/**
 * Parse a comma-separated `data-bind` attribute into a list of bindings.
 *
 * @param expr - The full `data-bind` attribute value.
 * @param el - The bound element.
 * @returns The list of parsed bindings. Unsupported expressions are skipped.
 */
const parseBindings = (expr: string, el: Element): ParsedBinding[] => {
	const bindings: ParsedBinding[] = [];

	for (const part of expr.split(",")) {
		const parsed = parseExpression(part, el);

		if (parsed !== null) bindings.push(parsed);
	}

	return bindings;
};

type Operation = { path: string; apply: (data: TemplesData) => void };

/**
 * Build the closure that applies one binding to its element during render.
 *
 * @param el - The bound DOM element.
 * @param parsed - The parsed binding.
 * @returns An operation bound to the binding's data path.
 */
const makeBinding = (el: Element, parsed: ParsedBinding): Operation => ({
	path: parsed.path,
	apply: (data: TemplesData) => {
		const value = String(evalProperty(parsed.path, data));

		switch (parsed.kind) {
			case "text":
				el.textContent = value;
				break;
			case "html":
				el.innerHTML = value;
				break;
			case "value":
				setValue(el, value);
				break;
			case "attr":
				el.setAttribute(parsed.attr, value);
				break;
			case "class":
				applyClass(el, parsed.range, value);
				break;
		}
	}
});

/**
 * Parse a `data-iterate` expression into a variable name and a collection path.
 *
 * Supported forms: `path` (the variable name is derived from the collection
 * path), `name: path`, and `name from path`. Auto-naming keeps the last path
 * segment without its trailing `s` characters.
 *
 * @param loopExpr - The `data-iterate` or `data-each` attribute value.
 * @returns The variable name and the collection path.
 */
const parseLoop = (loopExpr: string): { varName: string; seed: string } => {
	const match = /^\s*(.*?)\s*(?::|from)\s*(.*)$/.exec(loopExpr);

	if (match !== null && (match[2] ?? "").length > 0) {
		return { varName: match[1] ?? "", seed: match[2] ?? "" };
	}

	const seed = loopExpr.trim();
	const last = seed.split(".").pop() ?? "";

	return { varName: last.replace(/s*$/, ""), seed };
};

/**
 * Build the operation that stamps one sub-template clone per collection item.
 *
 * The first child of the iterate element is the sub-template. It is detached
 * from the container at construction, its operations are collected once, and
 * each item renders a fresh clone. Item values are exposed to the
 * sub-template under the variable name.
 *
 * @param el - The iterate container element.
 * @param loopExpr - The `data-iterate` or `data-each` attribute value.
 * @returns An operation that re-stamps the items on every render.
 */
const buildIterate = (el: Element, loopExpr: string): Operation => {
	const { varName, seed } = parseLoop(loopExpr);
	const template = el.firstElementChild;

	if (template === null) {
		throw new Error(`${el.tagName} data-iterate must have a child element to use as sub-template`);
	}

	const subOperations = collectOperations(template);

	el.removeChild(template);

	return {
		path: seed,
		apply: (data: TemplesData) => {
			const resolved = resolvePath(seed, data);
			const collection = resolved !== null && Array.isArray(resolved.value) ? resolved.value : [];

			while (el.firstChild !== null) el.removeChild(el.firstChild);

			for (const item of collection) {
				const context = { ...data, [varName]: item };

				for (const operation of subOperations) operation.apply(context);

				el.appendChild(template.cloneNode(true));
			}
		}
	};
};

/**
 * Build the operation that shows or hides an element by condition.
 *
 * The element's inline display value is captured at construction so a shown
 * element keeps its authored layout. A falsy condition hides the element.
 *
 * @param el - The conditioned element.
 * @param condition - The path to resolve the condition from.
 * @returns An operation that toggles the element's display.
 */
const buildRenderIf = (el: HTMLElement, condition: string): Operation => {
	const originalDisplay = el.style.display;

	return {
		path: condition,
		apply: (data: TemplesData) => {
			el.style.display = evalProperty(condition, data) ? originalDisplay : "none";
		}
	};
};

/**
 * Collect every rendering operation within a root element.
 *
 * Each operation targets one element: a `data-bind` applies values, a
 * `data-render-if` shows or hides, and a `data-iterate` stamps sub-template
 * clones. Control attributes are removed so the rendered output stays clean.
 * The root itself is included when it carries a control attribute. Operations
 * are captured once, at construction time.
 *
 * @param root - The template root element.
 * @returns Array of operations, applied in document order.
 */
const collectOperations = (root: Element): Operation[] => {
	const operations: Operation[] = [];

	const collect = (el: Element): void => {
		const loopExpr = el.getAttribute("data-iterate") || el.getAttribute("data-each");

		if (loopExpr) {
			const bindExpr = el.getAttribute("data-bind");

			if (bindExpr) {
				const parsed = parseBindings(bindExpr, el);

				if (parsed.length > 0) {
					el.removeAttribute("data-bind");

					for (const binding of parsed) operations.push(makeBinding(el, binding));
				}
			}

			el.removeAttribute("data-iterate");
			el.removeAttribute("data-each");
			operations.push(buildIterate(el, loopExpr));

			return;
		}

		const condition = el.getAttribute("data-render-if");

		if (condition) {
			el.removeAttribute("data-render-if");
			operations.push(buildRenderIf(el as HTMLElement, condition));
		}

		const bindExpr = el.getAttribute("data-bind");

		if (bindExpr) {
			const parsed = parseBindings(bindExpr, el);

			if (parsed.length > 0) {
				el.removeAttribute("data-bind");

				for (const binding of parsed) operations.push(makeBinding(el, binding));
			}
		}

		for (const child of Array.from(el.children)) collect(child);
	};

	collect(root);

	return operations;
};

/**
 * Normalise a render input into a nested data dictionary.
 *
 * A flat delta uses dotted keys, e.g. `{ "article.title": "New" }`; each key
 * is written as a nested path. A nested dictionary is rebuilt with its
 * top-level values kept by reference. Blank keys are skipped.
 *
 * @param input - A data dictionary or a flat dotted-path delta.
 * @returns A nested dictionary.
 */
const normalize = (input: TemplesData): TemplesData => {
	const data: TemplesData = {};

	for (const [key, value] of Object.entries(input)) {
		const path = key.trim();

		if (path.length === 0) continue;

		setPath(data, path, value);
	}

	return data;
};

/**
 * Collect every dotted path present in a data dictionary.
 *
 * Dictionaries are walked recursively so a nested value contributes each of
 * its paths, e.g. `{ article: { title: "x" } }` yields `article` and
 * `article.title`. Arrays, functions, and scalars are leaves and do not
 * descend.
 *
 * @param data - The data dictionary to walk.
 * @returns The dotted paths, top-down in object order.
 */
const enumeratePaths = (data: TemplesData): string[] => {
	const paths: string[] = [];

	const walk = (dict: TemplesData, prefix: string): void => {
		for (const [key, value] of Object.entries(dict)) {
			const path = prefix === "" ? key : `${prefix}.${key}`;

			paths.push(path);

			if (value != null && typeof value === "object" && !Array.isArray(value)) {
				walk(value, path);
			}
		}
	};

	walk(data, "");

	return paths;
};

/**
 * Standalone, DOM-based renderer for a single template.
 *
 * Parses the template source once into a DOM element, indexes every operation
 * by its data path, and renders only the paths present in each render call.
 */
export class Renderer {
	readonly root: Element;
	private readonly byPath: Map<string, Operation[]>;

	constructor(source: Element | string) {
		this.root = toElement(source);
		this.byPath = new Map();

		for (const operation of collectOperations(this.root)) {
			const list = this.byPath.get(operation.path);

			if (list !== undefined) {
				list.push(operation);
			} else {
				this.byPath.set(operation.path, [operation]);
			}
		}
	}

	/**
	 * Render the paths present in the provided data.
	 *
	 * Every dotted path in the data is resolved, and the operations bound to
	 * that exact path are applied. Paths absent from the data keep their
	 * current state. A flat delta such as `{ "article.title": "New" }`
	 * re-renders only that binding, while a full dictionary re-renders every
	 * present path.
	 *
	 * @param input - Data dictionary or flat dotted-path delta.
	 * @returns The rendered root element.
	 */
	render(input: TemplesData): Element {
		const data = normalize(input);

		for (const path of enumeratePaths(data)) {
			for (const operation of this.byPath.get(path) ?? []) {
				operation.apply(data);
			}
		}

		return this.root;
	}
}
