![temples](https://raw.github.com/zipang/Temples/master/images/temples.png)

# Synopsis
Temples (templ*at*es that you won't hate) is the most easy to use templating system for HTML.
Temples is a declarative DOM-based rendering engine, depending on jQuery, that have a special ability for real-time/partial updates.
Temples are just plain old HTML pages blocks or fragments with special `data-bind attributes`
Temples work inside the browser or with your all-time favorite [Node.js](http://nodejs.org/) environment.

# Motivations

I want a template system that :

- is easy to use, easy to read and predicable in its syntax.
- won't break my pages with ugly non-HTML syntax that isn't recognized by my IDE.
- is reliable. So that i can give my pages back to web designers so that they work on the markups, css, and they have very little chances to break it.
- can support real-time live updates of only the relevant data (without rendering the whole thing).
- is able to work seamlessly with structured data with any levels of sub-elements.

I want to :
- use genuine HTML pages, full with example text, and transform them with just the addition of a few `data-bind attributes.
- understand how it works in 2 minutes.

# Status

[![Build Status](https://secure.travis-ci.org/flatiron/temples.png)](http://travis-ci.org/flatiron/temples)

# Features

- Fully HTML5 compliant. Won't break your pages.
- Declarative bindings.
- Sub-templates use the same syntax to render the complexity of structured data.
- Can be used in Node.JS (with a special Jquery lite module) for server-side template rendering.

# Installation
There are a few ways to use `temples`.

##In the browser :
Just include the `temples.js` script after jQuery.

```html
<script src="http://code.jquery.com/jquery.js"></script>
<script src="my/path/to/temples.js"></script>
```

##With node.js :
Install the library using npm or add it to your `package.json` file as a dependancy,
then, simply do

```js
var Temples = require("Temples");
```


# Usage

## Template registration
To re-use being able to use it, `temples` will try to match the key in the data to an `id` in the
tag, since both should be unique.

```js
var Temples = require('Temples');

Temples.register("hello", '<div id="test">Old Value</div>');
var data = { "test": "New Value" };

var output = temples.bind(html, data);
```

## Explicit constructions
Another way is to build the template's renderer and to keep an handle on it for later re-use and disposal.

```js
var myPage = new Temples.Renderer(window.document);

// Use the provided data to render the full page
myPage.render({ some: "data", more: "to come", ... });

// update just an element in the page
myPage.update({ "some": "new value" });

// later..
myPage.destroy();
```



## Collections

Temples can easily iterate over collections and build a list of items, with a special `data-iterate` attribute that will design the collection,
and will use the first level sub-template to render the child elements :

```html
<ul id="tags" data-iterate="article.tags">
    <li><a data-bind="tag.label, href=tag.url" >war</a></li>
    <li><a href="#war">war</a></li><!-- This second list item is an example that will not be used to render the template -->
</ul>
```

```js

var dataPresenter = {
    article : {
        title: "Why did Steve Job leave the train ?",
        tags: ["lolcats", "steve sander"],
        // ...
    }
];

Temples.update("article", dataPresenter);

```


# API

## Temples Static Methods

```
function Temples.register(name, template)
@param name {String} A string of well-formed HTML.
@param template {String} The DOM id, path, or content of an HTML template.

@return {Renderer} A compiled template, ready to use to render data.
```

```
function Temples.render(name, data)
@param name {String} The name of a registered template.
@param data {Object} The strutured data to render.

@return {DOMElement} the updated template DOM, to allow insertion, clone, or serialization.
```

## Renderer Constructor

```
function Temples.Renderer(template)
@options {String} The DOM id, path, or content of an HTML template.
  - @option where {String} The default attribute to match on instead of ID.
  - @option as {String} The default attribute to replace into.
@return {Object} An object that represents a reusable map, has mapping methods.
```

## Renderer Instance Methods

### render()

```
function Renderer#render(data)
@param data {Object} The strutured data to render..

This method will update all binded elements with the values found (or not found) in the provided data.
Therefore, the lack of data for a binded element will resume in a blank ('') rendering.
```

### update()

```
function Renderer#update(expr, ...)
@param [expr] {Object} A list of updates : {pathToData : newValue}.

Update the template with just the elements passed. All other binded values keep their state.
This method allows for real-time partial updates and is ideally suited to receive pushed notifications from the server.
```

### toHtml()

```
function Renderer#toHtml()
@return {String} The serialized HTML representation of the current template.
```

### destroy()

```
function Renderer#destroy()

Suppress a registered template, and free al lbinded elements.
Needed to fight the Zombie Templates syndrom.
```


# License

(The MIT License)

Copyright (c) 2012 Eidolon Labs. http://eidolon-labs.com

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the 'Software'), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
