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

describe("Renderer data-bind typed bindings (T3)", () => {
	test("binds multiple attributes from a comma-separated data-bind", () => {
		const renderer = new Renderer("<img data-bind='src=user.avatar, title=user.fullname' />");

		renderer.render({ user: { avatar: "http://avatar.com/john", fullname: "John DOE" } });

		expect(renderer.root.getAttribute("src")).toBe("http://avatar.com/john");
		expect(renderer.root.getAttribute("title")).toBe("John DOE");
	});

	test("value= binding sets the input value", () => {
		const renderer = new Renderer("<input data-bind='value=user.name' />");

		renderer.render({ user: { name: "Jane" } });

		expect((renderer.root as HTMLInputElement).value).toBe("Jane");
	});

	test("supports text and attribute bindings on one element", () => {
		const renderer = new Renderer("<a data-bind='text=link.label, href=link.url'>placeholder</a>");

		renderer.render({ link: { label: "Read more", url: "https://example.com" } });

		expect(renderer.root.textContent).toBe("Read more");
		expect(renderer.root.getAttribute("href")).toBe("https://example.com");
	});

	test("class[range]=path toggles one class value and preserves the others", () => {
		const renderer = new Renderer(
			"<div class='row container' data-bind='class[article|quote|tweet]=article.type'></div>"
		);

		renderer.render({ article: { type: "quote" } });

		expect(renderer.root.classList.contains("quote")).toBe(true);
		expect(renderer.root.classList.contains("article")).toBe(false);
		expect(renderer.root.classList.contains("tweet")).toBe(false);
		expect(renderer.root.classList.contains("row")).toBe(true);
		expect(renderer.root.classList.contains("container")).toBe(true);
	});

	test("class toggle reacts to a second data set", () => {
		const renderer = new Renderer(
			"<div class='row' data-bind='class[article|quote|tweet]=article.type'></div>"
		);

		renderer.render({ article: { type: "tweet" } });
		expect(renderer.root.classList.contains("tweet")).toBe(true);

		renderer.render({ article: { type: "article" } });
		expect(renderer.root.classList.contains("article")).toBe(true);
		expect(renderer.root.classList.contains("tweet")).toBe(false);
	});

	test("class toggle removes the range classes when the value is out of range", () => {
		const renderer = new Renderer(
			"<div class='row active' data-bind='class[article|quote|tweet]=article.type'></div>"
		);

		renderer.render({ article: { type: "featured" } });

		expect(renderer.root.classList.contains("article")).toBe(false);
		expect(renderer.root.classList.contains("quote")).toBe(false);
		expect(renderer.root.classList.contains("tweet")).toBe(false);
		expect(renderer.root.classList.contains("row")).toBe(true);
		expect(renderer.root.classList.contains("active")).toBe(true);
	});

	test("shorthand binding on an input defaults to value", () => {
		const renderer = new Renderer("<input data-bind='user.name' />");

		renderer.render({ user: { name: "Jane" } });

		expect((renderer.root as HTMLInputElement).value).toBe("Jane");
	});

	test("shorthand binding on a textarea defaults to value", () => {
		const renderer = new Renderer("<textarea data-bind='user.bio'></textarea>");

		renderer.render({ user: { bio: "A short bio" } });

		expect((renderer.root as HTMLTextAreaElement).value).toBe("A short bio");
	});
});
