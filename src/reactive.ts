/**
 * A subscriber that runs when a reactive object changes.
 */
export type ReactiveSubscriber = () => void;

/**
 * Registered subscribers per reactive object.
 */
const subscribers = new WeakMap<object, Set<ReactiveSubscriber>>();

/**
 * Parent reactive object of each reactive object, for bubbling notifications.
 */
const parents = new WeakMap<object, object | undefined>();

/**
 * Proxy already created for a raw object, for stable deep proxying.
 */
const proxies = new WeakMap<object, object>();

/**
 * Notify a reactive object and bubble up to its parents.
 *
 * A mutation on a nested object fires its own subscribers, then walks the
 * parent chain so a root subscriber observes changes deep in its tree.
 *
 * @param target - The reactive object that changed.
 */
const notify = (target: object): void => {
	const set = subscribers.get(target);

	if (set !== undefined) {
		for (const subscriber of [...set]) subscriber();
	}

	const parent = parents.get(target);

	if (parent !== undefined) notify(parent);
};

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
export const reactive = <T extends object>(target: T, parent?: object): T => {
	const cached = proxies.get(target);

	if (cached !== undefined) return cached as T;

	const proxy = new Proxy(target, {
		get(t, key, receiver) {
			const value = Reflect.get(t, key, receiver);

			return isObject(value) ? reactive(value, receiver) : value;
		},
		set(t, key, value, receiver) {
			const written = Reflect.set(t, key, value, receiver);

			if (written && !isArrayLength(t, key)) notify(receiver);

			return written;
		},
		deleteProperty(t, key) {
			const deleted = Reflect.deleteProperty(t, key);

			if (deleted) {
				const proxyOfTarget = proxies.get(t);

				if (proxyOfTarget !== undefined) notify(proxyOfTarget);
			}

			return deleted;
		}
	});

	proxies.set(target, proxy);
	parents.set(proxy, parent);

	return proxy as T;
};

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
export const subscribe = <T extends object>(
	target: T,
	subscriber: ReactiveSubscriber
): (() => void) => {
	let set = subscribers.get(target);

	if (set === undefined) {
		set = new Set<ReactiveSubscriber>();
		subscribers.set(target, set);
	}

	set.add(subscriber);

	return () => {
		set?.delete(subscriber);
	};
};

/**
 * Tell whether a value is an object or array that can hold nested state.
 *
 * Functions and null are not proxied: functions are invoked as data, and null
 * has no properties to observe.
 *
 * @param value - The value to inspect.
 * @returns True when the value can be wrapped in a reactive proxy.
 */
const isObject = (value: unknown): value is object => typeof value === "object" && value !== null;

/**
 * Tell whether a write is an array length update.
 *
 * `push`, `pop`, and `splice` set the affected indexes, then update `length`,
 * which would otherwise fire the subscriber twice for one operation. The index
 * write already notifies, so the trailing length update is skipped. Explicit
 * `length` assignment is not tracked; replace the array instead.
 *
 * @param target - The object being written to.
 * @param key - The property key being written.
 * @returns True when the write is a length update on an array.
 */
const isArrayLength = (target: object, key: PropertyKey): boolean =>
	Array.isArray(target) && key === "length";
