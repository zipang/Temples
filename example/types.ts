/**
 * A shopping list item shared by the app, the item, and the vault.
 *
 * The `id` is a generated key used for reconciliation and message routing.
 * `label` is the item name, and `checked` marks it as added to the cart.
 */
export interface ShoppingItemData {
	id: string;
	label: string;
	checked: boolean;
}
