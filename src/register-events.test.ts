import { describe, expect, test } from "bun:test";
import { registerEvents } from "./register-events";

describe("registerEvents", () => {
	test("attaches one listener per eventType selector entry", () => {
		const host = document.createElement("section");
		const button = document.createElement("button");
		button.className = "btn";
		host.appendChild(button);

		let clicks = 0;
		const cleanup = registerEvents(host, { "click .btn": () => clicks++ });

		button.dispatchEvent(new Event("click", { bubbles: true }));

		expect(clicks).toBe(1);
		cleanup();
	});

	test("passes the host to the handler", () => {
		const host = document.createElement("section");
		const link = document.createElement("a");
		link.className = "nav";
		host.appendChild(link);

		const capture: { host: HTMLElement | null } = { host: null };
		const cleanup = registerEvents(host, { "click .nav": (h) => (capture.host = h) });

		link.dispatchEvent(new Event("click", { bubbles: true }));

		expect(capture.host).toBe(host);
		cleanup();
	});

	test("ignores events that do not match the selector", () => {
		const host = document.createElement("section");
		const button = document.createElement("button");
		button.className = "other";
		host.appendChild(button);

		let clicks = 0;
		const cleanup = registerEvents(host, { "click .btn": () => clicks++ });

		button.dispatchEvent(new Event("click", { bubbles: true }));

		expect(clicks).toBe(0);
		cleanup();
	});

	test("handles nested targets inside the matched selector", () => {
		const host = document.createElement("section");
		const button = document.createElement("button");
		button.className = "btn";
		const label = document.createElement("span");
		button.appendChild(label);
		host.appendChild(button);

		let clicks = 0;
		const cleanup = registerEvents(host, { "click .btn": () => clicks++ });

		label.dispatchEvent(new Event("click", { bubbles: true }));

		expect(clicks).toBe(1);
		cleanup();
	});

	test("returns a cleanup function that removes the listeners", () => {
		const host = document.createElement("section");
		const button = document.createElement("button");
		button.className = "btn";
		host.appendChild(button);

		let clicks = 0;
		const cleanup = registerEvents(host, { "click .btn": () => clicks++ });

		button.dispatchEvent(new Event("click", { bubbles: true }));
		expect(clicks).toBe(1);

		cleanup();
		button.dispatchEvent(new Event("click", { bubbles: true }));

		expect(clicks).toBe(1);
	});
});
