import { reactive, TemplesComponent } from "../../../dist/index.js";
import type { ShoppingItemData } from "../../types.ts";
import template from "./shopping-app.html" with { type: "text" };
import "./shopping-app.css";

/**
 * The root of the shopping list, owning the shared list of items.
 *
 * The app seeds its `title` from the global store, renders one `shopping-item`
 * per entry, and coordinates every change through the message bus: it emits
 * `created` on add, and subscribes to `shopping-item:updated`,
 * `shopping-item:removed`, and `shopping-vault:recalled`.
 */
export class ShoppingApp extends TemplesComponent {
	static override observedAttributes = ["title"];

	override state = reactive({
		title: "",
		items: [] as ShoppingItemData[],
		isEmpty() {
			return this.items.length === 0;
		}
	});

	static override events = {
		"submit .add-form": "addItem",
		"shopping-item:updated": "updateItem",
		"shopping-item:removed": "removeItem",
		"shopping-vault:recalled": "recallItem"
	};

	/**
	 * Create a new item from the add form and publish it.
	 */
	addItem(evt: Event): void {
		evt.preventDefault();

		const form = evt.target as HTMLFormElement;
		const input = form.querySelector<HTMLInputElement>("input.add-input");
		const label = input?.value.trim() ?? "";

		if (!input || !label) return;

		const item: ShoppingItemData = { id: crypto.randomUUID(), label, checked: false };

		this.state.items.push(item);
		this.emit("created", item);

		// RAZ and refocus
		input.value = "";
		input.focus();
	}

	/**
	 * Apply an updated item to the matching entry.
	 */
	updateItem(evt: CustomEvent): void {
		const item = evt.detail as ShoppingItemData;
		const existing = this.state.items.find((entry) => entry.id === item.id);

		if (existing === undefined) return;

		existing.label = item.label;
		existing.checked = item.checked;
	}

	/**
	 * Drop the removed item from the active list.
	 */
	removeItem(evt: CustomEvent): void {
		const item = evt.detail as ShoppingItemData;

		this.state.items = this.state.items.filter((entry) => entry.id !== item.id);
	}

	/**
	 * Restore a recalled item back into the active list.
	 */
	recallItem(evt: CustomEvent): void {
		this.state.items.push(evt.detail as ShoppingItemData);
	}
}

TemplesComponent.define("shopping-app", ShoppingApp, {
	template,
	globalStore: { title: "My Shopping List" }
});
