import { Renderer, type TemplesData } from "./engine";
/**
 * Augment the jQuery object so `.temples()` is typed on every collection.
 */
declare global {
    interface JQuery<TElement = HTMLElement> {
        temples(data?: TemplesData): JQuery | Renderer;
    }
}
