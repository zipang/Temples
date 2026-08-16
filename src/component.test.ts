import { describe, expect, test } from "bun:test";
import { TemplesComponent } from "./component";
import { reactive } from "./reactive";

describe("TemplesComponent.define", () => {
	test("defines a custom element from static tag and template", () => {
		class Greeter extends TemplesComponent {
			static tag = "greeter-card";
			static template = "<p data-bind='text=title'>Hello</p>";
		}

		Greeter.define();

		const elt = document.createElement("greeter-card") as Greeter;

		expect(elt).toBeInstanceOf(Greeter);
		expect(customElements.get("greeter-card")).toBe(Greeter);
	});

	test("inserts a template keyed by tag name into the document head", () => {
		class Greeter extends TemplesComponent {
			static tag = "greeter-head";
			static template = "<p data-bind='text=title'>Hello</p>";
		}

		Greeter.define();

		const template = document.head.querySelector<HTMLTemplateElement>("template#greeter-head");

		expect(template).not.toBeNull();
		expect(template?.id).toBe("greeter-head");
	});

	test("renders from state and re-renders on a state mutation", () => {
		class Greeter extends TemplesComponent {
			static tag = "greeter-render";
			static template = "<p data-bind='text=title'>Hello</p>";
			state = reactive({ title: "Hello" });
		}

		Greeter.define();

		const elt = document.createElement("greeter-render") as Greeter;
		document.body.appendChild(elt);

		expect(elt.querySelector("p")?.textContent).toBe("Hello");

		elt.state.title = "World";

		expect(elt.querySelector("p")?.textContent).toBe("World");
		elt.remove();
	});

	test("re-renders on a nested state mutation", () => {
		class Profile extends TemplesComponent {
			static tag = "profile-card";
			static template = "<span data-bind='text=user.name'>?</span>";
			state = reactive({ user: { name: "Jane" } });
		}

		Profile.define();

		const elt = document.createElement("profile-card") as Profile;
		document.body.appendChild(elt);

		expect(elt.querySelector("span")?.textContent).toBe("Jane");

		elt.state.user.name = "Jane Eyre";

		expect(elt.querySelector("span")?.textContent).toBe("Jane Eyre");
		elt.remove();
	});

	test("coerces observed attributes into state and re-renders", () => {
		class Meter extends TemplesComponent {
			static tag = "meter-card";
			static template = "<p data-bind='text=count'>0</p><span data-bind='text=done'>?</span>";
			static observedAttributes = ["count", "done"];
			static attributeTypes = { count: "number", done: "boolean" };
			state = reactive({ count: 0, done: false });
		}

		Meter.define();

		const elt = document.createElement("meter-card") as Meter;
		elt.setAttribute("count", "3");
		elt.setAttribute("done", "true");
		document.body.appendChild(elt);

		expect(elt.state.count).toBe(3);
		expect(elt.state.done).toBe(true);
		expect(elt.querySelector("p")?.textContent).toBe("3");
		expect(elt.querySelector("span")?.textContent).toBe("true");

		elt.setAttribute("count", "5");

		expect(elt.state.count).toBe(5);
		expect(elt.querySelector("p")?.textContent).toBe("5");
		elt.remove();
	});

	test("maps a falsey boolean attribute to false", () => {
		class Flag extends TemplesComponent {
			static tag = "flag-card";
			static template = "<span data-bind='text=done'>?</span>";
			static observedAttributes = ["done"];
			static attributeTypes = { done: "boolean" };
			state = reactive({ done: true });
		}

		Flag.define();

		const elt = document.createElement("flag-card") as Flag;
		elt.setAttribute("done", "false");
		document.body.appendChild(elt);

		expect(elt.state.done).toBe(false);
		expect(elt.querySelector("span")?.textContent).toBe("false");
		elt.remove();
	});

	test("removing an observed attribute resets the coerced state", () => {
		class Meter extends TemplesComponent {
			static tag = "meter-remove";
			static template = "<p data-bind='text=count'>0</p>";
			static observedAttributes = ["count"];
			static attributeTypes = { count: "number" };
			state = reactive({ count: 0 });
		}

		Meter.define();

		const elt = document.createElement("meter-remove") as Meter;
		elt.setAttribute("count", "7");
		document.body.appendChild(elt);

		expect(elt.state.count).toBe(7);

		elt.removeAttribute("count");

		expect(elt.state.count).toBe(0);
		elt.remove();
	});

	test("disconnectedCallback cleans up the children", () => {
		class Greeter extends TemplesComponent {
			static tag = "greeter-cleanup";
			static template = "<p data-bind='text=title'>Hello</p>";
			state = reactive({ title: "Hi" });
		}

		Greeter.define();

		const elt = document.createElement("greeter-cleanup") as Greeter;
		document.body.appendChild(elt);

		expect(elt.children.length).toBeGreaterThan(0);

		elt.remove();

		expect(elt.children.length).toBe(0);
	});

	test("composed components re-render when the parent state changes", () => {
		class TodoItem extends TemplesComponent {
			static tag = "todo-item";
			static template = "<li data-bind='text=label'></li>";
			static observedAttributes = ["label"];
			state = reactive({ label: "" });
		}

		TodoItem.define();

		class TodoList extends TemplesComponent {
			static tag = "todo-list";
			static template =
				"<ul data-iterate='item: items'><todo-item data-bind='label=item.label'></todo-item></ul>";
			state = reactive({ items: [{ label: "A" }, { label: "B" }] });
		}

		TodoList.define();

		const list = document.createElement("todo-list") as TodoList;
		document.body.appendChild(list);

		expect(list.querySelectorAll("todo-item").length).toBe(2);

		list.state.items.push({ label: "C" });

		expect(list.querySelectorAll("todo-item").length).toBe(3);
		expect(list.querySelectorAll("todo-item")[2]?.textContent).toBe("C");

		list.state.items[0].label = "A1";

		expect(list.querySelectorAll("todo-item")[0]?.textContent).toBe("A1");
		list.remove();
	});
});
