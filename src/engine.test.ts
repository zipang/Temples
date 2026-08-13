import { describe, expect, test } from "bun:test";
import { evalProperty, Renderer, type TemplesData } from "./engine";

describe("evalProperty", () => {
	test("resolves a simple property", () => {
		expect(evalProperty("title", { title: "Hello" })).toBe("Hello");
	});

	test("resolves a dotted path", () => {
		expect(evalProperty("author.name", { author: { name: "Vince" } })).toBe("Vince");
	});

	test("calls a function value with the parent object as this", () => {
		const data = {
			author: {
				firstName: "Vince",
				lastName: "Voe",
				fullName() {
					return `${this.firstName} ${this.lastName}`;
				}
			}
		};

		expect(evalProperty("author.fullName", data)).toBe("Vince Voe");
	});

	test("returns empty string when the path does not resolve", () => {
		expect(evalProperty("article.missing", { article: { title: "x" } })).toBe("");
	});

	test("returns empty string when the root data has no such key", () => {
		expect(evalProperty("nope", {})).toBe("");
	});

	test("preserves the number zero instead of coercing it to empty string", () => {
		expect(evalProperty("count", { count: 0 })).toBe(0);
	});

	test("preserves the boolean false instead of coercing it to empty string", () => {
		expect(evalProperty("active", { active: false })).toBe(false);
	});

	test("returns empty string when a function value returns undefined", () => {
		const data = { fn: () => undefined } as unknown as TemplesData;

		expect(evalProperty("fn", data)).toBe("");
	});
});

describe("Renderer", () => {
	test("accepts an HTML string as the template source", () => {
		const renderer = new Renderer("<h1 data-bind='text=title'></h1>");

		renderer.render({ title: "Hello" });

		expect(renderer.root.textContent).toBe("Hello");
	});

	test("accepts a DOM element as the template source", () => {
		const el = document.createElement("p");
		el.setAttribute("data-bind", "text=greeting");
		el.textContent = "placeholder";

		const renderer = new Renderer(el);

		renderer.render({ greeting: "Hello" });

		expect(renderer.root.textContent).toBe("Hello");
	});

	test("text= binding sets text content and escapes HTML markup", () => {
		const renderer = new Renderer("<p data-bind='text=markup'></p>");

		renderer.render({ markup: "<b>bold</b>" });

		expect(renderer.root.textContent).toBe("<b>bold</b>");
		expect(renderer.root.querySelector("b")).toBeNull();
	});

	test("html= binding sets inner HTML and parses markup", () => {
		const renderer = new Renderer("<p data-bind='html=markup'></p>");

		renderer.render({ markup: "<b>bold</b>" });

		expect(renderer.root.innerHTML).toBe("<b>bold</b>");
		expect(renderer.root.querySelector("b")?.textContent).toBe("bold");
	});

	test("shorthand binding (no =) defaults to text semantics", () => {
		const renderer = new Renderer("<p data-bind='markup'></p>");

		renderer.render({ markup: "<b>bold</b>" });

		expect(renderer.root.textContent).toBe("<b>bold</b>");
		expect(renderer.root.querySelector("b")).toBeNull();
	});

	test("resolves a dotted path during render", () => {
		const renderer = new Renderer("<h1 data-bind='text=author.name'></h1>");

		renderer.render({ author: { name: "Vince" } });

		expect(renderer.root.textContent).toBe("Vince");
	});

	test("calls a function value during render with the parent as this", () => {
		const renderer = new Renderer("<h1 data-bind='text=author.fullName'></h1>");
		const data = {
			author: {
				firstName: "Vince",
				lastName: "Voe",
				fullName() {
					return `${this.firstName} ${this.lastName}`;
				}
			}
		};

		renderer.render(data);

		expect(renderer.root.textContent).toBe("Vince Voe");
	});

	test("a missing path clears the bound content", () => {
		const renderer = new Renderer("<h1 data-bind='text=missing'>initial</h1>");

		renderer.render({});

		expect(renderer.root.textContent).toBe("");
	});

	test("binds the root element itself when it carries data-bind", () => {
		const renderer = new Renderer("<h1 data-bind='text=title'>old</h1>");

		renderer.render({ title: "new" });

		expect(renderer.root.textContent).toBe("new");
	});

	test("binds multiple nested elements in one render", () => {
		const renderer = new Renderer(
			"<section><h1 data-bind='text=title'></h1><p data-bind='text=body'></p></section>"
		);

		renderer.render({ title: "T", body: "B" });

		expect(renderer.root.querySelector("h1")?.textContent).toBe("T");
		expect(renderer.root.querySelector("p")?.textContent).toBe("B");
	});

	test("removes the data-bind attribute after construction", () => {
		const renderer = new Renderer("<h1 data-bind='text=title'></h1>");

		expect(renderer.root.hasAttribute("data-bind")).toBe(false);
	});

	test("render returns the root element", () => {
		const renderer = new Renderer("<h1 data-bind='text=title'></h1>");

		expect(renderer.render({ title: "x" })).toBe(renderer.root);
	});

	test("render is re-runnable with different data", () => {
		const renderer = new Renderer("<h1 data-bind='text=title'></h1>");

		renderer.render({ title: "first" });
		expect(renderer.root.textContent).toBe("first");

		renderer.render({ title: "second" });
		expect(renderer.root.textContent).toBe("second");
	});

	test("HTML string and DOM element sources render identically", () => {
		const html =
			"<article><h1 data-bind='text=title'></h1><p data-bind='html=content'></p></article>";
		const data = { title: "Hello", content: "<b>World</b>" };

		const fromString = new Renderer(html);

		const host = document.createElement("div");
		host.innerHTML = html;
		const fromElement = new Renderer(host.firstElementChild ?? host);

		fromString.render(data);
		fromElement.render(data);

		expect(fromString.root.innerHTML).toBe(fromElement.root.innerHTML);
		expect(fromString.root.textContent).toBe(fromElement.root.textContent);
		expect(fromString.root.querySelector("b")?.textContent).toBe("World");
	});
});
