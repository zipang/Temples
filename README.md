![temples](https://raw.github.com/zipang/Temples/master/images/temples.png)

# Synopsis
Temples (templ*at*es that you won't hate) is the most easy to use templating system for HTML.
Temples is a declarative DOM-based rendering engine, depending on jQuery, that have a special ability for real-time/partial updates.
Temples are just plain old HTML pages blocks or fragments with special `data-bind` attributes.
Temples works inside the browser or with your all-time favorite [Node.js](http://nodejs.org/) environment.

# Motivations

I want a template system that :

- is easy to use, easy to read and predicable in its syntax.
- won't break my pages with ugly non-HTML syntax that isn't recognized by my IDE.
- is reliable. So that i can give my pages back to web designers so that they work on the markups, css, and they have very little chances to break it.
- can support real-time live updates of only the relevant data (without rendering the whole thing).
- is able to work seamlessly with structured data with any levels of sub-elements.

I want to :
- use genuine HTML pages, full with example text, and transform them with just the addition of a few `data-bind` attributes.
- understand how it works in 2 minutes.

# Status

[![Build Status](https://secure.travis-ci.org/zipang/temples.png)](http://travis-ci.org/zipang/temples)

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

## Data binding
To create live templates from existing HTML markups, we just have to add the `data-bind` attributes on the elements to update.
`data-bind` has a super-simple syntax but is very powerfull :

* Expressions are of the form : `[value|text|html|<attr-name>]=<path.to.some.data>`
* Multiple updates can be specified, separated by a comma ','.

Here is for example the block of markup you wish to use to display the currently logged user.

```html
<div id="logged-user">
    <img title="avatar" src="http://avatar.com/johndoe" />
    <div class="active">John DOE</div>
</div>
```

A simple binding would give us this :

```html
<div id="logged-user">
    <img data-bind="src=user.avatar, title=user.fullname" title="avatar" src="http://avatar.com/johndoe" />
    <div data-bind="user.fullname, class=user.status" class="active">John DOE</div>
</div>
```

Notice how *we don't have to get rid* of the sample text, so that the markup still displays nicely in the browser.

Depending on the context, `value=` or `html=` can be ommited so that :

```html
<div data-bind="html=user.name" />
```

is equivalent to :

```html
<div data-bind="user.name" />
```

and

```html
<input type="text" data-bind="value=user.name" />
```

is equivalent to :

```html
<input type="text" data-bind="user.name" />
```


## Data preparation

Now, you just have to prepare your data to be able to render it through the template engine.

`Temples` can easily access any structured data.
`Temples` simply follows the path to each field/method that you declared inside the `data-bind` attribute by using the dotted notation '.'.

So that a good contender for our preceding example could be :
```
{
    user: {
        firstname: "John",
        lastname: "DOE",
        fullname: function() {return this.firstname + " " + this.lastname},
        avatar: "http://avatar.com/johndoe",
        status: "active"
    }
}
```

## Template registration
To use a template, register it under a unique name and provide its content to `Temple.register()`.
The content can be a DOM id, a DOM element, or a string using the Temples syntax.

Then call the `Temples.render()` method with any structured data.

```html
<div id="logged-user">
    <span data-bind="user.firstname">John<span> <span data-bind="user.lastname">DOE<span> was here.
</div>
```

```js
var Temples = require('Temples');

Temples.register("logged-user", "#logged-user");

```

## Explicit Renderers

Another way is to explicitely build your Renderer so that you can use it directly without the need to specify its name.

```js
var myPage = new Temples.Renderer(window.document);

// Use render with the full data. Target elements not contained in the provided data will be rendered as blank (empty) elements.
myPage.render({ some: "data", more: "coming soon", ... });

// update just an element in the page
myPage.update({ "path.to.some.element: "new value" });

// later..
myPage.destroy();
```


## Collections and the `data-iterate` attribute

`Temples` can easily iterate over collections to build a list of items.
This is done with the help of the special `data-iterate` attribute that will design the collection to iterate on,
optionally name the new variable to hold the iteration value,
and will use *the first-level sub-template* to render the child elements :

Note: If no variable name is provided, `Temples` will automatically choose one by suppressing the final 's' on the collection's name.


```html
<!-- Introducing a list of quotes -->
<div data-iterate="quote: article.quotes">
    <div class="quote" data-bind="quote">I ain't a native : I was born there!</div>
</div>
<!-- Now a list of tags -->
<ul data-iterate="article.tags"><!-- Will automatically iterate on the 'tag' variable -->
    <li><a data-bind="tag.label, href=tag.url" >peace</a></li>
    <li><a href="#war">war</a></li><!-- This second list item wont be used to render the template -->
</ul>
```

```js

var dataPresenter = {
    article : {
        title: "The Great Race",
        quotes: [
            "Quiet! Citizens of Boracho! Quiet!",
            "Pardon me Mr Partner. Who is this Texas Jack?",
            "I ain't a native : I was born there!"]
        tags: ["boracho", "blake edwards", "jack lemmon", "race", "automobiles"]
        // ...
    }
];

Temples.update("article", dataPresenter);

```


### Alternate syntax:

This attribute offers several syntactical variants to suit best your expressive needs:

* `data-each` can be used in lieu et place of `data-iterate`.
* The variable name can be introduce with a ':' or with the 'from' keyword.

So that each of these iterative blocks have the same meaning: (content omitted for brevity)

```html
<div data-iterate="article.quotes">...</div>
```

```html
<div data-iterate="quote: article.quotes" >...</div>
```

```html
<div data-iterate="quote from article.quotes" >...</div>
```

```html
<div data-each="quote from article.quotes" >...</div>
```

## Conditional rendering

Another useful feature is the possibility to associate the rendering of a block element to a condition.
This is done with the `data-render-if` attribute, whose value must evaluate to a boolean condition.

```html
<!-- Displays a special icon is this article is 'featured' -->
<div class="icon" data-render-if="article.featured">
  <img src="featured.png" />
</div>

<!-- Displays another icon is this article is 'popular' -->
<div class="icon" data-render-if="article.popular">
    <img src="popular.png" />
</div>
```

The test can be done against a function if needed :

```js

var dataPresenter = {
    article : {
        featured: true,
        popular: function() {
            return (this.comments.length > 20);
        }
        // Other properties omitted for brevity...
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
