# TEMPLES USAGE EXAMPLE

This directory contains a fully working example of a web pages containg Temples components with a demonstration of every data attribute (`data-bind`, `date-iterate`, `date-render-if`).
You can an interactive test on this example by running `bun demo` from the project root or `bun --hot index.html` from this directory. 

## Directory structure

```
```

@TODO: Create a real working example with several components working together.

## Local package imports

The example imports the package by name, e.g. `import { TemplesComponent } from "@temples/components"`. Two config files make the name resolve to the local `dist/` build:

- The root `tsconfig.json` maps each `@temples/*` subpath to its `.d.ts` declaration file, so `tsc --noEmit` type checks against the real API.
- `tsconfig.json` in this directory maps the same subpaths to the built `.js` files, so Bun resolves them at runtime when running the demo.

Run `bun run build` at the project root first so the `dist/` files exist, then launch the demo with `bun demo`.
