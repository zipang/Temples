/**
 * Test suite for Temples
 * toBe, toNotBe, toEqual, toNotEqual, toMatch, toNotMatch, toBeDefined, toBeUndefined, 
 * toBeNull, toBeTruthy, toBeFalsy, toHaveBeenCalled, wasCalled, wasNotCalled, 
 * toHaveBeenCalledWith, wasCalledWith, wasNotCalledWith, toContain, toNotContain, 
 * toBeLessThan, toBeGreaterThan, toBeCloseTo, toThrow 
 */ 
(function() {

  // HTML Fragments (template blocks)
  var templateBlocks = {
    h1 : "<h1 data-bind='title'></h1>",
    h2 : "<h2>Curated by <span data-bind='author.fullName'></span></h2>",
    articles : "<div data-each='articles' />",
    tagIterate : "<ul id='tags' data-iterate='tag : articles.tags'>"
         + "<li data-bind='tag'>tic</li><li>tac</li>" + "</ul>",
    tagEach : "<ul id='tags' data-each='articles.tags'>"
         + "<li data-bind='tag'>tic</li><li>tac</li>" + "</ul>",
    resume : "<div data-render-if='article.resume' data-bind='article.resume' />",
    article : "<div class='article row' data-bind='article.content,class[fiction|quote|tweet]=article.type' />"
  }

  // Test Data
  var blogData = {
    title: "This is My Life",
    author: {
      firstName: "Vince",
      lastName: "Voe",
      fullName: function() {return this.firstName + " " + this.lastName;} 
    },    
    articles: [
      {
        title: "The shortest science fiction story",
        type: "fiction",
        author: "Frederic Brown",
        tags: ["mystery", "science", "fiction"],
        resume: "The Last Man on (...)",
        content: "The Last Man on Earth was at home. Someone knocked at the door."
      }, {
        title: "",
        type: "quote",
        author: "Groucho Marx",
        tags: ["humour", "marx brothers"]
      }
    ]
  };

  describe('Temples', function() {

    describe('.prepare() and .destroy()', function() {

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
      });

    });

    describe('data-bind', function() {
      beforeEach(function() {
        // Suppress all defined templates
        Object.keys(templateBlocks).forEach(function(key) {
          Temples.prepare(key, templateBlocks.key);
        });
      });

      afterEach(function() {
        // Suppress all defined templates
        Object.keys(templateBlocks).forEach(function(key) {
          Temples.destroy(key);
        });
      });

    })

  });
}());
