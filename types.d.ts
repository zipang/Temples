/**
 * Ambient declarations for Bun's asset imports.
 *
 * `*.html` files are imported as text (templates) with
 * `import template from "./x.html" with { type: "text" }`. `*.css` files are
 * imported for their side effect (Bun injects the stylesheet into the page).
 */

declare module "*.html" {
	var text: string;
	export = text;
}

declare module "*.css";
