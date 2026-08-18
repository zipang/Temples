/**
 * Value that flows from data into a rendered DOM node.
 *
 * Text content, attributes, and input values are all scalar: strings,
 * numbers, and booleans. `null` and `undefined` clear a binding. Objects and
 * functions are not meaningful rendered values, so the resolver contract
 * excludes them.
 */
export type RenderValue = string | number | boolean | null | undefined;
/**
 * The recursive dictionary shape that Temples renders against.
 *
 * Every key is a string. Every value is a scalar, a parameterless function
 * that returns a scalar, or another dictionary of the same shape. Declared as
 * an interface so the recursive reference resolves without a circular-alias
 * error.
 */
export interface TemplesData {
    [key: string]: TemplesDataValue;
}
/**
 * A value held in a Temples data dictionary.
 *
 * A value is a scalar (`RenderValue`), a parameterless function returning a
 * scalar, a nested dictionary, or an array of values. The function is called
 * with its owner dictionary as `this`, so methods can reference sibling
 * properties. Arrays feed `data-iterate`.
 */
export type TemplesDataValue = RenderValue | ((this: TemplesData) => RenderValue) | TemplesData | TemplesDataValue[];
/**
 * Standalone, DOM-based renderer for a single template.
 *
 * Parses the template source once into a DOM element and collects every
 * binding. Each render call applies only the bindings whose paths resolve in
 * the provided data.
 */
export declare class Renderer {
    readonly rootElt: Element;
    private readonly bindings;
    constructor(source: Element | string);
    /**
     * Render the bindings whose paths are present in the provided data.
     *
     * Every binding is applied when its path resolves in the data. A path
     * absent from the data keeps its current state. A partial dictionary
     * re-renders only the paths it carries, while a full dictionary
     * re-renders every present path.
     *
     * @param data - Data dictionary; the paths it carries are rendered.
     * @returns The rendered root element.
     */
    render(data: TemplesData): Element;
    /**
     * Update a single path and re-render only the bindings bound to it.
     *
     * The path is written into a fresh nested dictionary, e.g. `"article.title"`
     * yields `{ article: { title: value } }`, and only the operations bound to
     * that exact path are applied. All other bindings keep their current state.
     *
     * @param path - Dotted path to the property, e.g. `"article.title"`.
     * @param value - The value to assign to the property.
     * @returns The rendered root element.
     */
    update(path: string, value: TemplesDataValue): Element;
    /**
     * Serialize the rendered root to an HTML string.
     *
     * The root element is the template root, so its outer HTML carries every
     * rendered binding. Control attributes were removed at construction, so the
     * markup stays clean.
     *
     * @returns The serialized HTML of the root element.
     */
    toHtml(): string;
    /**
     * Serialize the rendered root to an HTML string.
     *
     * Synonym for `toHtml()`.
     *
     * @returns The serialized HTML of the root element.
     */
    renderToString(): string;
}
