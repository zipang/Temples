import { afterAll, describe, expect, test } from "bun:test";
import jQuery from "jquery";

import { Renderer } from "./engine";

const originalDollar = (globalThis as Record<string, unknown>).$;
const originalJQuery = (globalThis as Record<string, unknown>).jQuery;

describe("temples/jquery plugin", () => {
	afterAll(() => {
		if (originalDollar === undefined) {
			delete (globalThis as Record<string, unknown>).$;
		} else {
			(globalThis as Record<string, unknown>).$ = originalDollar;
		}

		if (originalJQuery === undefined) {
			delete (globalThis as Record<string, unknown>).jQuery;
		} else {
			(globalThis as Record<string, unknown>).jQuery = originalJQuery;
		}
	});

	test("registers $.fn.temples when jQuery is present", async () => {
		(globalThis as Record<string, unknown>).$ = jQuery;
		(globalThis as Record<string, unknown>).jQuery = jQuery;

		await import("./jquery");

		expect(jQuery.fn.temples).toBeTypeOf("function");
	});

	test("$.fn.temples(data) renders data into each matched element", async () => {
		(globalThis as Record<string, unknown>).$ = jQuery;
		(globalThis as Record<string, unknown>).jQuery = jQuery;

		await import("./jquery");

		const host = document.createElement("div");
		host.innerHTML =
			"<ul class='list'><li data-bind='text=title'></li></ul><ul class='list'><li data-bind='text=title'></li></ul>";
		document.body.appendChild(host);

		jQuery(".list").temples({ title: "Hello" });

		const items = jQuery(".list li");

		expect(items.length).toBe(2);
		expect(items[0]?.textContent).toBe("Hello");
		expect(items[1]?.textContent).toBe("Hello");

		host.remove();
	});

	test("$.fn.temples() returns the prepared Renderer", async () => {
		(globalThis as Record<string, unknown>).$ = jQuery;
		(globalThis as Record<string, unknown>).jQuery = jQuery;

		await import("./jquery");

		const host = document.createElement("div");
		host.innerHTML = "<ul class='list'><li data-bind='text=title'></li></ul>";
		document.body.appendChild(host);

		const renderer = jQuery(".list").temples() as Renderer;

		expect(renderer).toBeInstanceOf(Renderer);

		host.remove();
	});

	test("throwing a clear error when jQuery is absent", async () => {
		delete (globalThis as Record<string, unknown>).$;
		delete (globalThis as Record<string, unknown>).jQuery;

		let error: Error | null = null;

		try {
			await import(`./jquery?missing=${Date.now()}`);
		} catch (caught) {
			error = caught as Error;
		}

		expect(error?.message).toContain("jQuery");
	});
});
