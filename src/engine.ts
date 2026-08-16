import { getProperty, hasProperty, setProperty } from "./utilities/properties";

/**
 * Value that flows from data into a rendered DOM node.
 *
 * Text content, attributes, and input values are all scalar: strings,
 * numbers, and booleans. `null` and `undefined` clear a binding. Objects and
 * functions are not meaningful rendered values, so the resolver contract
 * excludes them.
 */
export type RenderValue = string | number | boolean | null | undefined;

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

		if (container.children.length > 1) {
			throw new Error("Template string must have a single root element");
		}

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
 * SELECT is handled separately: linkedom exposes a readonly `value`, so the
 * selected option is set through each option's `selected` property instead.
 *
 * @param el - The target element.
 * @param value - The string value to set.
 */
const setValue = (el: Element, value: string): void => {
	if (el.tagName === "SELECT") {
		for (const option of Array.from(el.querySelectorAll("option"))) {
			const optionValue = option.getAttribute("value") ?? option.textContent ?? "";
			(option as HTMLOptionElement).selected = optionValue === value;
		}

		return;
	}

	if (isValueControl(el)) {
		el.value = value;
	} else {
		el.setAttribute("value", value);
	}
};

/**
 * Attribute names that are presence-based boolean attributes.
 *
 * For these, `setAttribute(name, "false")` would still enable the attribute,
 * so the binding toggles the attribute by the value's truthiness instead.
 */
const BOOLEAN_ATTRIBUTES = new Set([
	"checked",
	"disabled",
	"hidden",
	"readonly",
	"required",
	"multiple",
	"selected",
	"autofocus",
	"autoplay",
	"controls",
	"loop",
	"muted",
	"open",
	"novalidate",
	"inert",
	"async",
	"defer",
	"reversed"
]);

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

type Binding = { path: string; apply: (data: TemplesData, root: Element) => void };

/**
 * Resolve the element at an index path from a root.
 *
 * Bindings are root-relative so the same binding can target the template root
 * or any clone of it (used by `data-iterate` to re-apply values to live rows).
 *
 * @param root - The root element the path starts from.
 * @param indexPath - Child indexes from the root to the target element.
 * @returns The target element.
 */
const elementAt = (root: Element, indexPath: number[]): Element => {
	let el: Element = root;

	for (const i of indexPath) {
		const child = el.children[i];

		if (child === undefined) {
			throw new Error("Binding index path is out of range");
		}

		el = child;
	}

	return el;
};

/**
 * Build the closure that applies one binding to its element during render.
 *
 * @param indexPath - Child indexes locating the bound element from the root.
 * @param parsed - The parsed binding.
 * @returns A binding that applies one `data-bind` expression during render.
 */
const buildBinding = (indexPath: number[], parsed: ParsedBinding): Binding => ({
	path: parsed.path,
	apply: (data: TemplesData, root: Element) => {
		const el = elementAt(root, indexPath);
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
				if (BOOLEAN_ATTRIBUTES.has(parsed.attr)) {
					el.toggleAttribute(parsed.attr, Boolean(raw));
				} else {
					el.setAttribute(parsed.attr, value);
				}
				break;
			case "class":
				applyClass(el, parsed.range, value);
				break;
		}
	}
});

/**
 * Strip a trailing plural `s` from a collection name for auto-naming.
 *
 * The `s` is kept when the word ends in `ss`, `us`, or `is`, which are not
 * plural markers (`address`, `status`, `analysis`). All other trailing `s`
 * characters are removed (`tags` → `tag`, `quotes` → `quote`).
 *
 * @param word - The collection name.
 * @returns The singularized name.
 */
const singularize = (word: string): string => {
	if (word.length > 1 && word.endsWith("s") && !/(ss|us|is)$/.test(word)) {
		return word.slice(0, -1);
	}

	return word;
};

/**
 * Parse a `data-iterate` expression into a variable name and a collection path.
 *
 * Supported forms: `path` (the variable name is derived from the collection
 * path), `name: path`, and `name from path`. The `from` keyword is recognized
 * only as a standalone word, so a path segment named `from`
 * (`messages.from.user`) is left intact. Auto-naming keeps the last path
 * segment and strips only a plural `s`.
 *
 * @param loopExpr - The `data-iterate` or `data-each` attribute value.
 * @returns The variable name and the collection path.
 */
const parseLoop = (loopExpr: string): { varName: string; collectionPath: string } => {
	const trimmed = loopExpr.trim();

	const colon = trimmed.indexOf(":");

	if (colon !== -1) {
		const varName = trimmed.slice(0, colon).trim();
		const collectionPath = trimmed.slice(colon + 1).trim();

		if (varName.length > 0 && collectionPath.length > 0) {
			return { varName, collectionPath };
		}
	}

	const fromMatch = /^(\S+)\s+from\s+(\S+)$/.exec(trimmed);

	if (fromMatch !== null) {
		return { varName: fromMatch[1] ?? "", collectionPath: fromMatch[2] ?? "" };
	}

	const collectionPath = trimmed;
	const last = collectionPath.split(".").pop() ?? "";

	return { varName: singularize(last), collectionPath };
};

/**
 * Extract the reconciliation key for a collection item.
 *
 * The key comes from the `data-key` path when provided, otherwise from the
 * item's `id` property. A missing key returns `null`, which disables keyed
 * reconciliation and falls back to re-stamping.
 *
 * @param item - The collection item.
 * @param keyPath - The `data-key` path relative to the item, or null.
 * @returns The string key, or null when the item has no usable key.
 */
const getItemKey = (item: unknown, keyPath: string | null): string | null => {
	if (keyPath !== null) {
		const value = getProperty<unknown>(item as object, keyPath, null);

		if (value === null || value === undefined) return null;

		return String(value);
	}

	if (item !== null && typeof item === "object" && "id" in (item as object)) {
		const id = (item as Record<string, unknown>).id;

		if (id !== null && id !== undefined) return String(id);
	}

	return null;
};

/**
 * Build the binding that stamps one sub-template clone per collection item.
 *
 * The first child of the iterate element is the sub-template. It is detached
 * at construction and its bindings are collected once. On render, items are
 * reconciled by key (`data-key` or item `id`): rows that keep their key are
 * reused in place, so input focus and scroll survive; new keys clone a fresh
 * row and removed keys are dropped. Without keys, the list re-stamps.
 *
 * @param indexPath - Child indexes locating the iterate container.
 * @param template - The detached sub-template element.
 * @param loopExpr - The `data-iterate` or `data-each` attribute value.
 * @param keyPath - The `data-key` path, or null when not declared.
 * @returns A binding that reconciles the items on every render.
 */
const buildIterate = (
	indexPath: number[],
	template: Element,
	loopExpr: string,
	keyPath: string | null
): Binding => {
	const { varName, collectionPath } = parseLoop(loopExpr);
	const subBindings = collectBindings(template);
	let rendered = new Map<string, Element>();

	return {
		path: collectionPath,
		apply: (data: TemplesData, root: Element) => {
			const el = elementAt(root, indexPath);
			const value = getProperty<unknown>(data, collectionPath, null);
			const collection = Array.isArray(value) ? (value as TemplesDataValue[]) : [];

			const keyed = collection.map((item) => ({ key: getItemKey(item, keyPath), item }));
			const keyable = keyed.every(({ key }) => key !== null);

			const fragment = document.createDocumentFragment();

			if (keyable) {
				const next = new Map<string, Element>();

				for (const { key, item } of keyed) {
					const k = key as string;
					const existing = rendered.get(k);
					const node = existing ?? (template.cloneNode(true) as Element);
					const context = { ...data, [varName]: item };

					for (const binding of subBindings) binding.apply(context, node);

					next.set(k, node);
					fragment.appendChild(node);
				}

				rendered = next;
			} else {
				for (const item of collection) {
					const node = template.cloneNode(true) as Element;
					const context = { ...data, [varName]: item };

					for (const binding of subBindings) binding.apply(context, node);

					fragment.appendChild(node);
				}

				rendered = new Map();
			}

			el.replaceChildren(fragment);
		}
	};
};

/**
 * Build the binding that shows or hides an element by condition.
 *
 * A truthy condition clears the inline `display` (restoring the element's
 * natural visibility, even when authored `display:none`); a falsy condition
 * hides it with `display:none`.
 *
 * @param indexPath - Child indexes locating the conditioned element.
 * @param condition - The path to resolve the condition from.
 * @returns A binding that toggles the element's display.
 */
const buildRenderIf = (indexPath: number[], condition: string): Binding => ({
	path: condition,
	apply: (data: TemplesData, root: Element) => {
		const el = elementAt(root, indexPath) as HTMLElement;
		el.style.display = getProperty(data, condition, "") ? "" : "none";
	}
});

/**
 * Collect every binding within a root element.
 *
 * Each binding targets one element: a `data-bind` applies values, a
 * `data-render-if` shows or hides, and a `data-iterate` reconciles sub-template
 * clones. Control attributes are removed so the rendered output stays clean.
 * The root itself is included when it carries a control attribute. Bindings
 * are captured once, at construction time, and are root-relative so they can
 * target clones.
 *
 * @param root - The template root element.
 * @returns Array of bindings, applied in document order.
 */
const collectBindings = (root: Element): Binding[] => {
	const bindings: Binding[] = [];

	const collect = (el: Element, indexPath: number[]): void => {
		const loopExpr = el.getAttribute("data-iterate") || el.getAttribute("data-each");

		if (loopExpr) {
			const bindExpr = el.getAttribute("data-bind");

			if (bindExpr) {
				const parsed = parseBindings(bindExpr, el);

				if (parsed.length > 0) {
					el.removeAttribute("data-bind");

					for (const binding of parsed) bindings.push(buildBinding(indexPath, binding));
				}
			}

			const template = el.firstElementChild;

			if (template === null) {
				throw new Error(
					`${el.tagName} data-iterate must have a child element to use as sub-template`
				);
			}

			el.removeChild(template);

			const keyPath = el.getAttribute("data-key");

			if (keyPath !== null) el.removeAttribute("data-key");

			el.removeAttribute("data-iterate");
			el.removeAttribute("data-each");

			bindings.push(buildIterate(indexPath, template, loopExpr, keyPath));

			return;
		}

		const condition = el.getAttribute("data-render-if");

		if (condition) {
			el.removeAttribute("data-render-if");
			bindings.push(buildRenderIf(indexPath, condition));
		}

		const bindExpr = el.getAttribute("data-bind");

		if (bindExpr) {
			const parsed = parseBindings(bindExpr, el);

			if (parsed.length > 0) {
				el.removeAttribute("data-bind");

				for (const binding of parsed) bindings.push(buildBinding(indexPath, binding));
			}
		}

		for (let i = 0; i < el.children.length; i++) {
			const child = el.children[i];

			if (child !== undefined) collect(child, [...indexPath, i]);
		}
	};

	collect(root, []);

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
	readonly rootElt: Element;
	private readonly bindings: Binding[];

	constructor(source: Element | string) {
		this.rootElt = toElement(source);
		this.bindings = collectBindings(this.rootElt);
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
			if (hasProperty(data, binding.path)) binding.apply(data, this.rootElt);
		}

		return this.rootElt;
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
			if (binding.path === path) binding.apply(data, this.rootElt);
		}

		return this.rootElt;
	}

	/**
	 * Serialize the rendered root to an HTML string.
	 *
	 * The root element is the template root, so its outer HTML carries every
	 * rendered binding. Control attributes were removed at construction, so the
	 * markup stays clean.
	 *
	 * @returns The serialized HTML of the root element.
	 */
	toHtml(): string {
		return this.rootElt.outerHTML;
	}

	/**
	 * Serialize the rendered root to an HTML string.
	 *
	 * Synonym for `toHtml()`.
	 *
	 * @returns The serialized HTML of the root element.
	 */
	renderToString(): string {
		return this.toHtml();
	}
}
