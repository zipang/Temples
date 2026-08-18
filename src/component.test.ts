import { describe, expect, test } from "bun:test";
import { type AttributeType, TemplesComponent } from "./component";
import { reactive } from "./reactive";

describe("TemplesComponent.define", () => {
	test("defines a custom element from static tag and template", () => {
		class Greeter extends TemplesComponent {
			static override tag = "greeter-card";
			static override template = "<p data-bind='text=title'>Hello</p>";
		}

		Greeter.define();

		const elt = document.createElement("greeter-card") as Greeter;

		expect(elt).toBeInstanceOf(Greeter);
		expect(customElements.get("greeter-card")).toBe(Greeter);
	});

	test("inserts a template keyed by tag name into the document head", () => {
		class Greeter extends TemplesComponent {
			static override tag = "greeter-head";
			static override template = "<p data-bind='text=title'>Hello</p>";
		}

		Greeter.define();

		const template = document.head.querySelector<HTMLTemplateElement>("template#greeter-head");

		expect(template).not.toBeNull();
		expect(template?.id).toBe("greeter-head");
	});

	test("renders from state and re-renders on a state mutation", () => {
		class Greeter extends TemplesComponent {
			static override tag = "greeter-render";
			static override template = "<p data-bind='text=title'>Hello</p>";
			override state = reactive({ title: "Hello" });
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
			static override tag = "profile-card";
			static override template = "<span data-bind='text=user.name'>?</span>";
			override state = reactive({ user: { name: "Jane" } });
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
			static override tag = "meter-card";
			static override template =
				"<p data-bind='text=count'>0</p><span data-bind='text=done'>?</span>";
			static override observedAttributes = ["count", "done"];
			static override attributeTypes: Record<string, AttributeType> = {
				count: "number",
				done: "boolean"
			};
			override state = reactive({ count: 0, done: false });
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
			static override tag = "flag-card";
			static override template = "<span data-bind='text=done'>?</span>";
			static override observedAttributes = ["done"];
			static override attributeTypes: Record<string, AttributeType> = { done: "boolean" };
			override state = reactive({ done: true });
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
			static override tag = "meter-remove";
			static override template = "<p data-bind='text=count'>0</p>";
			static override observedAttributes = ["count"];
			static override attributeTypes: Record<string, AttributeType> = { count: "number" };
			override state = reactive({ count: 0 });
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
			static override tag = "greeter-cleanup";
			static override template = "<p data-bind='text=title'>Hello</p>";
			override state = reactive({ title: "Hi" });
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
			static override tag = "todo-item";
			static override template = "<li data-bind='text=label'></li>";
			static override observedAttributes = ["label"];
			override state = reactive({ label: "" });
		}

		TodoItem.define();

		class TodoList extends TemplesComponent {
			static override tag = "todo-list";
			static override template =
				"<ul data-iterate='item: items'><todo-item data-bind='label=item.label'></todo-item></ul>";
			override state = reactive({ items: [{ label: "A" }, { label: "B" }] });
		}

		TodoList.define();

		const list = document.createElement("todo-list") as TodoList;
		document.body.appendChild(list);

		expect(list.querySelectorAll("todo-item").length).toBe(2);

		list.state.items.push({ label: "C" });

		expect(list.querySelectorAll("todo-item").length).toBe(3);
		expect(list.querySelectorAll("todo-item")[2]?.textContent).toBe("C");

		const firstItem = list.state.items[0];

		if (firstItem !== undefined) firstItem.label = "A1";

		expect(list.querySelectorAll("todo-item")[0]?.textContent).toBe("A1");
		list.remove();
	});

	test("define(tagName, componentClass, options) registers and copies options to the class", () => {
		const clicks: string[] = [];

		class Counter extends TemplesComponent {
			static override observedAttributes = ["label"];
			override state = reactive({ label: "" });

			onClick(): void {
				clicks.push("clicked");
			}
		}

		TemplesComponent.define("canonical-counter", Counter, {
			template: "<button class='inc' data-bind='text=label'>x</button>",
			events: {
				"click .inc": "onClick"
			},
			css: "canonical-counter { color: black; }",
			globalStore: { label: "Count" }
		});

		expect(Counter.tag).toBe("canonical-counter");
		expect(Counter.css).toBe("canonical-counter { color: black; }");

		const elt = document.createElement("canonical-counter") as Counter;
		document.body.appendChild(elt);

		expect(elt.querySelector("button")?.textContent).toBe("Count");

		elt.querySelector("button")?.dispatchEvent(new Event("click", { bubbles: true }));

		expect(clicks).toEqual(["clicked"]);
		elt.remove();
	});

	test("define(tagName, componentClass, options) without events preserves the class events map", () => {
		const hits: TemplesComponent[] = [];

		class Counter extends TemplesComponent {
			static override events = { "click .inc": "onInc" };
			override state = reactive({ count: 0 });

			onInc(): void {
				hits.push(this);
			}
		}

		TemplesComponent.define("canonical-preserve-events", Counter, {
			template: "<button class='inc'>+1</button>"
		});

		const elt = document.createElement("canonical-preserve-events") as Counter;
		document.body.appendChild(elt);

		elt.querySelector("button")?.dispatchEvent(new Event("click", { bubbles: true }));

		expect(hits).toEqual([elt]);
		elt.remove();
	});

	test("define(tagName, componentClass, options) lets an explicit attribute override the store", () => {
		class Greeter extends TemplesComponent {
			static override observedAttributes = ["name"];
			override state = reactive({ name: "" });
		}

		TemplesComponent.define("canonical-greeter", Greeter, {
			template: "<p data-bind='text=name'>?</p>",
			globalStore: { name: "From Store" }
		});

		const fromStore = document.createElement("canonical-greeter") as Greeter;
		document.body.appendChild(fromStore);

		expect(fromStore.querySelector("p")?.textContent).toBe("From Store");

		const explicit = document.createElement("canonical-greeter") as Greeter;
		explicit.setAttribute("name", "Explicit");
		document.body.appendChild(explicit);

		expect(explicit.querySelector("p")?.textContent).toBe("Explicit");

		fromStore.remove();
		explicit.remove();
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
			original.call(document, type, listener as EventListenerOrEventListenerObject, options);
		}) as typeof document.addEventListener;

		document.addEventListener = spy;

		try {
			class Alpha extends TemplesComponent {
				static override tag = "event-alpha";
				static override template = "<b class='x'>a</b>";
				static override events = { "dblclick .x": "onX" };
				override state = reactive({});

				onX(): void {}
			}

			class Beta extends TemplesComponent {
				static override tag = "event-beta";
				static override template = "<i class='x'>b</i>";
				static override events = { "dblclick .x": "onX" };
				override state = reactive({});

				onX(): void {}
			}

			Alpha.define();
			Beta.define();

			expect(added.filter((type) => type === "dblclick")).toHaveLength(1);
		} finally {
			document.addEventListener = original;
		}
	});

	test("runs the handler with this bound to the component and the event passed", () => {
		const captured: Array<{ evt: Event; self: TemplesComponent }> = [];

		class Counter extends TemplesComponent {
			static override tag = "event-counter";
			static override template = "<input class='field'><button class='inc'>+1</button>";
			static override events = { "click .inc": "onInc" };
			override state = reactive({ count: 0 });

			onInc(evt: Event): void {
				captured.push({ evt, self: this });
			}
		}

		Counter.define();

		const elt = document.createElement("event-counter") as Counter;
		document.body.appendChild(elt);

		elt.querySelector("button.inc")?.dispatchEvent(new Event("click", { bubbles: true }));

		expect(captured).toHaveLength(1);
		expect(captured[0]?.self).toBe(elt);
		expect(captured[0]?.evt).toBeInstanceOf(Event);
		elt.remove();
	});

	test("handlers receive a live event with preventDefault and target access", () => {
		let defaultPrevented = false;
		let inputValue = "";

		class Form extends TemplesComponent {
			static override tag = "event-form";
			static override template = "<form class='form'><input class='field' value='hi'></form>";
			static override events = { "submit .form": "onSubmit" };
			override state = reactive({});

			onSubmit(evt: Event): void {
				evt.preventDefault();
				defaultPrevented = evt.defaultPrevented;
				inputValue = (evt.target as HTMLFormElement).querySelector("input")?.value ?? "";
			}
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
			static override tag = "event-multi";
			static override template = "<button class='inc'>+1</button>";
			static override events = { "click .inc": "onInc" };
			override state = reactive({ count: 0 });

			onInc(): void {
				clicked.push(this);
			}
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
			static override tag = "event-inner";
			static override template = "<button class='act'>go</button>";
			static override events = { "click .act": "onAct" };
			override state = reactive({});

			onAct(): void {
				innerHits.push(this);
			}
		}

		class Outer extends TemplesComponent {
			static override tag = "event-outer";
			static override template = "<event-inner></event-inner>";
			static override events = { "click .act": "onAct" };
			override state = reactive({});

			onAct(): void {
				outerHits.push(this);
			}
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
			static override tag = "event-mismatch";
			static override template = "<button class='other'>x</button>";
			static override events = { "click .inc": "onInc" };
			override state = reactive({});

			onInc(): void {
				hits++;
			}
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
			static override tag = "event-outside";
			static override template = "<button class='inc'>+1</button>";
			static override events = { "click .inc": "onInc" };
			override state = reactive({});

			onInc(): void {
				hits++;
			}
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
		const received: Array<{ evt: CustomEvent; self: TemplesComponent }> = [];

		class TaskItem extends TemplesComponent {
			static override tag = "msg-item-a";
			static override template = "<li>task</li>";
			override state = reactive({});
		}

		class TaskList extends TemplesComponent {
			static override tag = "msg-list-a";
			static override template = "<ul></ul>";
			override state = reactive({});

			onCompleted(evt: CustomEvent): void {
				received.push({ evt, self: this });
			}
		}

		TaskItem.define();
		TaskList.define();

		const item = document.createElement("msg-item-a") as TaskItem;
		const list = document.createElement("msg-list-a") as TaskList;

		list.on({ "msg-item-a:completed": "onCompleted" });
		item.emit("completed", { id: 1 });

		expect(received).toHaveLength(1);
		expect(received[0]?.evt.type).toBe("msg-item-a:completed");
		expect(received[0]?.evt.detail).toEqual({ id: 1 });
		expect(received[0]?.self).toBe(list);
	});

	test("separates same local name emitted by different classes", () => {
		const items: unknown[] = [];
		const notes: unknown[] = [];

		class TaskItem extends TemplesComponent {
			static override tag = "msg-item-b";
			static override template = "<li></li>";
			override state = reactive({});

			onChanged(evt: CustomEvent): void {
				items.push(evt.detail);
			}
		}

		class TaskNote extends TemplesComponent {
			static override tag = "msg-note-b";
			static override template = "<p></p>";
			override state = reactive({});

			onChanged(evt: CustomEvent): void {
				notes.push(evt.detail);
			}
		}

		TaskItem.define();
		TaskNote.define();

		const item = document.createElement("msg-item-b") as TaskItem;
		const note = document.createElement("msg-note-b") as TaskNote;

		item.on({ "msg-item-b:changed": "onChanged" });
		note.on({ "msg-note-b:changed": "onChanged" });

		item.emit("changed", "item-a");
		note.emit("changed", "note-b");

		expect(items).toEqual(["item-a"]);
		expect(notes).toEqual(["note-b"]);
	});

	test("does not deliver to a listener on the unprefixed name", () => {
		let hits = 0;

		class TaskItem extends TemplesComponent {
			static override tag = "msg-item-c";
			static override template = "<li></li>";
			override state = reactive({});

			onPing(): void {
				hits++;
			}
		}

		TaskItem.define();

		const item = document.createElement("msg-item-c") as TaskItem;

		item.on({ completed: "onPing" });
		item.emit("completed");

		expect(hits).toBe(0);
	});

	test("disconnecting stops message delivery", () => {
		let hits = 0;

		class Emitter extends TemplesComponent {
			static override tag = "msg-emitter";
			static override template = "<i></i>";
			override state = reactive({});
		}

		class Listener extends TemplesComponent {
			static override tag = "msg-listener";
			static override template = "<span></span>";
			static override events = { "msg-emitter:ping": "onPing" };
			override state = reactive({});

			onPing(): void {
				hits++;
			}
		}

		Emitter.define();
		Listener.define();

		const emitter = document.createElement("msg-emitter") as Emitter;
		const listener = document.createElement("msg-listener") as Listener;

		document.body.appendChild(listener);
		emitter.emit("ping");
		expect(hits).toBe(1);

		listener.remove();
		emitter.emit("ping");
		expect(hits).toBe(1);
	});

	test("messaging works without connecting the components to the DOM", () => {
		let hits = 0;

		class TaskItem extends TemplesComponent {
			static override tag = "msg-item-d";
			static override template = "<li></li>";
			override state = reactive({});
		}

		class TaskList extends TemplesComponent {
			static override tag = "msg-list-d";
			static override template = "<ul></ul>";
			override state = reactive({});

			onCompleted(): void {
				hits++;
			}
		}

		TaskItem.define();
		TaskList.define();

		const item = document.createElement("msg-item-d") as TaskItem;
		const list = document.createElement("msg-list-d") as TaskList;

		list.on({ "msg-item-d:completed": "onCompleted" });
		item.emit("completed");

		expect(hits).toBe(1);
	});
});

describe("TemplesComponent css and global store", () => {
	test("static css defaults to an empty string", () => {
		class Widget extends TemplesComponent {
			static override tag = "css-default";
			static override template = "<p>hi</p>";
		}

		expect(Widget.css).toBe("");
	});

	test("define({ globalStore }) seeds an observed attribute from the store", () => {
		class Widget extends TemplesComponent {
			static override tag = "store-seed";
			static override template = "<p data-bind='text=title'>?</p>";
			static override observedAttributes = ["title"];
			override state = reactive({ title: "" });
		}

		Widget.define({ globalStore: { title: "From Store" } });

		const elt = document.createElement("store-seed") as Widget;

		document.body.appendChild(elt);

		expect(elt.querySelector("p")?.textContent).toBe("From Store");
		elt.remove();
	});

	test("an explicit attribute masks the same-named store key", () => {
		class Widget extends TemplesComponent {
			static override tag = "store-mask";
			static override template = "<p data-bind='text=title'>?</p>";
			static override observedAttributes = ["title"];
			override state = reactive({ title: "" });
		}

		Widget.define({ globalStore: { title: "From Store" } });

		const elt = document.createElement("store-mask") as Widget;

		elt.setAttribute("title", "Explicit");
		document.body.appendChild(elt);

		expect(elt.querySelector("p")?.textContent).toBe("Explicit");
		elt.remove();
	});
});
