import { describe, expect, test } from "bun:test";
import { getProperty, hasProperty, setProperty, splitPath } from "./properties";

describe("splitPath", () => {
	test("splits a dotted path", () => {
		expect(splitPath("article.author.name")).toEqual(["article", "author", "name"]);
	});

	test("splits an array index notation", () => {
		expect(splitPath("persons[0]")).toEqual(["persons", "0"]);
	});

	test("splits a mixed dotted and indexed path", () => {
		expect(splitPath("persons[0].address.street")).toEqual(["persons", "0", "address", "street"]);
	});

	test("returns an empty array for an empty path", () => {
		expect(splitPath("")).toEqual([]);
	});

	test("filters out empty segments from repeated separators", () => {
		expect(splitPath("a..b")).toEqual(["a", "b"]);
	});
});

describe("getProperty", () => {
	test("reads a simple property", () => {
		expect(getProperty({ title: "Hello" }, "title", "")).toBe("Hello");
	});

	test("reads a nested property", () => {
		expect(getProperty({ article: { title: "Hi" } }, "article.title", "")).toBe("Hi");
	});

	test("reads an array element by index", () => {
		expect(
			getProperty({ persons: [{ name: "Ann" }, { name: "Bob" }] }, "persons[1].name", "")
		).toBe("Bob");
	});

	test("reads a deep path crossing arrays and objects", () => {
		const data = { blog: { articles: [{ title: "One" }, { title: "Two" }] } };

		expect(getProperty(data, "blog.articles[1].title", "")).toBe("Two");
	});

	test("returns the default value when the path is missing", () => {
		expect(getProperty({ article: {} }, "article.title", "fallback")).toBe("fallback");
	});

	test("returns the default value when an intermediate step is null", () => {
		expect(getProperty({ article: null }, "article.title", "fallback")).toBe("fallback");
	});

	test("preserves the number zero", () => {
		expect(getProperty({ count: 0 }, "count", 1)).toBe(0);
	});

	test("preserves the boolean false", () => {
		expect(getProperty({ active: false }, "active", true)).toBe(false);
	});

	test("returns undefined when the path is missing and no default is given", () => {
		expect(getProperty({ article: { title: "x" } }, "article.author.fullName")).toBeUndefined();
	});

	test("calls a function value with its parent object as this", () => {
		const data = {
			person: {
				firstName: "John",
				lastName: "DOE",
				fullName() {
					return `${this.firstName} ${this.lastName}`;
				}
			}
		};

		expect(getProperty(data, "person.fullName", "")).toBe("John DOE");
	});
});

describe("setProperty", () => {
	test("sets a simple property", () => {
		const data: Record<string, unknown> = {};

		setProperty(data, "title", "Hello");

		expect(data.title).toBe("Hello");
	});

	test("creates nested objects along the path", () => {
		const data: Record<string, unknown> = {};

		setProperty(data, "article.author.name", "Vince");

		expect(data).toEqual({ article: { author: { name: "Vince" } } });
	});

	test("creates an array sized to the target index", () => {
		const data: Record<string, unknown> = {};

		setProperty(data, "persons[2]", "C");

		expect(data).toEqual({ persons: [undefined, undefined, "C"] });
	});

	test("creates an array at an intermediate step when the next key is an index", () => {
		const data: Record<string, unknown> = {};

		setProperty(data, "persons[0].name", "Ann");

		expect(data).toEqual({ persons: [{ name: "Ann" }] });
	});

	test("overwrites an existing property", () => {
		const data: Record<string, unknown> = { title: "Old" };

		setProperty(data, "title", "New");

		expect(data.title).toBe("New");
	});

	test("returns the source object", () => {
		const data: Record<string, unknown> = {};

		expect(setProperty(data, "title", "x")).toBe(data);
	});

	test("treats a non-canonical numeric key as an object key, not an array index", () => {
		const data: Record<string, unknown> = {};

		setProperty(data, "persons[1abc]", "x");

		expect(data).toEqual({ persons: { "1abc": "x" } });
	});

	test("treats a negative key as an object key, not an array index", () => {
		const data: Record<string, unknown> = {};

		setProperty(data, "persons[-1]", "x");

		expect(data).toEqual({ persons: { "-1": "x" } });
	});
});

describe("hasProperty", () => {
	test("returns true for a present simple path", () => {
		expect(hasProperty({ title: "Hello" }, "title")).toBe(true);
	});

	test("returns true for a present nested path", () => {
		expect(hasProperty({ article: { title: "Hi" } }, "article.title")).toBe(true);
	});

	test("returns true when the value is null", () => {
		expect(hasProperty({ title: null }, "title")).toBe(true);
	});

	test("returns true when the value is undefined", () => {
		expect(hasProperty({ title: undefined }, "title")).toBe(true);
	});

	test("returns false for an absent path", () => {
		expect(hasProperty({ article: {} }, "article.title")).toBe(false);
	});

	test("returns false for an empty path", () => {
		expect(hasProperty({ title: "x" }, "")).toBe(false);
	});

	test("returns false when an intermediate step is null", () => {
		expect(hasProperty({ article: null }, "article.title")).toBe(false);
	});
});
