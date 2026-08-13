import { parseHTML } from "linkedom";

const dom = parseHTML("<!doctype html><html><head></head><body></body></html>");

const globals = {
	document: dom.document,
	Document: dom.Document,
	DocumentFragment: dom.DocumentFragment,
	Element: dom.Element,
	HTMLElement: dom.HTMLElement,
	Node: dom.Node,
	DOMParser: dom.DOMParser,
	customElements: dom.customElements,
	CustomElementRegistry: dom.CustomElementRegistry,
	Event: dom.Event,
	CustomEvent: dom.CustomEvent,
	MutationObserver: dom.MutationObserver,
	ShadowRoot: dom.ShadowRoot
};

for (const [key, value] of Object.entries(globals)) {
	if (value !== undefined) {
		(globalThis as Record<string, unknown>)[key] = value;
	}
}
