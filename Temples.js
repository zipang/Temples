/**
 * Temples.js
 * ============
 * Author: Eidolon Labs (zipang)
 * Source : http://github.com/zipang/temples
 * Date: 2012-10-17
 */
(function define(context, $) {

	if (!$) throw "Temples relies on a jQuery compatible DOM search engine and DOM manipulator";

	var templates = {}, // live templates indexed by name
		targets = {};   // targets elements indexed by their path

	// Utilities

	/**
	 * Access to a field in the provided object by its path
	 * @param data
	 * @param path, ex : "article.author.name"
	 */
	function extractData(data, path, $elt) {
		var key, parent, found = data,
			steps = (path || "").trim().split(".");
		while (found && (key = steps.shift())) {
			parent = found;
			found = found[key];
		}
		return (typeof found == "function") ? found.call(parent, $elt) : found || "";
	}

	// Helper classes

	/**
	 * Factory for binding methods
	 *
	 * @param $elt element to bind
	 * @param expr
	 * Binding expressions are of the form :
	 * [text|value|<attribute_name>]=<path.to.data>
	 * Examples :
	 * - "author.name"
	 * - "class=article.type"
	 * - "href=article.source"
	 * @return {Function} a function bound to the element to update
	 * @constructor
	 */
	function SimpleBinding($elt, expr) {
		var exprParts = expr.split("=");

		if (exprParts.length == 1) {
			var path = exprParts[0],
				tagName = $elt[0].tagName.toLowerCase(); // normalize the name of the tag ('div', 'input', 'select', etc..)
			if ("input|select".indexOf(tagName) != -1) {
				return function (data) {
					$elt.val(extractData(data, path, $elt));
				};
			} else {
				return function (data) {
					$elt.html(extractData(data, path, $elt));
				};
			}

		} else {
			var attr = exprParts[0].toLowerCase(), path = exprParts[1];
			if (attr == "class") {
				return function (data) {
					$elt.addClass(extractData(data, path, $elt));
				};
			} else if ("text|html|value".indexOf(attr) != -1) {
				return function (data) {
					$elt[attr](extractData(data, path, $elt));
				};
			} else {
				return function (data) {
					$elt.attr(attr, extractData(data, path, $elt));
				};
			}
		}
	}
	function Binding($elt, expr) {

		var update = new SimpleBinding($elt, expr),
			renderCondition = $elt.attr("data-render-if");

		if (renderCondition) { // the rendering of this tag is subkect to the evaluation of a condition
			return function(data) {
				if (extractData(data, renderCondition))  {
					update(data);
					$elt.show();
				} else {
					$elt.hide();
				}
			}
		} else {
			return update;
		}
	}

	/**
	 * A Renderer is the live instance of a static template
	 * It is a DOM representation of the template
	 * with a bounded list of nodes ready to be updated
	 * @param content
	 * @constructor
	 */
	function Renderer(content) {
		if (!content) return; // allow empty new Renderer() to be used as prototype for Iterator()

		this.$root = $(content);
		Renderer.parse.call(this, this.$root);
	}

	Renderer.parse = function ($root) {
		// parse the bind expressions of each live element
		var bindings = this.bindings = [],
			notContainedInIterator = function () {
				return ($(this).parentsUntil($root, "[data-iterate]").length == 0);
			};

		// bind the isolated elements not part of an iterator
		$("*[data-bind]", $root)
			.filter(notContainedInIterator)
			.each(function (i, elt) {
				var $elt = $(elt),
					bindList = $elt.attr("data-bind").split(/\s*,\s*/); // separator is a comma ',' eventually preceded of followed by spaces

				for (var i = 0, expr; expr = bindList[i++];) {
					console.log("Binding element " + $elt[0] + " with " + expr);
					bindings.push(new Binding($elt, expr));
				}
			});

		// bind the first level iterators
		$("*[data-iterate], *[data-each]", $root)
			.filter(notContainedInIterator)
			.each(function (i, elt) {
				var $elt = $(elt),
					iterateExpr = $elt.attr("data-iterate") || $elt.attr("data-each"),
					template = $elt.children()[0],
					iterator = new Iterator($elt, iterateExpr, template);

				console.log("Binding iterator " + $elt[0] + " with " + iterateExpr);
				bindings.push(function (data) {
					iterator.render(data);
				});
			});

	}
	Renderer.prototype = {
		render:function (data) {
			for (var i = 0, bindings = this.bindings, render; render = bindings[i++];) {
				render(data);
			}
			return this.$root;
		},
		output:function (data) {
			this.render(data).html();
		},
		toHtml:function () {
			return this.$root.html();
		},
		destroy:function () {
			this.bindings = this.$root = null;
		}
	};

	/**
	 * A specific type of Renderer that iterates a sub template over values of a collection
	 * @param $elt
	 * @param expr loop expression
	 * Example :
	 * - "articles"        // 'article' will automatically be derivced as the variable to bind
	 * - "a from articles" // 'a' is explicitely designed to be the variable bound in the loop
	 * - "a : articles"    // same as below
	 * @param template
	 * @constructor
	 */
	function Iterator($elt, expr, template) {
		this.$root = $elt;
		this.template = new Renderer(template);

		var exprParts = expr.split(/\s*:\s*|\s*from\s*/); // we expect <var> : <collection>

		if (exprParts.length == 1) { // simply <collection> was passed
			this.seed = exprParts[0]; // path to the collection
			var varName = exprParts[0].split(".").pop().split(""),
				shouldBeS = varName.pop();
			if (shouldBeS != "s") {
				throw "'data-iterate' expect to loop on a 's variable name !\n"
					+ "Provide a variable name '<var> : <collection>' if the collection name doesn't end with an s";
			}
			this.variableName = varName.join(""); // Get rid of last letter 's'
		} else {
			this.variableName = exprParts[0];
			this.seed = exprParts[1];
		}
	}

	Iterator.prototype = new Renderer();
	Iterator.prototype.render = function (data) {
		var collection = extractData(data, this.seed),
			itemKey = this.variableName;

		this.$root.empty(); // clear all

		// Add loop variable to data
		for (var i = 0, item; item = collection[i++];) {
			data[itemKey] = item;
			this.$root.append(this.template.render(data).clone()); // render the line template and add it to the root
		}
		delete data[itemKey];
	}


	// Façade
	var Temples = {
		Renderer:Renderer,
		register:function (name, template) {
			if (!template) {
				// load template content from name
				if (name.indexOf("#") == 0) { // a DOM element ID
					template = $(name);
				}
			}
			return (templates[name] = new Renderer(template));
		},
		destroy:function (name) {
			if (templates[name]) templates[name].destroy();
			delete templates[name];
		},
		render:function (name, data) {
			(templates[name] || Temples.register(name)).render(data);
		}
	};

	if (context === window) { // browser context
		context["Temples"] = Temples; // exports Temples under its name in the global space
	} else {
		context.exports = Temples;
	}

})(this, this.jQuery || this.ender || this.jquip || require("jQuery"));
