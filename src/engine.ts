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
 * A leaf is a scalar (`RenderValue`) or a parameterless function returning a
 * scalar. The function is called with its parent dictionary as `this`, so
 * methods can reference sibling properties. A non-leaf is a nested
 * dictionary.
 */
export type TemplesDataValue = RenderValue | ((this: TemplesData) => RenderValue) | TemplesData;

/**
 * Resolve a dotted property path against a Temples data dictionary.
 *
 * Intermediate steps must be dictionaries. A leaf is a scalar or a
 * parameterless function: the function is called with its parent dictionary
 * as `this` and its result is used. A function that returns `null` or
 * `undefined` yields an empty string. Falsy scalars such as `0` and `false`
 * are preserved; only `null` and `undefined` collapse to an empty string. A
 * path that resolves to a dictionary yields an empty string.
 *
 * @param path - Dotted path, e.g. `"article.author.name"`.
 * @param data - Root data dictionary to resolve the path against.
 * @returns Resolved scalar value, function result, or empty string when missing.
 */
export const evalProperty = (path: string, data: TemplesData): RenderValue => {
	const steps = (path ?? "").trim().split(".");

	let current: TemplesDataValue | undefined = data;
	let parent: TemplesData = data;

	for (const step of steps) {
		if (current == null) return "";

		if (typeof current !== "object") return "";

		parent = current;
		current = current[step];
	}

	if (current == null) return "";

	if (typeof current === "function") {
		const result: RenderValue | null | undefined = current.call(parent);

		return result == null ? "" : result;
	}

	if (typeof current === "string" || typeof current === "number" || typeof current === "boolean") {
		return current;
	}

	return "";
};

/**
 * Normalise a template source into a DOM element.
 *
 * An HTML string is parsed once into a container element and the first
 * element child is returned as the template root. A DOM element is returned
 * unchanged.
 *
 * @param source - DOM element or HTML string.
 * @returns The element to use as the renderer root.
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

type Binding = { apply: (data: TemplesData) => void };

/**
 * Build the closure that applies one binding to its element during render.
 *
 * @param el - The bound DOM element.
 * @param parsed - The parsed binding.
 * @returns A binding record carrying the apply function.
 */
const makeBinding = (el: Element, parsed: ParsedBinding): Binding => ({
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
 * Collect every `data-bind` binding within a root element.
 *
 * The root itself is included when it carries `data-bind`. Each bound
 * element's `data-bind` attribute is removed so the rendered output stays
 * clean. Bindings are captured once, at construction time.
 *
 * @param root - The template root element.
 * @returns Array of binding records.
 */
const collectBindings = (root: Element): Binding[] => {
	const descendants = Array.from(root.querySelectorAll("[data-bind]"));
	const targets = root.matches("[data-bind]") ? [root, ...descendants] : descendants;

	const bindings: Binding[] = [];

	for (const el of targets) {
		const expr = el.getAttribute("data-bind") ?? "";
		const parsed = parseBindings(expr, el);

		if (parsed.length === 0) continue;

		el.removeAttribute("data-bind");

		for (const binding of parsed) {
			bindings.push(makeBinding(el, binding));
		}
	}

	return bindings;
};

/**
 * Standalone, DOM-based renderer for a single template.
 *
 * Parses the template source once into a DOM element, collects its
 * `data-bind` bindings, and applies them on every `render` call.
 */
export class Renderer {
	readonly root: Element;
	private readonly bindings: Binding[];

	constructor(source: Element | string) {
		this.root = toElement(source);
		this.bindings = collectBindings(this.root);
	}

	/**
	 * Apply every binding to the template with the provided data.
	 *
	 * @param data - Data dictionary to resolve binding paths against.
	 * @returns The rendered root element.
	 */
	render(data: TemplesData): Element {
		for (const binding of this.bindings) {
			binding.apply(data);
		}

		return this.root;
	}
}
