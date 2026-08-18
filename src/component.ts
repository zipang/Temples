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
 * Handler invoked by an event binding.
 *
 * A handler is a component method that receives the event — either a DOM event
 * (`"eventType selector"` binding) or a `CustomEvent` carrying a message
 * (`"tag:name"` binding). It runs with `this` bound to the component instance,
 * so handlers can read `this.state` and call other component methods directly.
 */
export type EventHandler = (this: TemplesComponent, event: Event) => void;

/**
 * Declarative map of event bindings.
 *
 * Each key maps to the name of a handler method on the component class. A key
 * with a space is a DOM binding, `"eventType selector"` (e.g.
 * `"click .add-btn"`), run when an event of that type bubbles from an element
 * matching the selector. A key without a space is an inter-component message
 * name, `"tag:name"` (e.g. `"shopping-item:updated"`), delivered by the shared
 * event bus. Both are handled by the same method-name lookup.
 */
export type EventMap = Record<string, string>;

/**
 * Options passed to `TemplesComponent.define(tagName, componentClass, options)`.
 *
 * The template is required: a component cannot exist without markup. The other
 * options are optional and are copied onto the component class's static fields
 * so server-side rendering can read them.
 */
export interface DefineOptions {
	/**
	 * The HTML template string, parsed once by `define()`.
	 */
	template: string;

	/**
	 * Optional declarative event map, mapping a binding to a handler method name.
	 */
	events?: EventMap;

	/**
	 * The component stylesheet, concatenated into the SSR output by `prepare()`.
	 */
	css?: string;

	/**
	 * The global data store shared by every component. It seeds observed
	 * attributes that are absent on the tag.
	 */
	globalStore?: TemplesData;
}

/**
 * A message subscription, tying a handler method to the component that owns it.
 *
 * The bus stores the component and the resolved handler so delivery can invoke
 * the handler with `this` bound to the owning component.
 */
interface MessageSubscription {
	component: TemplesComponent;
	handler: EventHandler;
}

/**
 * Document-level listeners, one per event type, shared by every component.
 *
 * The listener resolves the closest `TemplesComponent` ancestor of the event
 * target and dispatches to that component's own `eventHandlers` map, so a single
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
const messageHandlers = new Map<string, Set<MessageSubscription>>();

/**
 * Deliver a message to every subscribed handler.
 *
 * A snapshot of the handler set is iterated so a handler that unsubscribes
 * during dispatch does not affect the current delivery. Each handler runs with
 * `this` bound to its owning component.
 *
 * @param type - The fully qualified message name.
 * @param detail - The payload delivered on the message's `detail` property.
 */
const dispatchMessage = (type: string, detail: unknown): void => {
	const subscriptions = messageHandlers.get(type);

	if (subscriptions === undefined) return;

	const event = new CustomEvent(type, { detail });

	for (const { component, handler } of [...subscriptions]) handler.call(component, event);
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
	 * The component stylesheet, concatenated into the SSR output by `prepare()`.
	 *
	 * Fed by bun's CSS bundling (`import stylesheet from "./component.css"`) in
	 * the browser path, or assigned directly. `prepare()` reads it to build one
	 * `<style>` tag for every used component.
	 */
	static css = "";

	/**
	 * Optional declarative event map, mapping a binding to a handler method name.
	 *
	 * A binding is either `"eventType selector"` (DOM event) or `"tag:name"`
	 * (inter-component message). Handlers are methods on the component class,
	 * run with `this` bound to the component instance.
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
	 * The global data store shared by every component.
	 *
	 * Set through `define({ globalStore })`. A component consults it on mount as
	 * a fallback for its observed attributes: an explicit attribute on the tag
	 * wins, and the store key of the same name is used only when the attribute
	 * is absent.
	 */
	static globalStore: TemplesData | undefined;

	/**
	 * Reactive component state.
	 *
	 * Subclasses assign an initial `reactive({ ... })` value. Mutations to this
	 * object re-render the component automatically.
	 */
	declare state: Record<string, unknown>;

	private renderer: Renderer | null = null;
	private unsubscribeState: (() => void) | null = null;

	/**
	 * The instance's active event bindings, mapping a binding to its resolved
	 * handler method. Seeded from the class `events` map on connection and
	 * extended by dynamic `on()` calls.
	 */
	private eventHandlers: Record<string, EventHandler> = {};

	/**
	 * Unsubscribe functions for the message subscriptions made by this instance.
	 */
	private messageUnsubscribers: (() => void)[] = [];

	constructor() {
		super();
		this.state = reactive({});
	}

	/**
	 * Register the custom element from the subclass's static fields.
	 *
	 * The subclass declares `tag`, `template`, `events`, `css`,
	 * `observedAttributes`, and `attributeTypes` as static fields. This form
	 * keeps those fields as the single source of truth and stays available for
	 * backward compatibility.
	 *
	 * @param options - Optional `globalStore` data dictionary shared by every
	 * component. It seeds observed attributes that are absent on the tag.
	 */
	static define(options?: { globalStore?: TemplesData }): void;

	/**
	 * Register the custom element with an explicit tag, class, and options.
	 *
	 * This is the canonical way to declare a component: the class carries its
	 * `observedAttributes`, `attributeTypes`, `state`, and `events`, while the
	 * tag name, template, and stylesheet are passed here. The options are copied
	 * onto the class's static fields so server-side rendering can read them.
	 *
	 * @param tagName - The custom element tag name (must contain a hyphen).
	 * @param componentClass - The class extending `TemplesComponent`.
	 * @param options - The template (required) and optional events, css, and
	 * global store.
	 */
	static define(
		tagName: string,
		componentClass: typeof TemplesComponent,
		options: DefineOptions
	): void;

	static define(
		tagNameOrOptions?: string | { globalStore?: TemplesData },
		componentClass?: typeof TemplesComponent,
		options?: DefineOptions
	): void {
		// biome-ignore lint/complexity/noThisInStatic: `this` is the subclass constructor in the backward-compatible form.
		const self = this as typeof TemplesComponent;

		const ctor =
			typeof tagNameOrOptions === "string" ? (componentClass as typeof TemplesComponent) : self;

		if (typeof tagNameOrOptions === "string") {
			ctor.tag = tagNameOrOptions;
			ctor.template = options?.template ?? "";

			if (options?.events !== undefined) {
				ctor.events = options.events;
			}

			ctor.css = options?.css ?? "";

			if (options?.globalStore !== undefined) {
				TemplesComponent.globalStore = options.globalStore;
			}
		} else if (tagNameOrOptions?.globalStore !== undefined) {
			TemplesComponent.globalStore = tagNameOrOptions.globalStore;
		}

		TemplesComponent.resolveTemplate(ctor);
		TemplesComponent.registerEventTypes(ctor);
		customElements.define(ctor.tag, ctor);
	}

	/**
	 * Register one document listener per DOM event type declared in the class map.
	 *
	 * Listeners are deduplicated by event type across all component classes, so
	 * a click handler is attached to the document exactly once no matter how
	 * many classes or instances use it. Message bindings (no selector) need no
	 * document listener.
	 *
	 * @param ctor - The component class whose `events` map to register.
	 */
	private static registerEventTypes(ctor: typeof TemplesComponent): void {
		for (const binding of Object.keys(ctor.events)) {
			const space = binding.indexOf(" ");

			if (space === -1) continue;

			TemplesComponent.ensureDocumentListener(binding.slice(0, space));
		}
	}

	/**
	 * Attach a document listener for an event type, deduplicated by type.
	 *
	 * The listener resolves the closest component of the event target and
	 * dispatches to its instance `eventHandlers` map.
	 *
	 * @param type - The event type to listen for.
	 */
	private static ensureDocumentListener(type: string): void {
		if (documentListeners.has(type)) return;

		const listener = (event: Event): void => TemplesComponent.dispatch(type, event);

		document.addEventListener(type, listener);
		documentListeners.set(type, listener);
	}

	/**
	 * Handle a document-level event for one event type.
	 *
	 * The closest `TemplesComponent` ancestor of the event target owns the
	 * event: only its instance `eventHandlers` map is consulted, and a missing
	 * selector match there leaves outer components untouched. The matched
	 * handler runs with `this` bound to the owning component.
	 *
	 * @param type - The event type this listener was registered for.
	 * @param event - The event that bubbled to the document.
	 */
	private static dispatch(type: string, event: Event): void {
		const component = TemplesComponent.resolveComponent(event);

		if (component === null) return;

		for (const [binding, handler] of Object.entries(component.eventHandlers)) {
			const separator = binding.indexOf(" ");
			const bindingType = binding.slice(0, separator);

			if (bindingType !== type) continue;

			const selector = binding.slice(separator + 1).trim();

			if (TemplesComponent.matchesSelector(event, selector, component)) {
				handler.call(component, event);
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
			} else if (
				TemplesComponent.globalStore !== undefined &&
				name in TemplesComponent.globalStore
			) {
				this.state[name] = TemplesComponent.globalStore[name];
			}
		}

		this.unsubscribeState = subscribe(this.state, () => this.rerender());
		this.rerender();

		this.on(ctor.events);
	}

	/**
	 * Release the state subscription, the event bindings, and the children.
	 *
	 * Message subscriptions are unsubscribed so a removed component stops
	 * receiving inter-component messages. Document-level event listeners
	 * persist for the lifetime of the document and are not tied to any single
	 * instance.
	 *
	 * Called by the browser when the element disconnects from the DOM.
	 */
	disconnectedCallback(): void {
		if (this.unsubscribeState !== null) {
			this.unsubscribeState();
			this.unsubscribeState = null;
		}

		for (const unsubscribe of this.messageUnsubscribers) unsubscribe();
		this.messageUnsubscribers = [];
		this.eventHandlers = {};

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
	 * elsewhere register `"<tag>:<name>"` in their `events` map.
	 *
	 * @param name - The local message name, prefixed with the emitting tag.
	 * @param detail - Optional payload delivered on the message's `detail`.
	 */
	emit(name: string, detail?: unknown): void {
		const ctor = this.constructor as typeof TemplesComponent;

		dispatchMessage(`${ctor.tag}:${name}`, detail);
	}

	/**
	 * Register a map of event bindings on this instance.
	 *
	 * Each binding maps to a handler method name. A binding with a space is a
	 * DOM event, `"eventType selector"`, delivered by a shared document
	 * listener; a binding without a space is an inter-component message,
	 * `"tag:name"`, delivered by the shared event bus. In both cases the handler
	 * runs with `this` bound to this component.
	 *
	 * The class `events` map is registered automatically on connection; this
	 * method also lets a component add bindings at runtime.
	 *
	 * @param events - The event bindings to register, `binding: methodName`.
	 */
	on(events: EventMap): void {
		for (const [binding, methodName] of Object.entries(events)) {
			const handler = this.resolveHandler(methodName);
			const space = binding.indexOf(" ");

			if (space === -1) {
				this.subscribeMessage(binding, handler);
			} else {
				this.eventHandlers[binding] = handler;
				TemplesComponent.ensureDocumentListener(binding.slice(0, space));
			}
		}
	}

	/**
	 * Resolve a handler method name to the method on this component.
	 *
	 * The method is looked up by name so handlers are declared as ordinary class
	 * methods and run with `this` bound to the component instance.
	 *
	 * @param methodName - The handler method name from an event binding.
	 * @returns The handler method.
	 */
	private resolveHandler(methodName: string): EventHandler {
		const method = (this as unknown as Record<string, EventHandler>)[methodName];

		if (typeof method !== "function") {
			throw new Error(`Event handler "${methodName}" is not a method of <${this.tagName}>`);
		}

		return method;
	}

	/**
	 * Subscribe this component to a message on the shared event bus.
	 *
	 * The subscription is stored with the owning component so delivery runs the
	 * handler with `this` bound to it. The unsubscribe function is retained so
	 * `disconnectedCallback` can release every subscription of the instance.
	 *
	 * @param name - The fully qualified message name to listen for.
	 * @param handler - The handler method invoked with the delivered `CustomEvent`.
	 */
	private subscribeMessage(name: string, handler: EventHandler): void {
		let set = messageHandlers.get(name);

		if (set === undefined) {
			set = new Set();
			messageHandlers.set(name, set);
		}

		const subscription: MessageSubscription = { component: this, handler };

		set.add(subscription);

		this.messageUnsubscribers.push(() => {
			set.delete(subscription);
		});
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
