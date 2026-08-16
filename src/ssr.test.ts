import { describe, expect, test } from "bun:test";
import { TemplesComponent } from "./component";
import { reactive } from "./reactive";
import { prepare, Renderer } from "./ssr";

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

describe("prepare", () => {
	test("returns a render function that produces an HTML string", () => {
		const render = prepare("<h1 data-bind='text=title'>old</h1>");

		expect(render({ title: "Hello" })).toBe("<h1>Hello</h1>");
	});

	test("throws on a source with multiple root elements", () => {
		expect(() => prepare("<h1>a</h1><h1>b</h1>")).toThrow();
	});

	test("each render call is independent (no state leak)", () => {
		const render = prepare("<p data-bind='text=value'></p>");

		expect(render({ value: "first" })).toBe("<p>first</p>");
		expect(render({ value: "second" })).toBe("<p>second</p>");
		expect(render({})).toBe("<p></p>");
	});
});

describe("prepare webComponents", () => {
	test("renders a custom tag to its template and concatenates css", () => {
		class Greeter extends TemplesComponent {
			static override tag = "ssr-greeter";
			static override template = "<p data-bind='text=name'>?</p>";
			static override observedAttributes = ["name"];
			static override css = "p { color: red; }";
			override state = reactive({ name: "" });
		}

		const render = prepare("<div><ssr-greeter></ssr-greeter></div>", {
			webComponents: [Greeter]
		});

		const html = render({ name: "World" });

		expect(html).toContain("<p>World</p>");
		expect(html).toContain("<style>p { color: red; }</style>");
	});

	test("removeDataBinding unwraps component tags to plain markup", () => {
		class Greeter extends TemplesComponent {
			static override tag = "ssr-rdb";
			static override template = "<p data-bind='text=name'>?</p>";
			static override observedAttributes = ["name"];
			override state = reactive({ name: "" });
		}

		const render = prepare("<div><ssr-rdb></ssr-rdb></div>", {
			webComponents: [Greeter],
			removeDataBinding: true
		});

		const html = render({ name: "World" });

		expect(html).toBe("<div><p>World</p></div>");
	});
});
