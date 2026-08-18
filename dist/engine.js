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
init_engine();

export {
  Renderer
};
