import { describe, expect, test } from "bun:test";
import { TemplesComponent } from "./component";
import { reactive } from "./reactive";
import { prepare } from "./ssr";

describe("prepare", () => {
	test("returns an async render function that produces an HTML string", async () => {
		const render = prepare("<h1 data-bind='text=title'>old</h1>");

		expect(await render({ title: "Hello" })).toBe("<h1>Hello</h1>");
	});

	test("throws on a source with multiple root elements", () => {
		expect(() => prepare("<h1>a</h1><h1>b</h1>")).toThrow();
	});

	test("each render call is independent (no state leak)", async () => {
		const render = prepare("<p data-bind='text=value'></p>");

		expect(await render({ value: "first" })).toBe("<p>first</p>");
		expect(await render({ value: "second" })).toBe("<p>second</p>");
	});

	test("renders a whole HTML document and preserves the doctype", async () => {
		const render = prepare(
			"<!doctype html><html><head><title>T</title></head><body><h1 data-bind='text=title'>old</h1></body></html>"
		);

		const html = await render({ title: "Hello" });

		expect(html).toBe(
			"<!DOCTYPE html><html><head><title>T</title></head><body><h1>Hello</h1></body></html>"
		);
	});
});

describe("prepare webComponents", () => {
	test("renders a custom tag to its template and concatenates css", async () => {
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

		const html = await render({ name: "World" });

		expect(html).toContain("<p>World</p>");
		expect(html).toContain("<style>p { color: red; }</style>");
	});

	test("renders a full page with a custom tag and injects css into the head", async () => {
		class Greeter extends TemplesComponent {
			static override tag = "ssr-greet-page";
			static override template = "<p data-bind='text=name'>?</p>";
			static override observedAttributes = ["name"];
			static override css = "p { color: red; }";
			override state = reactive({ name: "" });
		}

		const render = prepare(
			"<!doctype html><html><head><title>Page</title></head><body><ssr-greet-page></ssr-greet-page></body></html>",
			{ webComponents: [Greeter] }
		);

		const html = await render({ name: "World" });

		expect(html).toContain("<p>World</p>");
		expect(html).toContain("<title>Page</title>");
		expect(html).toContain("<style>p { color: red; }</style>");
	});

	test("removeDataBinding unwraps component tags to plain markup", async () => {
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

		const html = await render({ name: "World" });

		expect(html).toBe("<div><p>World</p></div>");
	});
});
