/**
 * Event handler invoked by a registered event.
 *
 * The handler receives the host element that owns the event map, so it can
 * reach the component's internal `update()` and `render()` methods.
 */
export type EventHandler = (host: HTMLElement) => void;

/**
 * Declarative map of event bindings.
 *
 * Each key has the form `"eventType selector"`, e.g. `"click .flip-btn"`, and
 * maps to the handler run when an event of that type bubbles from an element
 * matching the selector.
 */
export type EventMap = Record<string, EventHandler>;

/**
 * Register delegated event listeners on a host element.
 *
 * Each `"eventType selector"` entry attaches one listener on the host. When an
 * event bubbles from an element matching the selector, the handler is called
 * with the host. Matching uses `closest`, so the target may be nested inside
 * the matched element.
 *
 * @param host - The element that owns the event map.
 * @param eventMap - Map of `"eventType selector"` entries to handlers.
 * @returns A cleanup function that removes every registered listener.
 */
export const registerEvents = (host: HTMLElement, eventMap: EventMap): (() => void) => {
	const removeAll: Array<() => void> = [];

	for (const [binding, handler] of Object.entries(eventMap)) {
		const separator = binding.indexOf(" ");
		const type = binding.slice(0, separator);
		const selector = binding.slice(separator + 1).trim();

		const listener = (event: Event): void => {
			const target = event.target;

			if (target instanceof Element && target.closest(selector) !== null) {
				handler(host);
			}
		};

		host.addEventListener(type, listener);
		removeAll.push(() => host.removeEventListener(type, listener));
	}

	return () => {
		for (const remove of removeAll) remove();
	};
};
