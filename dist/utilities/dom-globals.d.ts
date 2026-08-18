/**
 * The DOM globals that a linkedom window exposes.
 *
 * `parseHTML` returns these as non-own properties. The engine and
 * `TemplesComponent` (whose class extends `HTMLElement`) need them on
 * `globalThis` to evaluate against a real DOM. The list is shared by the SSR
 * entry and the test environment setup.
 */
export declare const DOM_GLOBALS: readonly [
	"window",
	"document",
	"Document",
	"DocumentFragment",
	"Element",
	"HTMLElement",
	"Node",
	"DOMParser",
	"customElements",
	"CustomElementRegistry",
	"Event",
	"CustomEvent",
	"MutationObserver",
	"ShadowRoot"
];
/**
 * Extract the values of the DOM globals from a linkedom window.
 *
 * Missing keys stay `undefined` and are skipped by `installGlobals`, so a
 * window that lacks a key leaves the current global untouched.
 *
 * @param source - The linkedom parse result, e.g. from `parseHTML`.
 * @param keys - The global keys to extract; defaults to `DOM_GLOBALS`.
 * @returns A dictionary of global names to their window values.
 */
export declare const extractDomGlobals: (
	source: Record<string, unknown>,
	keys?: readonly string[]
) => Record<string, unknown>;
/**
 * Install a dictionary of values onto `globalThis`.
 *
 * Undefined values are skipped, so an absent key leaves the current global
 * untouched.
 *
 * @param values - Global names to their new values.
 * @returns The previous values, for `restoreGlobals`.
 */
export declare const installGlobals: (values: Record<string, unknown>) => Map<string, unknown>;
/**
 * Restore global values captured by `installGlobals`.
 *
 * A key that had no previous value is deleted, so it returns to the absent
 * state. Every other key is written back to its previous value.
 *
 * @param previous - The map returned by `installGlobals`.
 */
export declare const restoreGlobals: (previous: Map<string, unknown>) => void;
