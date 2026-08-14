import { describe, expect, test } from "bun:test";
import { TemplesComponent } from "../index";

const template = "<p data-bind='text=title'>Hello</p>";

describe("TemplesComponent.define", () => {
	test("defines a custom element from an HTML template string", () => {
		class Greeter extends TemplesComponent {
			static observedAttributes = ["title"];
		}

		TemplesComponent.define("greeter-card", Greeter, { template });

		const el = document.createElement("greeter-card") as Greeter;

		expect(el).toBeInstanceOf(Greeter);
		expect(customElements.get("greeter-card")).toBe(Greeter);
	});

	test("renders the template bindings from the observed attributes", () => {
		class Greeter extends TemplesComponent {
			static observedAttributes = ["title"];
		}

		TemplesComponent.define("greeter-render", Greeter, { template });

		const el = document.createElement("greeter-render") as Greeter;
		el.setAttribute("title", "Hello");
		document.body.appendChild(el);

		expect(el.querySelector("p")?.textContent).toBe("Hello");
		el.remove();
	});

	test("re-renders when an observed attribute changes", () => {
		class Greeter extends TemplesComponent {
			static observedAttributes = ["title"];
		}

		TemplesComponent.define("greeter-update", Greeter, { template });

		const el = document.createElement("greeter-update") as Greeter;
		el.setAttribute("title", "Hello");
		document.body.appendChild(el);

		el.setAttribute("title", "World");

		expect(el.querySelector("p")?.textContent).toBe("World");
		el.remove();
	});

	test("the component exposes update(path, value) for partial re-renders", () => {
		class Profile extends TemplesComponent {
			static observedAttributes = ["title", "status"];
		}

		TemplesComponent.define("profile-card", Profile, {
			template: "<p data-bind='text=title'>t</p><span data-bind='text=status'>s</span>"
		});

		const el = document.createElement("profile-card") as Profile;
		el.setAttribute("title", "Jane");
		el.setAttribute("status", "online");
		document.body.appendChild(el);

		el.update("status", "away");

		expect(el.querySelector("p")?.textContent).toBe("Jane");
		expect(el.querySelector("span")?.textContent).toBe("away");
		el.remove();
	});

	test("disconnectedCallback cleans up the children", () => {
		class Greeter extends TemplesComponent {
			static observedAttributes = ["title"];
		}

		TemplesComponent.define("greeter-cleanup", Greeter, { template });

		const el = document.createElement("greeter-cleanup") as Greeter;
		document.body.appendChild(el);
		expect(el.children.length).toBeGreaterThan(0);

		el.remove();
		expect(el.children.length).toBe(0);
	});
});
