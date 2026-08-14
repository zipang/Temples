import { getProperty, setProperty } from "./utilities/properties";

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
 * with its owner dictionary as `this`, so methods can reference sibling
 * properties. Arrays feed `data-iterate`.
 */
export type TemplesDataValue =
	| RenderValue
	| ((this: TemplesData) => RenderValue)
	| TemplesData
	| TemplesDataValue[];

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
 * @param attrPart - The attribute part of the binding expression.
 * @returns The range of class names, or null when the form is not `class[...]`.
 */
const parseClassRange = (attrPart: string): string[] | null => {
	const open = attrPart.indexOf("[");
	const close = attrPart.indexOf("]", open);

	if (open === -1 || close === -1) return null;

	if (attrPart.slice(0, open).trim().toLowerCase() !== "class") return null;

	return attrPart
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

	const attrPart = expr.slice(0, eq).trim();
	const path = expr.slice(eq + 1).trim();
	const name = attrPart.toLowerCase();

	if (name === "text") return { kind: "text", path };
	if (name === "html") return { kind: "html", path };
	if (name === "value") return { kind: "value", path };

	const range = parseClassRange(attrPart);
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

type Binding = { path: string; apply: (data: TemplesData) => void };

/**
 * Build the closure that applies one binding to its element during render.
 *
 * @param el - The bound DOM element.
 * @param parsed - The parsed binding.
 * @returns A binding that applies one `data-bind` expression during render.
 */
const buildBinding = (el: Element, parsed: ParsedBinding): Binding => ({
	path: parsed.path,
	apply: (data: TemplesData) => {
		const raw = getProperty(data, parsed.path, "");

		const value =
			typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean"
				? String(raw)
				: "";

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
const parseLoop = (loopExpr: string): { varName: string; collectionPath: string } => {
	const match = /^\s*(.*?)\s*(?::|from)\s*(.*)$/.exec(loopExpr);

	if (match !== null && (match[2] ?? "").length > 0) {
		return { varName: match[1] ?? "", collectionPath: match[2] ?? "" };
	}

	const collectionPath = loopExpr.trim();
	const last = collectionPath.split(".").pop() ?? "";

	return { varName: last.replace(/s*$/, ""), collectionPath };
};

/**
 * Build the binding that stamps one sub-template clone per collection item.
 *
 * The first child of the iterate element is the sub-template. It is detached
 * from the container at construction, its bindings are collected once, and
 * each item renders a fresh clone. Item values are exposed to the
 * sub-template under the variable name.
 *
 * @param el - The iterate container element.
 * @param loopExpr - The `data-iterate` or `data-each` attribute value.
 * @returns A binding that re-stamps the items on every render.
 */
const buildIterate = (el: Element, loopExpr: string): Binding => {
	const { varName, collectionPath } = parseLoop(loopExpr);
	const template = el.firstElementChild;

	if (template === null) {
		throw new Error(`${el.tagName} data-iterate must have a child element to use as sub-template`);
	}

	const subBindings = collectBindings(template);

	el.removeChild(template);

	return {
		path: collectionPath,
		apply: (data: TemplesData) => {
			const value = getProperty<unknown>(data, collectionPath, null);
			const collection = Array.isArray(value) ? (value as TemplesDataValue[]) : [];

			while (el.firstChild !== null) el.removeChild(el.firstChild);

			for (const item of collection) {
				const context = { ...data, [varName]: item };

				for (const binding of subBindings) binding.apply(context);

				el.appendChild(template.cloneNode(true));
			}
		}
	};
};

/**
 * Build the binding that shows or hides an element by condition.
 *
 * The element's inline display value is captured at construction so a shown
 * element keeps its authored layout. A falsy condition hides the element.
 *
 * @param el - The conditioned element.
 * @param condition - The path to resolve the condition from.
 * @returns A binding that toggles the element's display.
 */
const buildRenderIf = (el: HTMLElement, condition: string): Binding => {
	const originalDisplay = el.style.display;

	return {
		path: condition,
		apply: (data: TemplesData) => {
			el.style.display = getProperty(data, condition, "") ? originalDisplay : "none";
		}
	};
};

/**
 * Collect every binding within a root element.
 *
 * Each binding targets one element: a `data-bind` applies values, a
 * `data-render-if` shows or hides, and a `data-iterate` stamps sub-template
 * clones. Control attributes are removed so the rendered output stays clean.
 * The root itself is included when it carries a control attribute. Bindings
 * are captured once, at construction time.
 *
 * @param root - The template root element.
 * @returns Array of bindings, applied in document order.
 */
const collectBindings = (root: Element): Binding[] => {
	const bindings: Binding[] = [];

	const collect = (el: Element): void => {
		const loopExpr = el.getAttribute("data-iterate") || el.getAttribute("data-each");

		if (loopExpr) {
			const bindExpr = el.getAttribute("data-bind");

			if (bindExpr) {
				const parsed = parseBindings(bindExpr, el);

				if (parsed.length > 0) {
					el.removeAttribute("data-bind");

					for (const binding of parsed) bindings.push(buildBinding(el, binding));
				}
			}

			el.removeAttribute("data-iterate");
			el.removeAttribute("data-each");
			bindings.push(buildIterate(el, loopExpr));

			return;
		}

		const condition = el.getAttribute("data-render-if");

		if (condition) {
			el.removeAttribute("data-render-if");
			bindings.push(buildRenderIf(el as HTMLElement, condition));
		}

		const bindExpr = el.getAttribute("data-bind");

		if (bindExpr) {
			const parsed = parseBindings(bindExpr, el);

			if (parsed.length > 0) {
				el.removeAttribute("data-bind");

				for (const binding of parsed) bindings.push(buildBinding(el, binding));
			}
		}

		for (const child of Array.from(el.children)) collect(child);
	};

	collect(root);

	return bindings;
};

/**
 * Standalone, DOM-based renderer for a single template.
 *
 * Parses the template source once into a DOM element and collects every
 * binding. Each render call applies only the bindings whose paths resolve in
 * the provided data.
 */
export class Renderer {
	readonly root: Element;
	private readonly bindings: Binding[];

	constructor(source: Element | string) {
		this.root = toElement(source);
		this.bindings = collectBindings(this.root);
	}

	/**
	 * Render the bindings whose paths are present in the provided data.
	 *
	 * Every binding is applied when its path resolves in the data. A path
	 * absent from the data keeps its current state. A partial dictionary
	 * re-renders only the paths it carries, while a full dictionary
	 * re-renders every present path.
	 *
	 * @param data - Data dictionary; the paths it carries are rendered.
	 * @returns The rendered root element.
	 */
	render(data: TemplesData): Element {
		for (const binding of this.bindings) {
			if (getProperty(data, binding.path) !== undefined) binding.apply(data);
		}

		return this.root;
	}

	/**
	 * Update a single path and re-render only the bindings bound to it.
	 *
	 * The path is written into a fresh nested dictionary, e.g. `"article.title"`
	 * yields `{ article: { title: value } }`, and only the operations bound to
	 * that exact path are applied. All other bindings keep their current state.
	 *
	 * @param path - Dotted path to the property, e.g. `"article.title"`.
	 * @param value - The value to assign to the property.
	 * @returns The rendered root element.
	 */
	update(path: string, value: TemplesDataValue): Element {
		const data: TemplesData = {};

		setProperty(data, path, value);

		for (const binding of this.bindings) {
			if (binding.path === path) binding.apply(data);
		}

		return this.root;
	}
}
