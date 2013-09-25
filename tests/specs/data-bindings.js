/**
 * Test suite for Temples
 * toBe, toNotBe, toEqual, toNotEqual, toMatch, toNotMatch, toBeDefined, toBeUndefined, 
 * toBeNull, toBeTruthy, toBeFalsy, toHaveBeenCalled, wasCalled, wasNotCalled, 
 * toHaveBeenCalledWith, wasCalledWith, wasNotCalledWith, toContain, toNotContain, 
 * toBeLessThan, toBeGreaterThan, toBeCloseTo, toThrow 
 */ 
(function() {

  // HTML Fragments (template blocks)
  var templateBlocks;
  function initTemplates() {
    var tag = $("<a data-bind='tag,href=tag,title=tag'></a>");
    templateBlocks = {
      h1 : $("<h1 data-bind='title'></h1>"),
      h2 : $("<h2>Curated by <span data-bind='author.fullName'></span></h2>"),
      tag: tag,
      // tagIterate : "<ul id='tags' data-iterate='tag : articles.tags'>"
      //      + "<li data-bind='tag'>tic</li><li>tac</li>" + "</ul>",
      tags : $("<ul id='tags' data-each='article.tags'>")
           .append( $("<li>").append(tag) ),
      resume : $("<p class='resume' data-render-if='article.resume' data-bind='article.resume' />"),
      article : $("<div class='article row' data-bind='article.content,class[article|fiction|quote|tweet]=article.type' />")
    };
  }

  // Test Data
  var fiction = {
        title: "The shortest science fiction story",
        type: "fiction",
        author: "Frederic Brown",
        tags: ["mystery", "science", "fiction"],
        resume: "The Last Man on (...)",
        content: "The Last Man on Earth was at home. Someone knocked at the door."
      }, 
      quote = {
        title: "",
        type: "quote",
        author: "Groucho Marx",
        tags: ["humour", "marx brothers"]
      },
      blogData = {
        title: "This is My Life",
        author: {
          firstName: "Vince",
          lastName: "Voe",
          fullName: function() {return this.firstName + " " + this.lastName;} 
        },    
        articles: [fiction, quote]
      };

  describe('Temples', function() {

    describe('.prepare() and .destroy()', function() {
      beforeEach(initTemplates);

      it('Prepare and reuse a simple template by its name', function() {
        var renderer = Temples.prepare("h1", templateBlocks.h1);
        expect(renderer.render).toBeDefined();
        expect(renderer.name).toEqual("h1");
        expect(Temples.h1).toBeDefined();
        expect(Temples.h1).toEqual(renderer);
      });

      it('Destroy a prepared template unregister it from Temples object', function() {
        Temples.prepare("h1", templateBlocks.h1);
        Temples.destroy("h1");
        expect(Temples.h1).toBeUndefined();

        var h2 = Temples.prepare("h2", templateBlocks.h2);
        h2.destroy();
        expect(Temples.h2).toBeUndefined();
      });

      it('Temples.destroy() unregister all previously prepared templates', function() {
        Temples.prepare("h1", templateBlocks.h1);
        Temples.prepare("h2", templateBlocks.h2);
        expect(Temples.h1).toBeDefined();
        expect(Temples.h2).toBeDefined();

        Temples.destroy();
        expect(Temples.h1).toBeUndefined();
        expect(Temples.h2).toBeUndefined();
      });

    });

    describe('data-bind', function() {
      beforeEach(function() {
        // Recreates and register all defined templates
        initTemplates();
        Object.keys(templateBlocks).forEach(function(key) {
          Temples.prepare(key, templateBlocks[key]);
        });
      });

      afterEach(function() {
        // Suppress all defined templates
        Object.keys(templateBlocks).forEach(function(key) {
          Temples.destroy(key);
        });
      });

      it('render simple property', function() {
        Temples.h1.render(blogData);
        expect(templateBlocks.h1.text()).toBe(blogData.title);
      });

      it('render simple function', function() {
        Temples.h2.render(blogData);
        expect(templateBlocks.h2.text()).toBe("Curated by " + blogData.author.fullName());
      });

      it('can render multiple attributes', function() {
        Temples.tag.render({tag: "tag"});
        expect(templateBlocks.tag.text()).toBe("tag");
        expect(templateBlocks.tag.attr("href")).toBe("tag");
        expect(templateBlocks.tag.attr("title")).toBe("tag");
      });

      it('render class attribute inside a range of values', function() {
        Temples.article.render({article: fiction});
        expect(templateBlocks.article.hasClass(fiction.type)).toBeTruthy();
        expect(templateBlocks.article.hasClass("article")).toBeFalsy();
        expect(templateBlocks.article.hasClass("row")).toBeTruthy();
      });

    });

  });
}());
