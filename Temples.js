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
		console.log("extract Data : ", data, path, found);
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

		if (renderCondition) { // the rendering of this tag is subject to the evaluation of a condition
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
	function RenderCondition($elt, expr) {

		return function(data) {
			$elt.toggle(extractData(data, expr));
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

	/**
	 * Parse a root element and its content to retrieve the bind expressions : data-bind and data-iterate
	 * Then store them in a collection of rendering methods ready to be called on the data to render
	 * @param $root
	 */
	Renderer.parse = function ($root) {

		var bindings = this.bindings = [], // live expressions
			isIterator = function($elt) {
				return $elt.attr("data-iterate") || $elt.attr("data-each");
			},
			notContainedInIterator = function () {
				return ($(this).parentsUntil($root, "[data-iterate], [data-each]").length == 0);
			},
			bindIterator = function (i, elt) {
				var $elt = $(elt),
					iterateExpr = $elt.attr("data-iterate") || $elt.attr("data-each"),
					template = $elt.children().first(),
					iterator = new Iterator($elt, iterateExpr, template);

				console.log("Binding iterator " + elt + " with " + iterateExpr);
				bindings.push(function (data) {
					iterator.render(data);
				});

				$elt.removeAttr("data-iterate data-each");
			},
			bind = function (i, elt) {

				var $elt = $(elt),
					renderCondition = $elt.attr("data-render-if"),
					bindExpression  = $elt.attr("data-bind");

				if (renderCondition && !bindExpression) {
					// this element has only a data-render-if attribute
					bindings.push(new RenderCondition($elt, renderCondition));
				} else {
					// each bind expression is separated by a comma ',' eventually preceded of followed by spaces
					var boundList = (bindExpression || "").split(/\s*,\s*/);
					for (var i = 0, expr; expr = boundList[i++];) {
						console.log("Binding element " + elt + " with " + expr);
						bindings.push(new Binding($elt, expr));
					}
				}

				$elt.removeAttr("data-bind data-render-if");
			};

		// bind the first level iterators
		if (isIterator($root)) {
			bindIterator(0, $root);
			bind(0, $root);

		} else {
			$root.add("*[data-bind], *[data-render-if]", $root).filter(notContainedInIterator).each(bind);
			$("*[data-iterate], *[data-each]", $root).filter(notContainedInIterator).each(bindIterator);
		}

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
		},
		toString: function() {
			return this.$root.tagName
				+ (this.$root.attr("id") ? "#" + this.$root.attr("id") : "")
				+ (this.$root.className() ? "." + this.$root.className() : "");
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
	};
	Iterator.prototype.toString = function() {
		return this.seed + " iterator "
			+ Renderer.prototype.toString.call(this);
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
