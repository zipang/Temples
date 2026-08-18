# TEMPLES USAGE EXAMPLE

This directory contains a fully working example of a web pages containg Temples components with a demonstration of every data attribute (`data-bind`, `date-iterate`, `date-render-if`).
You can an interactive test on this example by running `bun demo` from the project root or `bun --hot index.html` from this directory. 

## Directory structure

```
```

@TODO: Create a real working example with several components working together.

## Local Package

To replace an existing npm package with a local version in package.json, use the overrides field to specify a local file path.  This method effectively substitutes the original package with your local implementation for the entire dependency tree. 

{
  "overrides": {
    "Temples": "file:../dist/Temples.js"
  }
}
