/**
 * A subscriber that runs when a reactive object changes.
 */
export type ReactiveSubscriber = () => void;
/**
 * Wrap an object in a deep reactive proxy.
 *
 * Reading a nested object or array returns its own reactive proxy, so changes
 * at any depth notify the subscribers of every ancestor. Mutations fire
 * subscribers registered with `subscribe`.
 *
 * @param target - The object to make reactive.
 * @param parent - The reactive parent, set for nested objects automatically.
 * @returns A reactive proxy over the target.
 */
export declare const reactive: <T extends object>(target: T, parent?: object) => T;
/**
 * Subscribe to a reactive object.
 *
 * The subscriber runs when the object or any of its nested properties or
 * array elements change. Subscribing to a root object observes deep mutations
 * through the parent chain.
 *
 * @param target - A reactive object returned by `reactive`.
 * @param subscriber - Callback invoked on every change.
 * @returns An unsubscribe function that stops the callback from firing.
 */
export declare const subscribe: <T extends object>(target: T, subscriber: ReactiveSubscriber) => (() => void);
