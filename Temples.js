/**
 * Temples.js
 * ============
 * Author: Eidolon Labs (zipang)
 * Source : http://github.com/zipang/Temples
 * Date: 2012-10-29
 * v0.2.0
 */
(function define(context, $) {

	if (!$) throw "Temples relies on a jQuery compatible DOM search engine and DOM manipulator";

	var templates = {};

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

	function comment(whattosay) {
		return $("<!--" + whattosay + "-->");
	}

	/**
	 * Access to a field in the provided object by its path
	 * @param path, ex : "article.author.name"
	 * @param data, ex : {article: {title: "", author: {..}}}
	 * @param $elt {optional} passed to invoke a plugin method that could directly update the element
	 * @return {String|Boolean}
	 */
	function evalProperty(path, data, $elt) {
		var key, parent, found = data,
			steps = (path || "").trim().split(".");
		while (found && (key = steps.shift())) {
			parent = found;
			found = found[key];
		}
		return (typeof found == "function") ? found.call(parent, $elt) : found || "";
	}

	// Renderer base prototype

	/**
	 * Prototype of all Renderers
	 * @constructor
	 */
	function Renderer() {}
	Renderer.prototype = {
		/**
		 * Cause all the bindings to render their elements with the provided data
		 */
		render:function (data) {
            var bindings = this.bindings,
                l = bindings.length;
			for (var i = 0; i < l; i++) {
				bindings[i](data);
			}
			return this.$root;
		},
		/**
		 * Render the data and output the flat HTML
		 * @return {String} 
		 */
		output:function (data) {
			return this.render(data).html();
		},
		/**
		 * Exports the current HTML rendering
		 * @return {String} 
		 */
		toHtml:function () {
			return this.$root.html();
		},
		destroy:function () {
			this.bindings = this.$root = null;
		}
	};


	/**
	 * The most simple of all renderers
	 * Works only with one element and one attribute
	 */
	function AttributeRenderer($elt, expr) {
		this.$root = $elt;
		this.bindings = [Bindings.updater($elt, expr)];

	}
	AttributeRenderer.prototype = new Renderer();
    AttributeRenderer.prototype.toString = function() {
        return "AttributeRenderer(" + displayNode(this.$root) + ")";
    };

	/**
	 * Deals with multiple attributes bindings
	 * on a single element
	 * @param dataBindExpr a comma separated list of binding expressions
	 */
	function SimpleElementRenderer($elt, dataBind) {
		this.$root = $elt;
		var bindings = this.bindings = [],
            expr, exprList = dataBind.split(",");
		while (expr = exprList.pop())
			bindings.push(Bindings.updater($elt, expr.trim()));
	}
	SimpleElementRenderer.prototype = new Renderer();
    SimpleElementRenderer.prototype.toString = function() {
        return "SimpleElementRenderer(" + displayNode(this.$root) + ")";
    };

	/**
	 * Deals with multiple attributes bindings
	 * on a single element with a condition
	 * @param dataBindExpr a comma separated list of binding expressions
	 */
	function ConditionalElementRenderer($elt, cond, dataBind) {
        if (!arguments.length) return; // to use as empty prototype

		this.$root = $elt;
		this.condition = cond;
		var conditionalbindings = this.conditionalbindings = [];

        if (dataBind) {
            var exprList = dataBind.split(",");
            for (var i = 0, expr; expr = exprList[i++];) {
                conditionalbindings.push(Bindings.updater($elt, expr.trim()));
            }
        }

        var self = this; // bindings methods must allways be created within a closure so that they do not depend on the 'this' keyword
        this.bindings = [function(data) {
            if (evalProperty(cond, data)) {
                for (var i = 0, render; render = conditionalbindings[i++];) {
                    render(data);
                }

                self.reappear();
            } else {
                // replace our element with a vibrant placeholder
                self.disappear("Temples says: " + cond + "=false");
            }
        }];
	}
	$.extend(
		ConditionalElementRenderer.prototype = new Renderer(),
		{
			disappear: function(why) {
				if (!this.placeHolder) {
					this.$root.replaceWith(
						this.placeHolder = comment(why)
					)
				}
			},
			reappear: function() {
				if (this.placeHolder) {
					this.placeHolder.replaceWith(this.$root);
					this.placeHolder = null;
				}
			}
		}
	); // ConditionalElementRenderer.prototype
    ConditionalElementRenderer.prototype.toString = function() {
        return "ConditionalElementRenderer(" + displayNode(this.$root) + " if " + this.condition + ")";
    };


	/**
	 * A specific type of Renderer that iterates 
	 * a sub template over values of a collection
	 * 
	 * @param $elt
	 * @param loopExpr value of 'data-iterate' or 'data-each'
	 * the loop expression has the following forms :
	 * - "blog.articles"        	  // 'article' will automatically be derived as the variable to bind
	 * - "child from family.children" // 'child' is explicitely designed to be the variable bound in the loop
	 * - "tag : article.tags"         // ':' or 'from' are synonyms
     * @param cond {optional}
     * @param dataBind {optional}
	 * @constructor
	 */
	function ListRenderer($elt, loopExpr, cond, dataBind) {

        this.$root = $elt;
        // the first child block of an ListRenderer is the template used to loop on collection items
        var template = this.template = new TemplateRenderer($elt.children().first());

		// Parse the loop expression
		var expr  = loopExpr.replace("from", ":"), // from and ':' are equivalents
			parts = expr.split(":"),
			collectionPath = parts[1] || parts[0];

		// the seed is the name of the collection to iterate on
		var seed = this.seed = collectionPath.trim();

		// several syntax variants are allowed
		if (parts.length == 2) { // <varName> : <path.to.collection>
			this.varName = parts[0].trim();

		} else { // extract the variable name from the last member of the collection path
			this.varName = this.seed.split(".").pop();  // the last part of the path
			this.varName = this.varName.replace(/s*$/, ""); // remove trailing s
		}

        // Define the bindings
        var varName = this.varName;

        ConditionalElementRenderer.call(this, $elt, cond, dataBind);

        // render the line template if the condition is passed
        this.conditionalbindings.push(function(data) {
            var collection = evalProperty(seed, data);

            $elt.empty();
            for (var i = 0, l = collection.length; i < l; i++) {
                // Add the item's value to the data object
                data[varName] = collection[i];
                $elt.append(template.render(data).clone()); // render the line template and add it to the root
            }
            delete data[varName];

        });
    }
	ListRenderer.prototype = new ConditionalElementRenderer();
    ListRenderer.prototype.toString = function() {
        return "ListRenderer(" + displayNode(this.$root) + ")";
    };


	/**
	 * Renderer utils
	 */
	Renderer.isListRenderer = ListRenderer.loopExpression = function($elt) {
		try {
			return $elt.attr("data-iterate") || $elt.attr("data-each");
		} catch (err) {
			return ""; // needed when using jquip on window.document
		}
	};

	function TemplateRenderer($elements) {
		this.$root = $elements;
		var bindings = this.bindings = [];

		$elements.each(function(i, elt) {
			var $targets = Renderer.targets($(elt));
			$targets.each(function(i, elt) {
				var renderer = Renderer.Factory($(elt));
				Array.prototype.push.apply(bindings, renderer.bindings);
            });
		});
	}
    TemplateRenderer.prototype = new Renderer();
    TemplateRenderer.prototype.toString = function() {
        return "TemplateRenderer(" + displayNode(this.$root) + ")";
    };

	Renderer.targets = function($root) {

		// find all data-bound child from this root element
		var isRenderer = function() {
                return ($(this).attr("data-bind") || $(this).attr("data-render-if"));
            }, firstLevel = function () { // filter elements not contained in any ListRenderer
                return ($(this).parentsUntil($root, "[data-iterate], [data-each]").length == 0);
            };


		// bind the first level ListRenderer
		if (Renderer.isListRenderer($root)) {
			return $root;

		} else {
			return $root.filter(isRenderer)
                .add( // simple bound elements
                    $("*[data-bind], *[data-render-if]", $root)
                        .filter(firstLevel)
                )
                .add( // iterators
                    $("*[data-iterate], *[data-each]", $root)
                        .filter(firstLevel)
                );
		}
	}

	// FACTORIES

	// Bindings factory
	var Bindings = {

		/**
		 * Build a parametrized function(data) that updates an element attributes or inner content
		 * with the property described by its path when the provided condition is true
		 *
		 * @param $elt element to bind
		 * @param expr : [text|html|value|<attribute_name>]=<path.to.data>
		 * Examples :
		 * - "author.name"
		 * - "class[article|quote]=article.type"
		 * - "href=article.source"
		 * @param condition <path.to.data>
		 * @return {Function} a function bound to the element to update
		 */
		updater: function ($elt, expr) {

			console.log("Binding '" + expr + "' for element " + displayNode($elt));

			var exprParts = expr.split("=");

			if (exprParts.length == 1) { // the target property or attribute is not specified
				var path = exprParts[0],
					tagName = $elt[0].tagName.toLowerCase(); // normalize the name of the tag ('div', 'input', 'select', etc..)

				if ("input|select".indexOf(tagName) != -1) {
					return function (data) {
						$elt.val(evalProperty(path, data, $elt));
					};
				} else {
					return function (data) {
						$elt.html(evalProperty(path, data, $elt));
					};
				}

			} else {
				var attr = exprParts[0].toLowerCase(), path = exprParts[1];

				if (attr.indexOf("class") == 0) {
					// find an enumeration of classes : class[a|b|c]
					var classes = /\[([\w|\|]+)\]/g.exec(attr);
					if (classes) {
						classes = classes[1].split("|").join(" ");
						return function (data) {
							$elt.removeClass(classes);
							$elt.addClass(evalProperty(path, data, $elt));
						};
					} else {
						return function (data) {
							$elt.attr("class", evalProperty(path, data, $elt));
						};
					}
				} else if ("text|html|value".indexOf(attr) != -1) {
					return function (data) {
						$elt[attr](evalProperty(path, data, $elt));
					};
				} else {
					return function (data) {
						$elt.attr(attr, evalProperty(path, data, $elt));
					};
				}
			}
		}
	};

	Renderer.Factory = function($elt) {
		var dataBind  = $elt.attr("data-bind"),
			condition = $elt.attr("data-render-if"),
			loopExpr  = $elt.attr("data-iterate") || $elt.attr("data-each");

        $elt.removeAttr("data-bind data-render-if data-iterate data-each");

		if (loopExpr) {
			return new ListRenderer($elt, loopExpr, condition, dataBind); 

		} else if (condition) {
			return new ConditionalElementRenderer($elt, condition, dataBind); 

		} else if (dataBind.indexOf(",") > 0) {
			return new SimpleElementRenderer($elt, dataBind); 

		} else {
			return new AttributeRenderer($elt, dataBind); 
		}
	};


	// PUBLIC API

	/**
	 * Temples facade object
	 */
	var Temples = {
		Renderer: TemplateRenderer,
		prepare: function (name, template) {
			if (!template) {
				// load template content from name
				if (name.indexOf("#") == 0) { // a DOM element ID
					template = $(name);
				} else if (name == "document") { // a DOM element ID
                    template = $("html");
                }
			}
			return (templates[name] = new Temples.Renderer(template));
		},
		destroy:function (name) {
			if (templates[name]) templates[name].destroy();
			delete templates[name];
		},
		render:function (name, data) {
			if (!data && typeof name == "object") {
				data = name; name = "document";
			}
			(templates[name] || Temples.prepare(name)).render(data);
		}
	};
	Temples.register = Temples.prepare;

	if (context === window) { // browser context
		context["Temples"] = Temples; // exports Temples under its name in the global space
	} else {
		context.exports = Temples;
	}

})(this, jQuery || ender || jquip || require("./lib/jquery4node"));
