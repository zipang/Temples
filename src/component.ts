import { Renderer, type TemplesData } from "./engine";
import { reactive, subscribe } from "./reactive";

/**
 * Type an observed attribute's value as it flows into `state`.
 *
 * Without a type, an attribute writes a raw string. `boolean` maps `"false"`
 * and `"0"` to `false`, `number` parses a number, and `json` parses an object
 * or array literal.
 */
export type AttributeType = "boolean" | "number" | "json" | "string";

/**
 * Event handler invoked by a declarative event binding.
 *
 * The handler receives the original `Event` and the component instance whose
 * event map declared the binding.
 */
export type EventHandler = (event: Event, component: TemplesComponent) => void;

/**
 * Declarative map of event bindings.
 *
 * Each key has the form `"eventType selector"`, e.g. `"click .add-btn"`, and
 * maps to the handler run when an event of that type bubbles from an element
 * matching the selector inside the component.
 */
export type EventMap = Record<string, EventHandler>;

/**
 * Handler for a message delivered by the shared event bus.
 *
 * The handler receives the `CustomEvent` whose `type` is the fully qualified
 * message name and whose `detail` holds the emitted payload.
 */
export type MessageHandler = (event: CustomEvent) => void;

/**
 * Document-level listeners, one per event type, shared by every component.
 *
 * The listener resolves the closest `TemplesComponent` ancestor of the event
 * target and dispatches to that component's own `events` map, so a single
 * listener serves all instances of all classes that use the same event type.
 */
const documentListeners = new Map<string, (event: Event) => void>();

/**
 * Shared messaging bus, mapping a fully qualified message name to its handlers.
 *
 * Every component emits and subscribes through the same bus, so any component
 * can talk to any other regardless of class or DOM position. Message names are
 * prefixed with the emitting tag (`task-item:completed`) to keep classes from
 * colliding on the same local name.
 */
const messageHandlers = new Map<string, Set<MessageHandler>>();

/**
 * Deliver a message to every subscribed handler.
 *
 * A snapshot of the handler set is iterated so a handler that unsubscribes
 * during dispatch does not affect the current delivery.
 *
 * @param type - The fully qualified message name.
 * @param detail - The payload delivered on the message's `detail` property.
 */
const dispatchMessage = (type: string, detail: unknown): void => {
	const handlers = messageHandlers.get(type);

	if (handlers === undefined) return;

	const event = new CustomEvent(type, { detail });

	for (const handler of [...handlers]) handler(event);
};

/**
 * Base class for declarative Web Components with reactive state.
 *
 * A subclass declares its `tag`, `template`, and optional `events`,
 * `observedAttributes`, and `attributeTypes` as static fields. `define()`
 * parses the template once and registers the custom element. On connection the
 * state is rendered from the template, and any state mutation re-renders.
 */
export class TemplesComponent extends HTMLElement {
	/**
	 * The custom element tag name, e.g. `"todo-app"`.
	 */
	static tag = "";

	/**
	 * The HTML template string, parsed once by `define()`.
	 */
	static template = "";

	/**
	 * Optional declarative event map, `"eventType selector": handler`.
	 */
	static events: EventMap = {};

	/**
	 * Attribute names observed for changes, written into `state`.
	 */
	static observedAttributes: string[] = [];

	/**
	 * Optional coercion map from attribute name to `AttributeType`.
	 */
	static attributeTypes: Record<string, AttributeType> = {};

	/**
	 * Reactive component state.
	 *
	 * Subclasses assign an initial `reactive({ ... })` value. Mutations to this
	 * object re-render the component automatically.
	 */
	declare state: Record<string, unknown>;

	private renderer: Renderer | null = null;
	private unsubscribeState: (() => void) | null = null;

	constructor() {
		super();
		this.state = reactive({});
	}

	/**
	 * Register the custom element.
	 *
	 * Ensures a `<template id="tag">` exists in the document head, registers a
	 * document-level listener for every event type in `events`, then calls
	 * `customElements.define(this.tag, this)`.
	 */
	static define(): void {
		const ctor = this as typeof TemplesComponent;

		TemplesComponent.resolveTemplate(ctor);
		TemplesComponent.registerEventTypes(ctor);
		customElements.define(ctor.tag, ctor);
	}

	/**
	 * Register one document listener per event type declared in the class map.
	 *
	 * Listeners are deduplicated by event type across all component classes, so
	 * a click handler is attached to the document exactly once no matter how
	 * many classes or instances use it.
	 *
	 * @param ctor - The component class whose `events` map to register.
	 */
	private static registerEventTypes(ctor: typeof TemplesComponent): void {
		for (const binding of Object.keys(ctor.events)) {
			const type = binding.slice(0, binding.indexOf(" "));

			if (!documentListeners.has(type)) {
				const listener = (event: Event): void => TemplesComponent.dispatch(type, event);

				document.addEventListener(type, listener);
				documentListeners.set(type, listener);
			}
		}
	}

	/**
	 * Handle a document-level event for one event type.
	 *
	 * The closest `TemplesComponent` ancestor of the event target owns the
	 * event: only its `events` map is consulted, and a missing selector match
	 * there leaves outer components untouched.
	 *
	 * @param type - The event type this listener was registered for.
	 * @param event - The event that bubbled to the document.
	 */
	private static dispatch(type: string, event: Event): void {
		const component = TemplesComponent.resolveComponent(event);

		if (component === null) return;

		const ctor = component.constructor as typeof TemplesComponent;

		for (const [binding, handler] of Object.entries(ctor.events)) {
			const separator = binding.indexOf(" ");
			const bindingType = binding.slice(0, separator);

			if (bindingType !== type) continue;

			const selector = binding.slice(separator + 1).trim();

			if (TemplesComponent.matchesSelector(event, selector, component)) {
				handler(event, component);
			}
		}
	}

	/**
	 * Find the closest `TemplesComponent` ancestor of the event target.
	 *
	 * Walks the composed path from the target upward and returns the first
	 * element that is a component instance, or null when the event originates
	 * outside every component.
	 *
	 * @param event - The event whose target to resolve.
	 * @returns The closest component ancestor, or null.
	 */
	private static resolveComponent(event: Event): TemplesComponent | null {
		for (const node of event.composedPath()) {
			if (node instanceof TemplesComponent) return node;
		}

		return null;
	}

	/**
	 * Match a selector against the event target within the component subtree.
	 *
	 * Walks the composed path from the target up to the component itself; the
	 * first element that matches wins, and the component is the last node
	 * considered.
	 *
	 * @param event - The event whose target to match.
	 * @param selector - The CSS selector from the event binding.
	 * @param component - The owning component that bounds the match.
	 * @returns True when an element from the target up to the component matches.
	 */
	private static matchesSelector(
		event: Event,
		selector: string,
		component: TemplesComponent
	): boolean {
		for (const node of event.composedPath()) {
			if (node === component) return component.matches(selector);
			if (node instanceof Element && node.matches(selector)) return true;
		}

		return false;
	}

	/**
	 * Resolve the class template in the document head, creating it if missing.
	 *
	 * The template is identified by the tag name: `template#<tag>`. When it is
	 * absent, a `<template id="<tag>">` is created, filled from the class
	 * `template` string, and appended to the head. Keeping templates in the
	 * document makes them inspectable and lets components clone their content
	 * without re-parsing the string.
	 *
	 * @param ctor - The component class whose template to resolve.
	 * @returns The template element in the document head.
	 */
	private static resolveTemplate(ctor: typeof TemplesComponent): HTMLTemplateElement {
		let template = document.head.querySelector<HTMLTemplateElement>(`template#${ctor.tag}`);

		if (template === null) {
			template = document.createElement("template");
			template.id = ctor.tag;
			template.innerHTML = ctor.template;
			document.head.appendChild(template);
		}

		return template;
	}

	/**
	 * Render the state and seed the observed attributes.
	 *
	 * The template content is rendered into an internal container and then
	 * adopted into the host. The host's own attributes are left untouched so a
	 * parent component can feed it through `data-bind`; rendering against the
	 * container prevents the renderer from stripping those attributes.
	 *
	 * Called by the browser when the element connects to the DOM.
	 */
	connectedCallback(): void {
		const ctor = this.constructor as typeof TemplesComponent;
		const template = TemplesComponent.resolveTemplate(ctor);
		const content = template.content.cloneNode(true) as DocumentFragment;
		const container = document.createElement("div");

		container.appendChild(content);
		this.renderer = new Renderer(container);

		for (const name of ctor.observedAttributes) {
			if (this.hasAttribute(name)) {
				this.state[name] = this.coerceAttribute(name, this.getAttribute(name));
			}
		}

		this.unsubscribeState = subscribe(this.state, () => this.rerender());
		this.rerender();
	}

	/**
	 * Release the state subscription and the children.
	 *
	 * Document-level event listeners persist for the lifetime of the document
	 * and are not tied to any single instance.
	 *
	 * Called by the browser when the element disconnects from the DOM.
	 */
	disconnectedCallback(): void {
		if (this.unsubscribeState !== null) {
			this.unsubscribeState();
			this.unsubscribeState = null;
		}

		this.renderer = null;
		this.replaceChildren();
	}

	/**
	 * Write a coerced attribute into `state` and re-render.
	 *
	 * Called by the browser for every attribute listed in the subclass's
	 * `observedAttributes` array.
	 *
	 * @param name - The changed attribute name.
	 * @param _oldValue - The previous value, or null when newly set.
	 * @param newValue - The new value, or null when removed.
	 */
	attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
		this.state[name] = this.coerceAttribute(name, newValue);
		this.rerender();
	}

	/**
	 * Emit a message on the shared event bus.
	 *
	 * The message is delivered under the fully qualified name `<tag>:<name>`, so
	 * an emitter writes a short local name and classes never collide. Subscribers
	 * elsewhere use `on("<tag>:<name>", handler)`.
	 *
	 * @param name - The local message name, prefixed with the emitting tag.
	 * @param detail - Optional payload delivered on the message's `detail`.
	 */
	emit(name: string, detail?: unknown): void {
		const ctor = this.constructor as typeof TemplesComponent;

		dispatchMessage(`${ctor.tag}:${name}`, detail);
	}

	/**
	 * Subscribe to a message on the shared event bus.
	 *
	 * The name is fully qualified, e.g. `on("task-item:completed", handler)`.
	 * Messaging is loose: the handler is stored on the shared bus, not tied to
	 * the DOM, so any component may subscribe to any other class's messages.
	 *
	 * @param name - The fully qualified message name to listen for.
	 * @param handler - The handler invoked with the delivered `CustomEvent`.
	 * @returns An unsubscribe function that stops delivery.
	 */
	on(name: string, handler: MessageHandler): () => void {
		let set = messageHandlers.get(name);

		if (set === undefined) {
			set = new Set();
			messageHandlers.set(name, set);
		}

		const handlers = set;

		handlers.add(handler);

		return () => handlers.delete(handler);
	}

	/**
	 * Re-render every binding from the current state.
	 *
	 * The container is re-rendered and its children are adopted into the host.
	 * Keyed reconciliation reuses the same node objects across renders, so the
	 * adoption moves them without losing input focus or scroll position.
	 */
	private rerender(): void {
		if (this.renderer === null) return;

		const container = this.renderer.rootElt;

		while (this.firstChild !== null) container.appendChild(this.firstChild);

		this.renderer.render(this.state as TemplesData);

		while (container.firstChild !== null) this.appendChild(container.firstChild);
	}

	/**
	 * Coerce a raw attribute value according to its declared type.
	 *
	 * An untyped attribute writes a raw string. `boolean` maps `"false"` and
	 * `"0"` to `false`, `number` parses a number (falling back to the raw
	 * string), and `json` parses an object or array (falling back to the raw
	 * string). A removed attribute (`null`) yields the neutral value.
	 *
	 * @param name - The attribute name, used to look up its declared type.
	 * @param raw - The raw attribute value, or null when removed.
	 * @returns The coerced value written into `state`.
	 */
	private coerceAttribute(name: string, raw: string | null): unknown {
		const ctor = this.constructor as typeof TemplesComponent;
		const type = ctor.attributeTypes[name] ?? "string";

		switch (type) {
			case "boolean":
				return raw === null ? false : raw !== "false" && raw !== "0";
			case "number": {
				if (raw === null) return 0;

				const value = Number(raw);

				return Number.isNaN(value) ? raw : value;
			}
			case "json": {
				if (raw === null) return null;

				try {
					return JSON.parse(raw);
				} catch {
					return raw;
				}
			}
			default:
				return raw ?? "";
		}
	}
}
