import ProjectTemplateLinter from '../../../../src/builtin-addons/core/code-actions/template-lint-fixes';
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
    instance = new ProjectTemplateLinter();
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
            source: 'ember-template-lint',
            message: '(fixable)',
            code: 'no-unfixed-codebase',
          },
        ],
      },
      textDocument: {
        uri: 'layout.hbs',
      },
      document: {
        getText: (): string => '<button></button>',
      },
      range: {
        start: {
          line: 0,
          col: 0,
        },
        end: {
          line: 0,
          col: 17,
        },
      },
    };
    const result = await instance.onCodeAction('', params);

    expect(result).toStrictEqual([
      {
        edit: {
          changes: {
            'layout.hbs': [{ newText: '<button type="button"></button>', range: { end: { character: 17, line: 0 }, start: { character: 0, line: 0 } } }],
          },
        },
        kind: 'quickfix',
        title: 'fix: no-unfixed-codebase',
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
            message: "HTML class attribute sorting is: 'md:flex bg-white rounded-lg p-2', but should be: 'md:flex p-2 bg-white rounded-lg' (fixable)",
            severity: 1,
            code: 'class-order',
            source: 'ember-template-lint',
          },
        ],
      },
      textDocument: {
        uri: 'layout.hbs',
      },
      document: {
        getText: (): string => '<div class="md:flex bg-white rounded-lg p-2">\n  <h3 class="mb-4">Hello</h3>\n</div>',
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
                newText: '<div class="md:flex p-2 bg-white rounded-lg">\n  <h3 class="mb-4">Hello</h3>\n</div>',
              },
            ],
          },
        },
        kind: 'quickfix',
        title: 'fix: class-order',
      },
    ]);
  });
});
