import { describe, expect, test } from "bun:test";
import { reactive, subscribe } from "./reactive";

describe("reactive", () => {
	test("returns a proxy that notifies on a nested property mutation", () => {
		const state = reactive({ user: { name: "Jane" } });
		let calls = 0;

		subscribe(state, () => {
			calls++;
		});

		state.user.name = "Jane Eyre";

		expect(calls).toBe(1);
	});

	test("notifies on an array push and on an array element write", () => {
		const state = reactive({ todos: ["buy milk"] });
		let calls = 0;

		subscribe(state, () => {
			calls++;
		});

		state.todos.push("walk dog");
		expect(calls).toBe(1);

		state.todos[0] = "buy eggs";
		expect(calls).toBe(2);
	});

	test("notifies on a direct top-level write", () => {
		const state = reactive({ title: "a" });
		let calls = 0;

		subscribe(state, () => {
			calls++;
		});

		state.title = "b";

		expect(calls).toBe(1);
	});

	test("unsubscribe stops the subscriber from firing", () => {
		const state = reactive({ count: 0 });
		let calls = 0;

		const unsubscribe = subscribe(state, () => {
			calls++;
		});

		state.count = 1;
		expect(calls).toBe(1);

		unsubscribe();

		state.count = 2;

		expect(calls).toBe(1);
	});

	test("a deep replacement object is observed through the parent", () => {
		const state = reactive({ user: { name: "Jane" } });
		let calls = 0;

		subscribe(state, () => {
			calls++;
		});

		state.user = { name: "Jack" };
		expect(calls).toBe(1);

		state.user.name = "John";

		expect(calls).toBe(2);
	});

	test("a subscriber on a nested proxy is independent of the root", () => {
		const state = reactive({ user: { name: "Jane" } });
		const nested = state.user;
		let nestedCalls = 0;

		subscribe(nested, () => {
			nestedCalls++;
		});

		nested.name = "Jane Eyre";

		expect(nestedCalls).toBe(1);
	});
});
