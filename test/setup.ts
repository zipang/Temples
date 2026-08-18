import { parseHTML } from "linkedom";
import { extractDomGlobals, installGlobals } from "../src/utilities/dom-globals";

const dom = parseHTML("<!doctype html><html><head></head><body></body></html>");

installGlobals({
	location: { href: "http://localhost/" },
	...extractDomGlobals(dom as unknown as Record<string, unknown>)
});
