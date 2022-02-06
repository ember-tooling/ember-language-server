import { getFileRanges, RangeWalker, TemplateData, getScope, getPlaceholderPath } from './../../src/utils/glimmer-script';
import { TextDocument } from 'vscode-languageserver-textdocument';

function rw(tpl: string) {
  return new RangeWalker(getFileRanges(tpl));
}

describe('glimmer-scripts', function () {
  describe('getScope()', function () {
    it('able to extract scope symbols from js class file by given path', function () {
      const tpl = `
        import foo from 'bar';
        import { case } from 'ace';
        var hello = 42;
        class Boo {
          n = class Foo {
            GL
          }
        }
      `;
      const p = getPlaceholderPath(tpl, 'GL');

      expect(p.node.type).toBe('Identifier');

      const scope = getScope(p.scope);

      expect(scope).toStrictEqual(['Foo', 'Boo', 'foo', 'case', 'hello']);
    });
    it('able to extract scope from js variable notation by given path', function () {
      const tpl = `
        import boo from 'boo';
        var n = 12;
        const tpl = GL
        const tpl1 = 42;
        let oop = 'pups';
      `;
      const p = getPlaceholderPath(tpl, 'GL');

      expect(p.node.type).toBe('Identifier');

      const scope = getScope(p.scope);

      expect(scope).toStrictEqual(['boo', 'n', 'tpl', 'tpl1', 'oop']);
    });
  });

  describe('getFileRanges()', function () {
    it('support single line file', function () {
      const tpl = `<template></template>`;
      const results = getFileRanges(tpl);

      expect(results.length).toBe(1);
      expect(results[0].content).toBe('<template></template>');
      expect(results[0].start).toBe(0);
      expect(results[0].line).toBe(1);
      expect(results[0].columns).toBe(tpl.length);
    });
    it('support two line file', function () {
      const tpl = `<template>\n</template>`;
      const results = getFileRanges(tpl);

      expect(results.length).toBe(2);
      expect(results[0].content).toBe('<template>');
      expect(results[0].start).toBe(0);
      expect(results[0].line).toBe(1);
      expect(results[0].columns).toBe('<template>'.length);
      expect(results[1].content).toBe('</template>');
      expect(results[1].start).toBe('<template>'.length);
      expect(results[1].line).toBe(2);
      expect(results[1].columns).toBe('</template>'.length);
    });
    it('support empty line file', function () {
      const tpl = `<template>\n\n</template>`;
      const results = getFileRanges(tpl);

      expect(results.length).toBe(3);
      expect(results[0].content).toBe('<template>');
      expect(results[1].content).toBe('');
      expect(results[2].content).toBe('</template>');
      expect(results[2].start).toBe('<template>\n\n'.length);
      expect(results[2].line).toBe(3);
    });
  });

  describe('RangeWalker', function () {
    describe('stable keys', function () {
      const tpl = `'const Boo = {};\n\nclass MyComponent {\n    <template>\n\n    <button>asa</button>\n    <\n        <:foo>\n\n\n        </:foo>\n\n        <Ui::Avatars @foo="name" />\n\n\n    <img src="">\n</template>\n\n}\n'`;
      const r = rw(tpl);

      const [template] = r.templates(true);
      const rangeWithoutTemplates = r.subtract([template], true);

      expect(rangeWithoutTemplates.content).toContain(template.key);
    });
    describe('stable with multiple mutations', function () {
      const tpl = `'const Boo = {};\n\nclass MyComponent {\n    <template>\n\n    <button>asa</button>\n    <\n        <:foo>\n\n\n        </:foo>\n\n        <Ui::Avatars @foo="name" />\n\n\n    <img src="">\n</template>\n\n}\n'`;
      let r = rw(tpl);

      r = r.subtract(r.hbsInlineComments(true));
      r = r.subtract(r.hbsComments(true));
      r = r.subtract(r.htmlComments(true));

      const [template] = r.templates(true);
      const rangeWithoutTemplates = r.subtract([template], true);

      expect(rangeWithoutTemplates.content).toContain(template.key);
    });
    describe('stable with multiple template mutations', function () {
      const tpl = `
        const Boo {
          <template>1</template>
        }
        const Moo {
          <template>2</template>
        }
      `;
      const r = rw(tpl);

      const templates = r.templates(true);

      expect(templates.length).toBe(2);

      const [template1, template2] = templates;

      expect(template1.key).toContain('_');
      expect(template2.key).toContain('_');
      const rangeWithoutTemplates = r.subtract([template1, template2], true);

      expect(rangeWithoutTemplates.content).toContain(template1.key);
      expect(rangeWithoutTemplates.content).toContain(template2.key);
    });
    describe('stable with multiple step-by-step mutations', function () {
      const tpl = `
        const Boo {
          <template>1</template>
        }
        const Moo {
          <template>2</template>
        }
      `;
      const r = rw(tpl);

      const [template1, template2] = r.templates(true);
      let rangeWithoutTemplates = r.subtract([template1], true);

      rangeWithoutTemplates = rangeWithoutTemplates.subtract([template2], true);

      expect(rangeWithoutTemplates.content).toContain(template1.key);
      expect(rangeWithoutTemplates.content).toContain(template2.key);
    });
    describe('content getter', function () {
      it('works just fine', function () {
        const tpl = `<template>\n<template>\n</template>`;
        const r = rw(tpl);

        expect(r.content).toBe(tpl);
      });
    });
    describe('subtract', function () {
      describe('one-line', function () {
        it('able to remove single line template content from source [with bounds]', function () {
          const tpl = `<template>42</template>`;
          const r = rw(tpl);

          expect(r.subtract(r.templates()).content).toStrictEqual('<template>  </template>');
        });
        it('able to remove single line template content from source [without bounds]', function () {
          const tpl = `<template>42</template>`;
          const r = rw(tpl);

          expect(r.subtract(r.templates(true)).content).toStrictEqual(new Array(tpl.length).fill(' ').join(''));
        });
      });
      describe('multi-line', function () {
        it('able to remove single line template content from source [with bounds]', function () {
          const tpl = `<template>\n4\n2\n</template>`;
          const r = rw(tpl);

          expect(r.subtract(r.templates()).content).toStrictEqual('<template>\n \n \n</template>');
        });
        it('able to remove single line template content from source [without bounds]', function () {
          const tpl = `\n<template>\n4\n2\n</template>\n`;
          const r = rw(tpl);

          expect(r.subtract(r.templates(true)).content).toStrictEqual('\n          \n \n \n           \n');
        });
      });
      describe('can subtract multiple types', function () {
        it('able to remove style and template content', function () {
          const tpl = `<template>42</template><style>42</style>`;
          const r = rw(tpl);

          expect(r.subtract([...r.templates(), ...r.styles()]).content).toStrictEqual('<template>  </template><style>  </style>');
        });
      });
      describe('can subtract templates with placeholders', function () {
        it('able to remove style and template content', function () {
          const hTpl = `<template>42</template>`;
          const tpl = `class MyGlimmerComponent {
            ${hTpl}
            <style>42</style>
          }`.trim();
          const r = rw(tpl);
          const [template] = r.templates(true);
          const expectedTpl = `class MyGlimmerComponent {
            ${template.key}${new Array(hTpl.length - template.key.length).fill(' ').join('')}
            <style>42</style>
          }
          `.trim();

          expect(r.subtract([template], true).content.split('\n')).toStrictEqual(expectedTpl.split('\n'));
        });
      });
    });
    describe('<template></template>', function () {
      describe('corner cases', function () {
        it('support open template tag inside open template tag', function () {
          const tpl = `<template><template></template>`;
          const r = rw(tpl);
          const templates = r.templates();
          const [template] = templates;

          expect(templates.length).toBe(1);
          expect(template.content).toBe('<template>');
        });
        it('support close template tag after close template tag', function () {
          const tpl = `<template></template></template>`;
          const r = rw(tpl);
          const templates = r.templates();
          const [template] = templates;

          expect(templates.length).toBe(1);
          expect(template.content).toBe('');
        });
        it('support multiple templates', function () {
          const tpl = `<template>\n1\n</template><template>\n2\n</template>`;
          const r = rw(tpl);
          const templates = r.templates();
          const [templ1, templ2] = templates;

          expect(templates.length).toBe(2);
          expect(templ1.content).toBe('\n1\n');
          expect(templ2.content).toBe('\n2\n');
        });
      });

      describe('without bounds', function () {
        it('able to extract template content from single line file', function () {
          const tpl = `<template>42</template>`;
          const r = rw(tpl);
          const templates = r.templates();
          const [template] = templates;

          expect(templates.length).toBe(1);
          expect(template.content).toBe('42');
          expect(template.loc.start.line).toBe(1);
          expect(template.loc.start.character).toBe(10);
          expect(template.loc.end.line).toBe(1);
          expect(template.loc.end.character).toBe(12);
        });

        it('able to extract template content from multi line file', function () {
          const content = '\n4\n2\n';
          const tpl = `<template>${content}</template>`;
          const r = rw(tpl);
          const templates = r.templates();
          const [template] = templates;

          expect(templates.length).toBe(1);
          expect(template.content.split('\n')).toStrictEqual(content.split('\n'));
          expect(template.content).toEqual(content);
          expect(template.loc.start.line).toBe(1);
          expect(template.loc.start.character).toBe(10);
          expect(template.loc.end.line).toBe(4);
          expect(template.loc.end.character).toBe(0);
        });
      });

      describe('with bounds', function () {
        it('able to extract template content from single line file', function () {
          const tpl = `<template>42</template>`;
          const r = rw(tpl);
          const templates = r.templates(true);
          const [template] = templates;

          expect(templates.length).toBe(1);
          expect(template.content).toBe(tpl);
          expect(template.loc.start.line).toBe(1);
          expect(template.loc.start.character).toBe(0);
          expect(template.loc.end.line).toBe(1);
          expect(template.loc.end.character).toBe(tpl.length);
        });

        it('able to extract template content from multi line file', function () {
          const content = '\n4\n2\n';
          const tpl = `<template>${content}</template>`;
          const r = rw(tpl);
          const templates = r.templates(true);
          const [template] = templates;

          expect(templates.length).toBe(1);
          expect(template.content.split('\n')).toStrictEqual(tpl.split('\n'));
          expect(template.content).toEqual(tpl);
          expect(template.loc.start.line).toBe(1);
          expect(template.loc.start.character).toBe(0);
          expect(template.loc.end.line).toBe(4);
          expect(template.loc.end.character).toBe(11);
        });
      });
    });
  });

  describe('TemplateData', function () {
    it('return correct absolute content', function () {
      const tpl = `123\n1\n\n <template>123\n </template>`;
      const r = rw(tpl);
      const [template] = r.templates(true);

      expect(template.absoluteContent.split('\n')).toStrictEqual(['', '', '', ' <template>123', ' </template>']);
    });
    it('match document offsets with absolute content', function () {
      const tpl = `
      class MyComponent {
         <template>
            <$123
        </template>
    }
      `;
      const originalDoc = TextDocument.create('', 'javascript', 0, tpl);
      const tParts = tpl.split('\n');
      const line = tParts.findIndex((e) => e.includes('$'));
      const p1 = {
        character: tParts[line].indexOf('$'),
        line,
      };
      const p2 = {
        character: tParts[line].indexOf('$') + 4,
        line,
      };

      expect(originalDoc.getText({ start: p1, end: p2 })).toBe('$123');
      const r = rw(originalDoc.getText());
      const [template] = r.templates(true);
      const templateDoc = TextDocument.create('', 'handlebars', 0, template.absoluteContent);

      expect(templateDoc.getText({ start: p1, end: p2 })).toBe('$123');
    });
    it('return expected list of locals', function () {
      const tpl = `<div>{{this.foo}}</div>`;
      const data = new TemplateData(tpl);

      expect(data.locals).toStrictEqual([]);
    });
    it('return expected list of locals for helpers', function () {
      const tpl = `<div>{{foo 42}}</div>`;
      const data = new TemplateData(tpl);

      expect(data.locals).toStrictEqual(['foo']);
    });
    it('return expected list of locals for helpers composition', function () {
      const tpl = `<div>{{foo (bar 42)}}</div>`;
      const data = new TemplateData(tpl);

      expect(data.locals).toStrictEqual(['foo', 'bar']);
    });
    it('return expected list of locals for modifiers', function () {
      const tpl = `<div {{foo 42}}></div>`;
      const data = new TemplateData(tpl);

      expect(data.locals).toStrictEqual(['foo']);
    });
    it('return expected list of locals for components', function () {
      const tpl = `<MyComponent />`;
      const data = new TemplateData(tpl);

      expect(data.locals).toStrictEqual(['MyComponent']);
    });
  });
});
