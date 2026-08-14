import { describe, expect, test } from "bun:test";
import { Renderer } from "./ssr";

describe("SSR entry", () => {
	test("installs a linkedom-backed document and renders from an HTML string", () => {
		const renderer = new Renderer("<h1 data-bind='text=title'>old</h1>");

		renderer.render({ title: "Hello" });

		expect(renderer.renderToString()).toBe("<h1>Hello</h1>");
	});

	test("serializes rendered bindings with control attributes removed", () => {
		const renderer = new Renderer(
			"<article><h1 data-bind='text=article.title'></h1><p data-bind='text=article.body'>body</p></article>"
		);

		renderer.render({ article: { title: "The Great Race", body: "Ready" } });

		expect(renderer.renderToString()).toBe(
			"<article><h1>The Great Race</h1><p>Ready</p></article>"
		);
	});

	test("round-trips entities inside bound text", () => {
		const renderer = new Renderer("<p data-bind='text=quote'></p>");

		renderer.render({ quote: 'He said "hi" & waved <bye>' });

		expect(renderer.renderToString()).toBe('<p>He said "hi" &amp; waved &lt;bye&gt;</p>');
	});

	test("serializes void elements in the template", () => {
		const renderer = new Renderer(
			"<div><img data-bind='src=image.src' alt='avatar' /><hr /></div>"
		);

		renderer.render({ image: { src: "http://avatar.com/me.png" } });

		expect(renderer.renderToString()).toBe(
			'<div><img src="http://avatar.com/me.png" alt="avatar"><hr></div>'
		);
	});

	test("the ssr entry re-exports the Renderer class", () => {
		expect(Renderer).toBeInstanceOf(Function);
	});
});
