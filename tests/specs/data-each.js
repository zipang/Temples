/**
 * Test suite for Temples
 * toBe, toNotBe, toEqual, toNotEqual, toMatch, toNotMatch, toBeDefined, toBeUndefined, 
 * toBeNull, toBeTruthy, toBeFalsy, toHaveBeenCalled, wasCalled, wasNotCalled, 
 * toHaveBeenCalledWith, wasCalledWith, wasNotCalledWith, toContain, toNotContain, 
 * toBeLessThan, toBeGreaterThan, toBeCloseTo, toThrow 
 */ 
(function() {


  describe('Temples', function() {

    afterEach(Temples.destroy);

    describe('data-each', function() {

      it('a block iterator must contain a child template', function() {
        var emptyIterator = "<ul id='articles' data-each='articles'/>", 
            prepare = function() {
              Temples.prepare("articles", emptyIterator)
            };
        expect(prepare).toThrow();
      });

      it('data-each=tags iterates over collection items to render blocks', function() {
        var template = $("<ul data-each='tags'><li data-bind='tag'/></ul>");
        Temples.prepare("tags", template),
        Temples.tags.render({tags: ["#1", "#2", "#3"]});
        expect(template.children().length).toEqual(3);
        expect(template.text()).toEqual("#1#2#3");
      });

      it('data-iterate=tags iterates over collection items to render blocks', function() {
        var template = $("<ul data-iterate='tags'><li data-bind='tag'/></ul>");
        Temples.prepare("tags", template),
        Temples.tags.render({tags: ["#1", "#2", "#3"]});
        expect(template.children().length).toEqual(3);
        expect(template.text()).toEqual("#1#2#3");
      });

      it('data-each=<var> : <collection> iterates over collection items to render blocks', function() {
        var template = $("<ul data-iterate='t: tags'><li data-bind='t'/></ul>");
        Temples.prepare("tags", template),
        Temples.tags.render({tags: ["#1", "#2", "#3"]});
        expect(template.children().length).toEqual(3);
        expect(template.text()).toEqual("#1#2#3");
      });

      it('data-each=<var> from <collection> iterates over collection items to render blocks', function() {
        var template = $("<ul data-iterate='t from tags'><li data-bind='t'/></ul>");
        Temples.prepare("tags", template),
        Temples.tags.render({tags: ["#1", "#2", "#3"]});
        expect(template.children().length).toEqual(3);
        expect(template.text()).toEqual("#1#2#3");
      });

      it("data-each doesn't render any data if data-render-if is false", function() {
        var template = $("<div><ul data-iterate='t from tags' data-render-if='condition'><li data-bind='t'/></ul></div>");
        Temples.prepare("tags", template),
        Temples.tags.render({tags: ["#1", "#2", "#3"], condition: false});
        expect(template.children().length).toEqual(0);
        expect(template.text()).toEqual("");
      });

    });
  });

}());
