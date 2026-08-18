import type { TemplesComponent } from "./component";
import type { TemplesData } from "./engine";
/**
 * Options that reconfigure how `prepare` renders a template.
 */
export interface PrepareOptions {
    /**
     * Include the TemplesComponent library in the output so custom elements
     * rehydrate (mount and activate) in the browser.
     */
    rehydrate?: boolean;
    /**
     * Remove every Temples trace from the output: all `data-*` binding
     * attributes and every used component, rendered to plain static markup.
     */
    removeDataBindings?: boolean;
    /**
     * The `TemplesComponent` classes used by the template. `prepare` registers
     * each class so its custom tag renders through the component engine.
     */
    templesComponents?: (typeof TemplesComponent)[];
}
/**
 * A prepared render function:
 * renders data through the Temples data binding engine with support of TemplesComponents
 * @returns HTML string.
 */
export type RenderFunction = (data: TemplesData) => Promise<string>;
export type PrepareFunction = (source: string, options?: PrepareOptions) => RenderFunction;
/**
 * Prepare a template source into a reusable render function.
 *
 * `prepare` is string-only. The source is either a whole HTML document (its
 * root is `<html>`) or a single node (a fragment with one root element). Both
 * are handled: a whole document serializes with its doctype, while a single
 * node serializes as that node.
 *
 * Each `render(data)` call re-parses the source with linkedom and installs the
 * resulting DOM on `globalThis`, then restores the previous globals before
 * returning. Re-parsing keeps renders independent: the same prepared template
 * can be rendered many times with different data, with no state leak between
 * calls and no repeated custom-element registration.
 *
 * The render call is async: it loads the `Renderer` (and, only when
 * `templesComponents` are declared, `TemplesComponent`) with `await import()`
 * after the DOM globals exist.
 *
 * @param source - HTML string: a whole document or a single root node.
 * @param options - Rendering options; all flags are optional.
 * @returns An async render function producing an HTML string per data dictionary.
 */
export declare const prepare: PrepareFunction;
