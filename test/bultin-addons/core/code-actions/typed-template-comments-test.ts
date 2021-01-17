import TypedTemplatesCommentsCodeAction from '../../../../src/builtin-addons/core/code-actions/typed-template-comments';
import TemplateCompletionProvider from '../../../../src/completion-provider/template-completion-provider';

describe('ProjectTemplateLinter', () => {
  let server, project, instance, output;

  beforeEach(() => {
    server = {
      templateLinter: {
        linterForProject: (): unknown =>
          class LinterMock {
            verifyAndFix(): { isFixed: boolean; output: string } {
              return {
                isFixed: true,
                output,
              };
            }
          },
      },
    };
    server.templateCompletionProvider = new TemplateCompletionProvider(server);
    project = {
      root: __dirname,
    };
    instance = new TypedTemplatesCommentsCodeAction();
    instance.onInit(server, project);
  });

  test('it ok', () => {
    expect(instance.server).toBeDefined();
    expect(instance.project).toBeDefined();
  });

  test('it return valid result if all checks passed', async () => {
    output = '<button type="button"></button>';
    const params = {
      context: {
        diagnostics: [
          {
            source: 'typed-templates',
            message: 'baad',
            code: 'no-unfixed-codebase',
          },
        ],
      },
      textDocument: {
        uri: 'layout.hbs',
      },
      document: {
        getText: (): string => '<button type="button"></button>',
      },
      range: {
        start: {
          line: 0,
          col: 0,
        },
        end: {
          line: 0,
          col: 31,
        },
      },
    };
    const result = await instance.onCodeAction('', params);

    expect(result).toStrictEqual([
      {
        edit: {
          changes: {
            'layout.hbs': [
              {
                newText: '{{!-- @ts-ignore --}}\n<button type="button"></button>',
                range: { end: { character: 31, line: 0 }, start: { character: 0, line: 0 } },
              },
            ],
          },
        },
        kind: 'quickfix',
        title: 'disable: typed-templates',
      },
    ]);
  });

  test('it return valid result on template with line breaks', async () => {
    output = '<div class="md:flex p-2 bg-white rounded-lg">\n  <h3 class="mb-4">Hello</h3>\n</div>';
    const params = {
      context: {
        diagnostics: [
          {
            range: { start: { line: 0, character: 5 }, end: { line: 0, character: 45 } },
            message: "HTML class attribute sorting is: 'md:flex bg-white rounded-lg p-2', but should be: 'md:flex p-2 bg-white rounded-lg'",
            severity: 1,
            code: 'class-order',
            source: 'typed-templates',
          },
        ],
      },
      textDocument: {
        uri: 'layout.hbs',
      },
      document: {
        getText: (): string => '<div class="md:flex p-2 bg-white rounded-lg">\n  <h3 class="mb-4">Hello</h3>\n</div>',
      },
      range: { start: { line: 0, character: 14 }, end: { line: 0, character: 14 } },
    };
    const result = await instance.onCodeAction('', params);

    expect(result).toStrictEqual([
      {
        edit: {
          changes: {
            'layout.hbs': [
              {
                range: { start: { line: 0, character: 0 }, end: { line: 2, character: 6 } },
                newText: '{{!-- @ts-ignore --}}\n<div class="md:flex p-2 bg-white rounded-lg">\n  <h3 class="mb-4">Hello</h3>\n</div>',
              },
            ],
          },
        },
        kind: 'quickfix',
        title: 'disable: typed-templates',
      },
    ]);
  });

  test('it return valid result on template mustache in element arguments', async () => {
    output = '<img src={{this.filler}}>';
    const params = {
      context: {
        diagnostics: [
          {
            range: { start: { line: 0, character: 11 }, end: { line: 0, character: 22 } },
            message: 'some-error',
            severity: 1,
            code: 'template-lint',
            source: 'typed-templates',
          },
        ],
      },
      textDocument: {
        uri: 'layout.hbs',
      },
      document: {
        getText: (): string => '<img src={{this.filler}}>',
      },
      range: { start: { line: 0, character: 11 }, end: { line: 0, character: 11 } },
    };
    const result = await instance.onCodeAction('', params);

    expect(result).toStrictEqual([
      {
        edit: {
          changes: {
            'layout.hbs': [
              {
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 25 } },
                newText: '{{!-- @ts-ignore --}}\n<img src={{this.filler}}>',
              },
            ],
          },
        },
        kind: 'quickfix',
        title: 'disable: typed-templates',
      },
    ]);
  });
});
