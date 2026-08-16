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

describe("TemplesComponent events", () => {
	test("registers a single document listener per event type", () => {
		const original = document.addEventListener;
		const added: string[] = [];
		const spy = ((
			type: string,
			listener: EventListenerOrEventListenerObject | null,
			options?: AddEventListenerOptions | boolean
		) => {
			added.push(type);
			original.call(document, type, listener, options);
		}) as typeof document.addEventListener;

		document.addEventListener = spy;

		try {
			class Alpha extends TemplesComponent {
				static tag = "event-alpha";
				static template = "<b class='x'>a</b>";
				static events = { "dblclick .x": () => undefined };
				state = reactive({});
			}

			class Beta extends TemplesComponent {
				static tag = "event-beta";
				static template = "<i class='x'>b</i>";
				static events = { "dblclick .x": () => undefined };
				state = reactive({});
			}

			Alpha.define();
			Beta.define();

			expect(added.filter((type) => type === "dblclick")).toHaveLength(1);
		} finally {
			document.addEventListener = original;
		}
	});

	test("passes the event and the component to the handler", () => {
		const captured: Array<{ evt: Event; cmpnt: TemplesComponent }> = [];

		class Counter extends TemplesComponent {
			static tag = "event-counter";
			static template = "<input class='field'><button class='inc'>+1</button>";
			static events = {
				"click .inc": (evt: Event, cmpnt: TemplesComponent) => {
					captured.push({ evt, cmpnt });
				}
			};
			state = reactive({ count: 0 });
		}

		Counter.define();

		const elt = document.createElement("event-counter") as Counter;
		document.body.appendChild(elt);

		elt.querySelector("button.inc")?.dispatchEvent(new Event("click", { bubbles: true }));

		expect(captured).toHaveLength(1);
		expect(captured[0]?.cmpnt).toBe(elt);
		expect(captured[0]?.evt).toBeInstanceOf(Event);
		elt.remove();
	});

	test("handlers receive a live event with preventDefault and target access", () => {
		let defaultPrevented = false;
		let inputValue = "";

		class Form extends TemplesComponent {
			static tag = "event-form";
			static template = "<form class='form'><input class='field' value='hi'></form>";
			static events = {
				"submit .form": (evt: Event) => {
					evt.preventDefault();
					defaultPrevented = evt.defaultPrevented;
					inputValue = (evt.target as HTMLFormElement).querySelector("input")?.value ?? "";
				}
			};
			state = reactive({});
		}

		Form.define();

		const elt = document.createElement("event-form") as Form;
		document.body.appendChild(elt);

		elt
			.querySelector("form")
			?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

		expect(defaultPrevented).toBe(true);
		expect(inputValue).toBe("hi");
		elt.remove();
	});

	test("a single document listener serves every instance", () => {
		const clicked: TemplesComponent[] = [];

		class Counter extends TemplesComponent {
			static tag = "event-multi";
			static template = "<button class='inc'>+1</button>";
			static events = {
				"click .inc": (_evt: Event, cmpnt: TemplesComponent) => clicked.push(cmpnt)
			};
			state = reactive({ count: 0 });
		}

		Counter.define();

		const first = document.createElement("event-multi") as Counter;
		const second = document.createElement("event-multi") as Counter;

		document.body.appendChild(first);
		document.body.appendChild(second);

		first.querySelector("button")?.dispatchEvent(new Event("click", { bubbles: true }));

		expect(clicked).toHaveLength(1);
		expect(clicked[0]).toBe(first);

		second.querySelector("button")?.dispatchEvent(new Event("click", { bubbles: true }));

		expect(clicked).toHaveLength(2);
		expect(clicked[1]).toBe(second);

		first.remove();
		second.remove();
	});

	test("resolves the closest component and ignores outer handlers", () => {
		const innerHits: TemplesComponent[] = [];
		const outerHits: TemplesComponent[] = [];

		class Inner extends TemplesComponent {
			static tag = "event-inner";
			static template = "<button class='act'>go</button>";
			static events = {
				"click .act": (_evt: Event, cmpnt: TemplesComponent) => innerHits.push(cmpnt)
			};
			state = reactive({});
		}

		class Outer extends TemplesComponent {
			static tag = "event-outer";
			static template = "<event-inner></event-inner>";
			static events = {
				"click .act": (_evt: Event, cmpnt: TemplesComponent) => outerHits.push(cmpnt)
			};
			state = reactive({});
		}

		Inner.define();
		Outer.define();

		const outer = document.createElement("event-outer") as Outer;
		document.body.appendChild(outer);

		const inner = outer.querySelector("event-inner") as Inner;
		inner.querySelector("button")?.dispatchEvent(new Event("click", { bubbles: true }));

		expect(innerHits).toHaveLength(1);
		expect(innerHits[0]).toBe(inner);
		expect(outerHits).toHaveLength(0);

		outer.remove();
	});

	test("ignores events that do not match the selector", () => {
		let hits = 0;

		class Counter extends TemplesComponent {
			static tag = "event-mismatch";
			static template = "<button class='other'>x</button>";
			static events = {
				"click .inc": () => {
					hits++;
				}
			};
			state = reactive({});
		}

		Counter.define();

		const elt = document.createElement("event-mismatch") as Counter;
		document.body.appendChild(elt);

		elt.querySelector("button")?.dispatchEvent(new Event("click", { bubbles: true }));

		expect(hits).toBe(0);
		elt.remove();
	});

	test("ignores events from outside any component", () => {
		let hits = 0;

		class Counter extends TemplesComponent {
			static tag = "event-outside";
			static template = "<button class='inc'>+1</button>";
			static events = {
				"click .inc": () => {
					hits++;
				}
			};
			state = reactive({});
		}

		Counter.define();

		const stray = document.createElement("button");

		stray.className = "inc";
		document.body.appendChild(stray);
		stray.dispatchEvent(new Event("click", { bubbles: true }));

		expect(hits).toBe(0);
		stray.remove();
	});
});

describe("TemplesComponent messaging", () => {
	test("emits a tag-prefixed message that a different class can subscribe to", () => {
		const received: CustomEvent[] = [];

		class TaskItem extends TemplesComponent {
			static tag = "msg-item-a";
			static template = "<li>task</li>";
			state = reactive({});
		}

		class TaskList extends TemplesComponent {
			static tag = "msg-list-a";
			static template = "<ul></ul>";
			state = reactive({});
		}

		TaskItem.define();
		TaskList.define();

		const item = document.createElement("msg-item-a") as TaskItem;
		const list = document.createElement("msg-list-a") as TaskList;

		list.on("msg-item-a:completed", (evt) => received.push(evt));
		item.emit("completed", { id: 1 });

		expect(received).toHaveLength(1);
		expect(received[0]?.type).toBe("msg-item-a:completed");
		expect(received[0]?.detail).toEqual({ id: 1 });
	});

	test("separates same local name emitted by different classes", () => {
		const items: unknown[] = [];
		const notes: unknown[] = [];

		class TaskItem extends TemplesComponent {
			static tag = "msg-item-b";
			static template = "<li></li>";
			state = reactive({});
		}

		class TaskNote extends TemplesComponent {
			static tag = "msg-note-b";
			static template = "<p></p>";
			state = reactive({});
		}

		TaskItem.define();
		TaskNote.define();

		const item = document.createElement("msg-item-b") as TaskItem;
		const note = document.createElement("msg-note-b") as TaskNote;

		item.on("msg-item-b:changed", (evt) => items.push(evt.detail));
		note.on("msg-note-b:changed", (evt) => notes.push(evt.detail));

		item.emit("changed", "item-a");
		note.emit("changed", "note-b");

		expect(items).toEqual(["item-a"]);
		expect(notes).toEqual(["note-b"]);
	});

	test("does not deliver to a listener on the unprefixed name", () => {
		let hits = 0;

		class TaskItem extends TemplesComponent {
			static tag = "msg-item-c";
			static template = "<li></li>";
			state = reactive({});
		}

		TaskItem.define();

		const item = document.createElement("msg-item-c") as TaskItem;

		item.on("completed", () => {
			hits++;
		});
		item.emit("completed");

		expect(hits).toBe(0);
	});

	test("on returns an unsubscribe function that stops delivery", () => {
		let hits = 0;

		class Emitter extends TemplesComponent {
			static tag = "msg-emitter";
			static template = "<i></i>";
			state = reactive({});
		}

		Emitter.define();

		const emitter = document.createElement("msg-emitter") as Emitter;

		const off = emitter.on("msg-emitter:ping", () => {
			hits++;
		});

		emitter.emit("ping");
		expect(hits).toBe(1);

		off();
		emitter.emit("ping");
		expect(hits).toBe(1);
	});

	test("messaging works without connecting the components to the DOM", () => {
		let hits = 0;

		class TaskItem extends TemplesComponent {
			static tag = "msg-item-d";
			static template = "<li></li>";
			state = reactive({});
		}

		class TaskList extends TemplesComponent {
			static tag = "msg-list-d";
			static template = "<ul></ul>";
			state = reactive({});
		}

		TaskItem.define();
		TaskList.define();

		const item = document.createElement("msg-item-d") as TaskItem;
		const list = document.createElement("msg-list-d") as TaskList;

		list.on("msg-item-d:completed", () => {
			hits++;
		});
		item.emit("completed");

		expect(hits).toBe(1);
	});
});
