/**
 * Resolve a dotted property path against a data object.
 *
 * When the final value is a function, it is called with its parent object as
 * `this` so methods can reference sibling properties. A path that does not
 * resolve returns an empty string. Falsy values such as `0` and `false` are
 * preserved; only `null` and `undefined` collapse to an empty string.
 *
 * @param path - Dotted path, e.g. `"article.author.name"`.
 * @param data - Root data object to resolve the path against.
 * @returns Resolved value, function result, or empty string when missing.
 */
export const evalProperty = (path: string, data: unknown): unknown => {
	const steps = (path ?? "").trim().split(".");

	let current = data;
	let parent: unknown;

	for (const step of steps) {
		if (current == null) return "";

		parent = current;
		current = (current as Record<string, unknown>)[step];
	}

	if (typeof current === "function") {
		const result = (current as (...args: unknown[]) => unknown).call(parent);

		return result == null ? "" : result;
	}

	return current == null ? "" : current;
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

type BindingKind = "text" | "html";

type ParsedBinding = { kind: BindingKind; path: string } | null;

/**
 * Parse a single `data-bind` expression into a typed binding.
 *
 * Supported forms for this phase: `text=path`, `html=path`, and the shorthand
 * `path` (defaults to text semantics). Other binding kinds arrive in a later
 * phase and are ignored here.
 *
 * @param expr - The `data-bind` attribute value.
 * @returns Parsed binding, or null when the kind is not yet supported.
 */
const parseBinding = (expr: string): ParsedBinding => {
	const eq = expr.indexOf("=");

	if (eq === -1) return { kind: "text", path: expr.trim() };

	const attr = expr.slice(0, eq).trim().toLowerCase();
	const path = expr.slice(eq + 1).trim();

	if (attr === "text") return { kind: "text", path };
	if (attr === "html") return { kind: "html", path };

	return null;
};

type Binding = { apply: (data: unknown) => void };

/**
 * Build the closure that applies one binding to its element during render.
 *
 * @param el - The bound DOM element.
 * @param parsed - The parsed binding kind and data path.
 * @returns A binding record carrying the apply function.
 */
const makeBinding = (el: Element, parsed: { kind: BindingKind; path: string }): Binding => ({
	apply: (data: unknown) => {
		const value = String(evalProperty(parsed.path, data));

		if (parsed.kind === "text") el.textContent = value;
		else el.innerHTML = value;
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
		const parsed = parseBinding(el.getAttribute("data-bind") ?? "");
		if (!parsed) continue;

		el.removeAttribute("data-bind");
		bindings.push(makeBinding(el, parsed));
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
	 * @param data - Data object to resolve binding paths against.
	 * @returns The rendered root element.
	 */
	render(data: unknown): Element {
		for (const binding of this.bindings) {
			binding.apply(data);
		}

		return this.root;
	}
}
