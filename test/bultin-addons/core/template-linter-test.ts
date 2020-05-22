import ProjectTemplateLinter from '../../../src/builtin-addons/core/template-linter';
import TemplateCompletionProvider from '../../../src/completion-provider/template-completion-provider';

describe('ProjectTemplateLinter', () => {
  let server, project, instance;

  beforeEach(() => {
    server = {
      templateLinter: {
        linterForProject: (): unknown =>
          class LinterMock {
            verifyAndFix(): { isFixed: boolean; output: string } {
              return {
                isFixed: true,
                output: '<button type="button"></button>',
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
});
