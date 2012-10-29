/**
 * Temples.js
 * ============
 * Author: Eidolon Labs (zipang)
 * Source : http://github.com/zipang/Temples
 * Date: 2012-10-17
 * v0.1.1
 */
(function define(context, $) {

	if (!$) throw "Temples relies on a jQuery compatible DOM search engine and DOM manipulator";

	var templates = {}; // live templates indexed by name

	// Utilities

	// shims
	if (!console) window.console = {log: function() {}};

	/**
	 * returns a convenient string representation for a DOM element
	 * @param $elt
	 * @return {String}
	 */
	function displayNode($elt) {
		var tagName = $elt.prop("tagName").toLowerCase(),
			id = $elt.attr("id"), className = $elt.attr("class");
		return tagName + (id ? "#" + id : "") + (className ? "." + className : "");
	}

	/**
	 * Access to a field in the provided object by its path
	 * @param data
	 * @param path, ex : "article.author.name"
	 * @param $elt optionally passed when the property is a method indeed
	 * @return {String|Boolean}
	 */
	function evalProperty(data, path, $elt) {
		var key, parent, found = data,
			steps = (path || "").trim().split(".");
		while (found && (key = steps.shift())) {
			parent = found;
			found = found[key];
		}
		console.log("extract Data : ", data, path, ">", found);
		return (typeof found == "function") ? found.call(parent, $elt) : found || "";
	}

	// Bindings factory
	var Bindings = {

		/**
		 * Build a parametrized function(data) that will hide or show the element according to the boolean value
		 * of <condition> in <data>
		 * @param $elt
		 * @param condition
		 * @return {Function} a function bound to the element to update
		 */
		toggler: function ($elt, condition) {

			return function(data) {
				$elt.toggle(evalProperty(data, condition));
			};
		},

		/**
		 * Build a parametrized function(data) that updates an element attributes or inner content
		 * with the property described by its path when the provided condition is true
		 *
		 * @param $elt element to bind
		 * @param expr : [text|html|value|<attribute_name>]=<path.to.data>
		 * Examples :
		 * - "author.name"
		 * - "class=article.type"
		 * - "href=article.source"
		 * @param condition <path.to.data>
		 * @return {Function} a function bound to the element to update
		 */
		updater: function ($elt, expr, condition) {

			console.log("Binding '" + expr + "' for element " + displayNode($elt));

			var binding, exprParts = expr.split("=");

			if (exprParts.length == 1) { // the target property or attribute is not specified
				var path = exprParts[0],
					tagName = $elt[0].tagName.toLowerCase(); // normalize the name of the tag ('div', 'input', 'select', etc..)

				if ("input|select".indexOf(tagName) != -1) {
					binding = function (data) {
						$elt.val(evalProperty(data, path, $elt));
					};
				} else {
					binding = function (data) {
						$elt.html(evalProperty(data, path, $elt));
					};
				}

			} else {
				var attr = exprParts[0].toLowerCase(), path = exprParts[1];

				if (attr == "class") {
					binding = function (data) {
						$elt.addClass(evalProperty(data, path, $elt));
					};
				} else if ("text|html|value".indexOf(attr) != -1) {
					binding = function (data) {
						$elt[attr](evalProperty(data, path, $elt));
					};
				} else {
					binding = function (data) {
						$elt.attr(attr, evalProperty(data, path, $elt));
					};
				}
			}

			if (condition) { // wrap the binding with a conditional rendering
				return function(data) {
					if (evalProperty(data, condition))  {
						binding(data);
						$elt.show();
					} else {
						$elt.hide();
					}
				}
			}
			return binding;
		}

	};


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
		Renderer.bindContent.call(this, this.$root);
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
	 * @constructor
	 */
	function Iterator($elt) {
		this.$root = $elt;

		// the first child block of an iterator is a special renderer used to loop on collection items
		this.template = new Renderer($elt.children().first());
		// parse the loop expression
		Iterator.extractLoop(Iterator.loopExpression($elt), this);
	}
	Iterator.prototype = new Renderer();

	/**
	 * Override the render method with a loop on the collection
	 * @param data
	 */
	Iterator.prototype.render = function (data) {
		var collection = evalProperty(data, this.seed),
			key = this.varName;

		this.$root.empty(); // clear all

		// Add loop variable to data
		for (var i = 0, item; item = collection[i++];) {
			data[key] = item;
			this.$root.append(this.template.render(data).clone()); // render the line template and add it to the root
		}
		delete data[key];
	};

	/**
	 * Iterator utils
	 * the loop expression in 'data-iterate' or 'data-each' has the following forms :
	 * - "blog.articles"        	  // 'article' will automatically be derived as the variable to bind
	 * - "child from family.children" // 'child' is explicitely designed to be the variable bound in the loop
	 * - "tag : article.tags"         // ':' or 'from' are synonyms
	 */
	Renderer.isIterator = Iterator.loopExpression = function($elt) {
		try {
			return $elt.attr("data-iterate") || $elt.attr("data-each");
		} catch (err) {
			return ""; // needed when using jquip on window.document
		}
	};
	Iterator.extractLoop = function(loopExpr, dest) {
		var expr  = loopExpr.replace("from", ":"),
			parts = expr.split(":"),
			collectionPath = parts[1] || parts[0];

		dest.seed = collectionPath.trim();

		if (parts.length == 2) { // <varName> : <path.to.collection>
			dest.varName = parts[0].trim();

		} else { // extract the variable name from the last membe of the collection path
			dest.varName = dest.seed.split(".").pop();  // the last part of the path
			dest.varName = dest.varName.replace(/s*$/, ""); // remove trailing s
		}
	}

	/**
	 * The main plat de résistance:
	 * Parse a root element and its content to retrieve the bind expressions : data-bind and data-iterate
	 * Then store them in a collection of rendering methods ready to be called on the data to render
	 * @param $root
	 */
	Renderer.bindContent = function ($root) {

		var bindings = this.bindings = [], // live expressions
			firstLevel = function () { // filter first level elements (not contained in an iterator)
				return ($(this).parentsUntil($root, "[data-iterate], [data-each]").length == 0);
			},
			bindIterator = function (i, elt) {
				var $elt = $(elt), iterator = new Iterator($elt);

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
					bindings.push(Bindings.toggler($elt, renderCondition));

				} else {
					// each bind expression is separated by a comma ',' eventually preceded of followed by spaces
					var boundList = (bindExpression || "").split(/\s*,\s*/);
					for (var i = 0, expr; expr = boundList[i++];) {
						bindings.push(Bindings.updater($elt, expr, renderCondition));
					}
				}

				$elt.removeAttr("data-bind data-render-if");
			};

		// bind the first level iterator
		if (Renderer.isIterator($root)) {
			$root.each(bindIterator).each(bind);

		} else {
			$("*[data-bind], *[data-render-if]", $root).filter(firstLevel).add($root).each(bind);
			$("*[data-iterate], *[data-each]", $root).filter(firstLevel).each(bindIterator);
		}
	}


	/**
	 * Temples facade object
	 */
	var Temples = {
		Renderer:Renderer,
		prepare:function (name, template) {
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
			var dom;
			if (!data && typeof name == "object") {
				data = name;
				dom = Temples.prepare(name = "window.document", $("html"));
			}
			(dom || templates[name] || Temples.prepare(name)).render(data);
		}
	};
	Temples.register = Temples.prepare;

	if (context === window) { // browser context
		context["Temples"] = Temples; // exports Temples under its name in the global space
	} else {
		context.exports = Temples;
	}

})(this, this.jQuery || this.ender || this.jquip || require("./lib/jquery4node"));
