var __defProp = Object.defineProperty;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);

// src/utilities/properties.ts
var splitPath = (path) => path.split(/[,[\].]+?/).filter(Boolean), getProperty = (source, path, defaultValue) => {
  const steps = splitPath(path);
  let found = source;
  let parent = null;
  while (found != null && steps.length > 0) {
    const key = steps.shift();
    parent = found;
    found = found[key];
  }
  if (typeof found === "function") {
    found = found.call(parent);
  }
  return found === undefined || found === null || found === source ? defaultValue : found;
}, hasProperty = (source, path) => {
  const steps = splitPath(path);
  if (steps.length === 0)
    return false;
  let found = source;
  for (const key of steps) {
    if (found === null || typeof found !== "object" && typeof found !== "function")
      return false;
    if (!Object.hasOwn(found, key))
      return false;
    found = found[key];
  }
  return true;
}, isArrayIndex = (key) => /^(0|[1-9][0-9]*)$/.test(key), setProperty = (source, path, value) => {
  let current = source;
  const keys = splitPath(path);
  const lastKey = keys.pop();
  if (lastKey === undefined)
    return source;
  keys.forEach((key, i) => {
    const nextKey = keys[i + 1] ?? lastKey;
    if (current[key] === undefined) {
      current[key] = isArrayIndex(nextKey) ? Array(Number(nextKey) + 1).fill(undefined) : {};
    }
    current = current[key];
  });
  current[lastKey] = value;
  return source;
};

// src/engine.ts
var exports_engine = {};
__export(exports_engine, {
  Renderer: () => Renderer
});

class Renderer {
  rootElt;
  bindings;
  constructor(source) {
    this.rootElt = toElement(source);
    this.bindings = collectBindings(this.rootElt);
  }
  render(data) {
    for (const binding of this.bindings) {
      if (hasProperty(data, binding.path))
        binding.apply(data, this.rootElt);
    }
    return this.rootElt;
  }
  update(path, value) {
    const data = {};
    setProperty(data, path, value);
    for (const binding of this.bindings) {
      if (binding.path === path)
        binding.apply(data, this.rootElt);
    }
    return this.rootElt;
  }
  toHtml() {
    return this.rootElt.outerHTML;
  }
  renderToString() {
    return this.toHtml();
  }
}
var toElement = (source) => {
  if (typeof source === "string") {
    const container = document.createElement("div");
    container.innerHTML = source.trim();
    if (container.children.length > 1) {
      throw new Error("Template string must have a single root element");
    }
    return container.firstElementChild ?? container;
  }
  return source;
}, isValueControl = (el) => {
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA";
}, isFormControl = (el) => {
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}, setValue = (el, value) => {
  if (el.tagName === "SELECT") {
    for (const option of Array.from(el.querySelectorAll("option"))) {
      const optionValue = option.getAttribute("value") ?? option.textContent ?? "";
      option.selected = optionValue === value;
    }
    return;
  }
  if (isValueControl(el)) {
    el.value = value;
  } else {
    el.setAttribute("value", value);
  }
}, BOOLEAN_ATTRIBUTES, applyClass = (el, range, active) => {
  const classes = new Set(Array.from(el.classList));
  for (const name of range)
    classes.delete(name);
  if (range.includes(active))
    classes.add(active);
  el.setAttribute("class", Array.from(classes).join(" "));
}, parseClassRange = (attrPart) => {
  const open = attrPart.indexOf("[");
  const close = attrPart.indexOf("]", open);
  if (open === -1 || close === -1)
    return null;
  if (attrPart.slice(0, open).trim().toLowerCase() !== "class")
    return null;
  return attrPart.slice(open + 1, close).split("|").map((name) => name.trim()).filter((name) => name.length > 0);
}, parseExpression = (expr, el) => {
  const eq = expr.indexOf("=");
  if (eq === -1) {
    const path2 = expr.trim();
    return { kind: isFormControl(el) ? "value" : "text", path: path2 };
  }
  const attrPart = expr.slice(0, eq).trim();
  const path = expr.slice(eq + 1).trim();
  const name = attrPart.toLowerCase();
  if (name === "text")
    return { kind: "text", path };
  if (name === "html")
    return { kind: "html", path };
  if (name === "value")
    return { kind: "value", path };
  const range = parseClassRange(attrPart);
  if (range !== null)
    return { kind: "class", range, path };
  if (/^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/.test(name)) {
    return { kind: "attr", attr: name, path };
  }
  return null;
}, parseBindings = (expr, el) => {
  const bindings = [];
  for (const part of expr.split(",")) {
    const parsed = parseExpression(part, el);
    if (parsed !== null)
      bindings.push(parsed);
  }
  return bindings;
}, elementAt = (root, indexPath) => {
  let el = root;
  for (const i of indexPath) {
    const child = el.children[i];
    if (child === undefined) {
      throw new Error("Binding index path is out of range");
    }
    el = child;
  }
  return el;
}, buildBinding = (indexPath, parsed) => ({
  path: parsed.path,
  apply: (data, root) => {
    const el = elementAt(root, indexPath);
    const raw = getProperty(data, parsed.path, "");
    const value = typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean" ? String(raw) : "";
    switch (parsed.kind) {
      case "text":
        el.textContent = value;
        break;
      case "html":
        el.innerHTML = value;
        break;
      case "value":
        setValue(el, value);
        break;
      case "attr":
        if (BOOLEAN_ATTRIBUTES.has(parsed.attr)) {
          el.toggleAttribute(parsed.attr, Boolean(raw));
        } else {
          el.setAttribute(parsed.attr, value);
        }
        break;
      case "class":
        applyClass(el, parsed.range, value);
        break;
    }
  }
}), singularize = (word) => {
  if (word.length > 1 && word.endsWith("s") && !/(ss|us|is)$/.test(word)) {
    return word.slice(0, -1);
  }
  return word;
}, parseLoop = (loopExpr) => {
  const trimmed = loopExpr.trim();
  const colon = trimmed.indexOf(":");
  if (colon !== -1) {
    const varName = trimmed.slice(0, colon).trim();
    const collectionPath2 = trimmed.slice(colon + 1).trim();
    if (varName.length > 0 && collectionPath2.length > 0) {
      return { varName, collectionPath: collectionPath2 };
    }
  }
  const fromMatch = /^(\S+)\s+from\s+(\S+)$/.exec(trimmed);
  if (fromMatch !== null) {
    return { varName: fromMatch[1] ?? "", collectionPath: fromMatch[2] ?? "" };
  }
  const collectionPath = trimmed;
  const last = collectionPath.split(".").pop() ?? "";
  return { varName: singularize(last), collectionPath };
}, getItemKey = (item, keyPath) => {
  if (keyPath !== null) {
    const value = getProperty(item, keyPath, null);
    if (value === null || value === undefined)
      return null;
    return String(value);
  }
  if (item !== null && typeof item === "object" && "id" in item) {
    const id = item.id;
    if (id !== null && id !== undefined)
      return String(id);
  }
  return null;
}, buildIterate = (indexPath, template, loopExpr, keyPath) => {
  const { varName, collectionPath } = parseLoop(loopExpr);
  const subBindings = collectBindings(template);
  let rendered = new Map;
  return {
    path: collectionPath,
    apply: (data, root) => {
      const el = elementAt(root, indexPath);
      const value = getProperty(data, collectionPath, null);
      const collection = Array.isArray(value) ? value : [];
      const keyed = collection.map((item) => ({ key: getItemKey(item, keyPath), item }));
      const keyable = keyed.every(({ key }) => key !== null);
      const fragment = document.createDocumentFragment();
      if (keyable) {
        const next = new Map;
        for (const { key, item } of keyed) {
          const k = key;
          const existing = rendered.get(k);
          const node = existing ?? template.cloneNode(true);
          const context = { ...data, [varName]: item };
          for (const binding of subBindings)
            binding.apply(context, node);
          next.set(k, node);
          fragment.appendChild(node);
        }
        rendered = next;
      } else {
        for (const item of collection) {
          const node = template.cloneNode(true);
          const context = { ...data, [varName]: item };
          for (const binding of subBindings)
            binding.apply(context, node);
          fragment.appendChild(node);
        }
        rendered = new Map;
      }
      el.replaceChildren(fragment);
    }
  };
}, buildRenderIf = (indexPath, condition) => ({
  path: condition,
  apply: (data, root) => {
    const el = elementAt(root, indexPath);
    el.style.display = getProperty(data, condition, "") ? "" : "none";
  }
}), collectBindings = (root) => {
  const bindings = [];
  const collect = (el, indexPath) => {
    const loopExpr = el.getAttribute("data-iterate") || el.getAttribute("data-each");
    if (loopExpr) {
      const bindExpr2 = el.getAttribute("data-bind");
      if (bindExpr2) {
        const parsed = parseBindings(bindExpr2, el);
        if (parsed.length > 0) {
          el.removeAttribute("data-bind");
          for (const binding of parsed)
            bindings.push(buildBinding(indexPath, binding));
        }
      }
      const template = el.firstElementChild;
      if (template === null) {
        throw new Error(`${el.tagName} data-iterate must have a child element to use as sub-template`);
      }
      el.removeChild(template);
      const keyPath = el.getAttribute("data-key");
      if (keyPath !== null)
        el.removeAttribute("data-key");
      el.removeAttribute("data-iterate");
      el.removeAttribute("data-each");
      bindings.push(buildIterate(indexPath, template, loopExpr, keyPath));
      return;
    }
    const condition = el.getAttribute("data-render-if");
    if (condition) {
      el.removeAttribute("data-render-if");
      bindings.push(buildRenderIf(indexPath, condition));
    }
    const bindExpr = el.getAttribute("data-bind");
    if (bindExpr) {
      const parsed = parseBindings(bindExpr, el);
      if (parsed.length > 0) {
        el.removeAttribute("data-bind");
        for (const binding of parsed)
          bindings.push(buildBinding(indexPath, binding));
      }
    }
    for (let i = 0;i < el.children.length; i++) {
      const child = el.children[i];
      if (child !== undefined)
        collect(child, [...indexPath, i]);
    }
  };
  collect(root, []);
  return bindings;
};
var init_engine = __esm(() => {
  BOOLEAN_ATTRIBUTES = new Set([
    "checked",
    "disabled",
    "hidden",
    "readonly",
    "required",
    "multiple",
    "selected",
    "autofocus",
    "autoplay",
    "controls",
    "loop",
    "muted",
    "open",
    "novalidate",
    "inert",
    "async",
    "defer",
    "reversed"
  ]);
});

// src/reactive.ts
var subscribers, parents, proxies, notify = (target) => {
  const set = subscribers.get(target);
  if (set !== undefined) {
    for (const subscriber of [...set])
      subscriber();
  }
  const parent = parents.get(target);
  if (parent !== undefined)
    notify(parent);
}, reactive = (target, parent) => {
  const cached = proxies.get(target);
  if (cached !== undefined)
    return cached;
  const proxy = new Proxy(target, {
    get(t, key, receiver) {
      const value = Reflect.get(t, key, receiver);
      return isObject(value) ? reactive(value, receiver) : value;
    },
    set(t, key, value, receiver) {
      const written = Reflect.set(t, key, value, receiver);
      if (written && !isArrayLength(t, key))
        notify(receiver);
      return written;
    },
    deleteProperty(t, key) {
      const deleted = Reflect.deleteProperty(t, key);
      if (deleted) {
        const proxyOfTarget = proxies.get(t);
        if (proxyOfTarget !== undefined)
          notify(proxyOfTarget);
      }
      return deleted;
    }
  });
  proxies.set(target, proxy);
  parents.set(proxy, parent);
  return proxy;
}, subscribe = (target, subscriber) => {
  let set = subscribers.get(target);
  if (set === undefined) {
    set = new Set;
    subscribers.set(target, set);
  }
  set.add(subscriber);
  return () => {
    set?.delete(subscriber);
  };
}, isObject = (value) => typeof value === "object" && value !== null, isArrayLength = (target, key) => Array.isArray(target) && key === "length";
var init_reactive = __esm(() => {
  subscribers = new WeakMap;
  parents = new WeakMap;
  proxies = new WeakMap;
});

// src/component.ts
var exports_component = {};
__export(exports_component, {
  TemplesComponent: () => TemplesComponent
});
var documentListeners, messageHandlers, dispatchMessage = (type, detail) => {
  const subscriptions = messageHandlers.get(type);
  if (subscriptions === undefined)
    return;
  const event = new CustomEvent(type, { detail });
  for (const { component, handler } of [...subscriptions])
    handler.call(component, event);
}, TemplesComponent;
var init_component = __esm(() => {
  init_engine();
  init_reactive();
  documentListeners = new Map;
  messageHandlers = new Map;
  TemplesComponent = class TemplesComponent extends HTMLElement {
    static tag = "";
    static template = "";
    static css = "";
    static events = {};
    static observedAttributes = [];
    static attributeTypes = {};
    static globalStore;
    renderer = null;
    unsubscribeState = null;
    eventHandlers = {};
    messageUnsubscribers = [];
    constructor() {
      super();
      this.state = reactive({});
    }
    static define(tagNameOrOptions, componentClass, options) {
      const self = this;
      const ctor = typeof tagNameOrOptions === "string" ? componentClass : self;
      if (typeof tagNameOrOptions === "string") {
        ctor.tag = tagNameOrOptions;
        ctor.template = options?.template ?? "";
        if (options?.events !== undefined) {
          ctor.events = options.events;
        }
        ctor.css = options?.css ?? "";
        if (options?.globalStore !== undefined) {
          TemplesComponent.globalStore = options.globalStore;
        }
      } else if (tagNameOrOptions?.globalStore !== undefined) {
        TemplesComponent.globalStore = tagNameOrOptions.globalStore;
      }
      TemplesComponent.resolveTemplate(ctor);
      TemplesComponent.registerEventTypes(ctor);
      customElements.define(ctor.tag, ctor);
    }
    static registerEventTypes(ctor) {
      for (const binding of Object.keys(ctor.events)) {
        const space = binding.indexOf(" ");
        if (space === -1)
          continue;
        TemplesComponent.ensureDocumentListener(binding.slice(0, space));
      }
    }
    static ensureDocumentListener(type) {
      if (documentListeners.has(type))
        return;
      const listener = (event) => TemplesComponent.dispatch(type, event);
      document.addEventListener(type, listener);
      documentListeners.set(type, listener);
    }
    static dispatch(type, event) {
      const component = TemplesComponent.resolveComponent(event);
      if (component === null)
        return;
      for (const [binding, handler] of Object.entries(component.eventHandlers)) {
        const separator = binding.indexOf(" ");
        const bindingType = binding.slice(0, separator);
        if (bindingType !== type)
          continue;
        const selector = binding.slice(separator + 1).trim();
        if (TemplesComponent.matchesSelector(event, selector, component)) {
          handler.call(component, event);
        }
      }
    }
    static resolveComponent(event) {
      for (const node of event.composedPath()) {
        if (node instanceof TemplesComponent)
          return node;
      }
      return null;
    }
    static matchesSelector(event, selector, component) {
      for (const node of event.composedPath()) {
        if (node === component)
          return component.matches(selector);
        if (node instanceof Element && node.matches(selector))
          return true;
      }
      return false;
    }
    static resolveTemplate(ctor) {
      let template = document.head.querySelector(`template#${ctor.tag}`);
      if (template === null) {
        template = document.createElement("template");
        template.id = ctor.tag;
        template.innerHTML = ctor.template;
        document.head.appendChild(template);
      }
      return template;
    }
    connectedCallback() {
      const ctor = this.constructor;
      const template = TemplesComponent.resolveTemplate(ctor);
      const content = template.content.cloneNode(true);
      const container = document.createElement("div");
      container.appendChild(content);
      this.renderer = new Renderer(container);
      for (const name of ctor.observedAttributes) {
        if (this.hasAttribute(name)) {
          this.state[name] = this.coerceAttribute(name, this.getAttribute(name));
        } else if (TemplesComponent.globalStore !== undefined && name in TemplesComponent.globalStore) {
          this.state[name] = TemplesComponent.globalStore[name];
        }
      }
      this.unsubscribeState = subscribe(this.state, () => this.rerender());
      this.rerender();
      this.on(ctor.events);
    }
    disconnectedCallback() {
      if (this.unsubscribeState !== null) {
        this.unsubscribeState();
        this.unsubscribeState = null;
      }
      for (const unsubscribe of this.messageUnsubscribers)
        unsubscribe();
      this.messageUnsubscribers = [];
      this.eventHandlers = {};
      this.renderer = null;
      this.replaceChildren();
    }
    attributeChangedCallback(name, _oldValue, newValue) {
      this.state[name] = this.coerceAttribute(name, newValue);
      this.rerender();
    }
    emit(name, detail) {
      const ctor = this.constructor;
      dispatchMessage(`${ctor.tag}:${name}`, detail);
    }
    on(events) {
      for (const [binding, methodName] of Object.entries(events)) {
        const handler = this.resolveHandler(methodName);
        const space = binding.indexOf(" ");
        if (space === -1) {
          this.subscribeMessage(binding, handler);
        } else {
          this.eventHandlers[binding] = handler;
          TemplesComponent.ensureDocumentListener(binding.slice(0, space));
        }
      }
    }
    resolveHandler(methodName) {
      const method = this[methodName];
      if (typeof method !== "function") {
        throw new Error(`Event handler "${methodName}" is not a method of <${this.tagName}>`);
      }
      return method;
    }
    subscribeMessage(name, handler) {
      let set = messageHandlers.get(name);
      if (set === undefined) {
        set = new Set;
        messageHandlers.set(name, set);
      }
      const subscription = { component: this, handler };
      set.add(subscription);
      this.messageUnsubscribers.push(() => {
        set.delete(subscription);
      });
    }
    rerender() {
      if (this.renderer === null)
        return;
      const container = this.renderer.rootElt;
      while (this.firstChild !== null)
        container.appendChild(this.firstChild);
      this.renderer.render(this.state);
      while (container.firstChild !== null)
        this.appendChild(container.firstChild);
    }
    coerceAttribute(name, raw) {
      const ctor = this.constructor;
      const type = ctor.attributeTypes[name] ?? "string";
      switch (type) {
        case "boolean":
          return raw === null ? false : raw !== "false" && raw !== "0";
        case "number": {
          if (raw === null)
            return 0;
          const value = Number(raw);
          return Number.isNaN(value) ? raw : value;
        }
        case "json": {
          if (raw === null)
            return null;
          try {
            return JSON.parse(raw);
          } catch {
            return raw;
          }
        }
        default:
          return raw ?? "";
      }
    }
  };
});

// src/ssr.ts
import { parseHTML } from "linkedom";

// src/utilities/dom-globals.ts
var DOM_GLOBALS = [
  "window",
  "document",
  "Document",
  "DocumentFragment",
  "Element",
  "HTMLElement",
  "Node",
  "DOMParser",
  "customElements",
  "CustomElementRegistry",
  "Event",
  "CustomEvent",
  "MutationObserver",
  "ShadowRoot"
];
var extractDomGlobals = (source, keys = DOM_GLOBALS) => {
  const values = {};
  for (const key of keys)
    values[key] = source[key];
  return values;
};
var installGlobals = (values) => {
  const previous = new Map;
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, globalThis[key]);
    if (value !== undefined) {
      globalThis[key] = value;
    }
  }
  return previous;
};
var restoreGlobals = (previous) => {
  for (const [key, value] of previous) {
    if (value === undefined) {
      delete globalThis[key];
    } else {
      globalThis[key] = value;
    }
  }
};

// src/ssr.ts
var prepare = (source, { removeDataBindings = true, templesComponents = [] } = {}) => {
  assertSingleRoot(source);
  return async (data) => {
    const dom = parseHTML(source);
    const root = dom.document.documentElement;
    const previous = installGlobals(extractDomGlobals(dom));
    try {
      const { Renderer: Renderer2 } = await Promise.resolve().then(() => (init_engine(), exports_engine));
      let componentClass;
      if (templesComponents.length > 0) {
        ({ TemplesComponent: componentClass } = await Promise.resolve().then(() => (init_component(), exports_component)));
        for (const tc of templesComponents) {
          const renderClass = class extends tc {
          };
          renderClass.define({ globalStore: data });
        }
      }
      if (root === null)
        return "";
      const renderer = new Renderer2(root);
      renderer.render(data);
      if (removeDataBindings && componentClass !== undefined) {
        unwrapComponents(renderer.rootElt, componentClass);
      }
      const style = componentStyles(templesComponents);
      if (root.tagName === "HTML") {
        if (style !== "") {
          const styleElement = dom.document.createElement("style");
          styleElement.textContent = style;
          dom.document.head.appendChild(styleElement);
        }
        return dom.document.toString();
      }
      dom.document.head.remove();
      return (style !== "" ? `<style>${style}</style>` : "") + renderer.rootElt.outerHTML;
    } finally {
      restoreGlobals(previous);
    }
  };
};
var assertSingleRoot = (source) => {
  const dom = parseHTML(source);
  const root = dom.document.documentElement;
  if (root === null || root.tagName === "HTML")
    return;
  const container = dom.document.createElement("div");
  container.innerHTML = source.trim();
  if (container.children.length > 1) {
    throw new Error("Template string must have a single root element");
  }
};
var componentStyles = (components) => components.map((component) => component.css).filter(Boolean).join(`
`);
var unwrapComponents = (root, componentClass) => {
  const instances = [root, ...Array.from(root.querySelectorAll("*"))].filter((element) => element instanceof componentClass);
  for (const element of instances) {
    const parent = element.parentNode;
    if (parent === null)
      continue;
    while (element.firstChild !== null) {
      parent.insertBefore(element.firstChild, element);
    }
    parent.removeChild(element);
  }
};
export {
  prepare
};
