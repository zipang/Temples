---
name: typescript-best-practices
description: TypeScript discipline for writing strict, honest types. Use when writing or modifying TypeScript, when designing types and interfaces, when narrowing or casting values, or when the code-review-and-quality skill flags lazy typing. Triggers include "type this", "fix this type error", "is this type safe", "should I use unknown", or any TS type-design decision.
---

# TypeScript Best Practices

## Overview

A TypeScript type is the contract between a function and its callers. Write types that describe the domain precisely. Avoid `unknown` and `any` except at true system boundaries, and justify each exception in the JSDoc. The goal: a reader can reason about a value from its type alone, without tracing the implementation.

## When to Use

- When writing or modifying TypeScript code.
- When designing types, interfaces, or recursive data shapes.
- When narrowing a value or reaching for a cast.
- When the `code-review-and-quality` skill flags lazy typing.

## Core Rules

### 1. Type the domain, not `unknown`

Name the values the function can produce or consume. A resolver that feeds DOM text, attributes, and input values produces scalars. Type it as a scalar union, not `unknown`.

Good:
```ts
export type RenderValue = string | number | boolean;
export const readProperty = (path: string, data: TemplesData): RenderValue => { /* ... */ }
```

Bad:
```ts
export const readProperty = (path: string, data: unknown): unknown => { /* ... */ }
```

### 2. `unknown` only at true boundaries

`unknown` is correct where a value has no schema: parsed JSON, external input, a generic interop seam. It is wrong where the function's purpose constrains the value. When you keep `unknown`, state the boundary in the JSDoc. If you cannot state the boundary, name a concrete union.

### 3. Prefer `interface` for recursive object shapes

A type alias that references itself through a naked union member triggers a circular-alias error (TS2456). Use an `interface` for recursive object shapes. Interfaces resolve lazily and accept the recursion. Wrap every self-reference inside an object, array, or mapped type. Never place a self-reference naked in a union.

Good:
```ts
export interface TemplesData {
	[key: string]: TemplesDataValue;
}
export type TemplesDataValue = RenderValue | ((this: TemplesData) => RenderValue) | TemplesData;
```

Bad (circular-alias error):
```ts
export type TemplesData = Record<string, TemplesDataValue>;
export type TemplesDataValue = RenderValue | ((this: TemplesData) => RenderValue) | TemplesData;
```

### 4. `type` for unions, `interface` for object contracts

Use `type` for unions, primitives, and computed shapes. Use `interface` for extensible object contracts and recursive dictionaries. Match the style of the surrounding file. Do not mix without reason.

### 5. Narrow with type guards, not casts

Use `typeof`, `instanceof`, and `in` checks to narrow a value. A cast (`as`) asserts a fact the compiler cannot verify. The cast lies if the value does not match. Reach for a cast only to inject an out-of-contract value in a test, or to coerce at a genuine boundary. State the reason in both cases.

Good (type guard, no cast):
```ts
if (typeof current === "function") {
	const result = current.call(owner);

	return result == null ? "" : result;
}
```

Acceptable (a test injects an out-of-contract value to verify a runtime guard):
```ts
const data = { fn: () => undefined } as unknown as TemplesData;
```

### 6. The return type is the contract

Do not widen a return type to avoid a narrow. If every caller coerces the result the same way, put that assumption in the signature. A return type of `unknown` forces every caller to repeat the narrowing. That is debt, not safety.

### 7. Type `this` when a function uses it

When a function is called with its owner object as `this`, declare the `this` parameter. Callers get checking and autocomplete on sibling properties.

```ts
export type TemplesDataValue = RenderValue | ((this: TemplesData) => RenderValue) | TemplesData;
```

### 8. Handle `noUncheckedIndexedAccess`

When `noUncheckedIndexedAccess` is enabled, indexing returns `T | undefined`. Handle the `undefined` case explicitly. Do not assume a key exists.

```ts
let current: TemplesDataValue | undefined = data[step];

if (current == null) return "";
```

### 9. No implicit `any`, no `as any`

`any` disables checking for the value and for everything it touches. If you cannot name a type, the boundary is unclear. Make the boundary explicit, then name the type.

## Anti-Patterns

| Rationalization | Reality |
|---|---|
| "It's typed as `unknown`, so it's safe" | `unknown` shifts every narrowing decision to each caller and hides the real contract. Name a concrete union. |
| "I'll cast here to make it compile" | A cast asserts a fact the compiler cannot verify. Narrow with a type guard, or the cast is a lie. |
| "The recursive type needs `any`" | Use an `interface` for the object shape and wrap self-references. Recursion is not a reason for `any`. |
| "The return type is `unknown` because the data varies" | If the function's purpose constrains the value, name the union. Variation is not ignorance. |
| "`noUncheckedIndexedAccess` is annoying" | It exposes real missing-key bugs. Handle the `undefined`. Do not disable the check. |

## Red Flags

- `any` or `as any` outside a generated or interop file.
- `unknown` on a return type where the function's purpose constrains the value.
- A cast (`as`) in production code without a stated boundary reason.
- A type alias that circularly references itself through a naked union member.
- Index access treated as never-`undefined` under `noUncheckedIndexedAccess`.
- A widening return type that every caller re-narrows.

## Verification

- [ ] `bun run typecheck` passes with zero errors.
- [ ] `bun run check` passes with zero errors.
- [ ] Every `unknown`, `any`, and cast is justified in the JSDoc.
- [ ] No circular-alias errors. Recursive shapes use `interface`.

## See Also

- `code-review-and-quality` — review-time typing checks reference this skill.
- `use-bun` — tooling and test runner for TypeScript in this project.
