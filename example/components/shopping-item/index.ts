import { type AttributeType, TemplesComponent } from "@temples/components";
import type { ShoppingItemData } from "../../types.ts";
import template from "./shopping-item.html" with { type: "text" };
import "./shopping-item.css";

/**
 * A single shopping list entry, configured through plain attributes.
 *
 * `id`, `label`, and `checked` are observed attributes fed by the parent
 * `shopping-app`. `editing` is internal state that toggles the inline editor.
 * The component never mutates the shared list directly: it emits `updated` and
 * `removed` messages carrying the full item, and the app owns the data.
 */
export class ShoppingItem extends TemplesComponent {
	static override observedAttributes = ["id", "label", "checked"];
	static override attributeTypes: Record<string, AttributeType> = { checked: "boolean" };

	override state = {
		id: "",
		label: "",
		checked: false,
		editing: false,
		checkedClass() {
			return this.checked ? "checked" : "unchecked";
		},
		notEditing() {
			return !this.editing;
		}
	};

	static override events = {
		"change .toggle": "onToggle",
		"click .edit": "onEdit",
		"click .save": "onSave",
		"click .remove": "onRemove"
	};

	/**
	 * Flip the checked flag and publish the updated item.
	 */
	onToggle(): void {
		this.state.checked = !this.state.checked;
		this.emit("updated", this.snapshot());
	}

	/**
	 * Enter inline edit mode.
	 */
	onEdit(): void {
		this.state.editing = true;
	}

	/**
	 * Commit the edited label and leave edit mode.
	 */
	onSave(): void {
		const input = this.querySelector<HTMLInputElement>("input.edit-input");
		const label = input?.value.trim() ?? "";

		if (label === "") return;

		this.emit("updated", { id: this.state.id, label, checked: this.state.checked });
		this.state.editing = false;
	}

	/**
	 * Publish a removal request for this item.
	 */
	onRemove(): void {
		this.emit("removed", this.snapshot());
	}

	/**
	 * Build the plain data payload carried by every message.
	 */
	private snapshot(): ShoppingItemData {
		return {
			id: this.state.id,
			label: this.state.label,
			checked: this.state.checked
		};
	}
}

TemplesComponent.define("shopping-item", ShoppingItem, {
	template
});
