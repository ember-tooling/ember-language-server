import { createServer, getResult, ServerBucket, createPointer, makeProject } from './test_helpers/public-integration-helpers';
import { MessageConnection } from 'vscode-jsonrpc/node';
import { DefinitionRequest } from 'vscode-languageserver-protocol/node';

describe('script files', function () {
  let instance!: ServerBucket;
  let connection!: MessageConnection;

  describe('named import definition resolution', () => {
    beforeAll(async () => {
      instance = await createServer({ asyncFsEnabled: false });
      connection = instance.connection;
    });

    afterAll(async () => {
      await instance.destroy();
    });

    describe('addon case', () => {
      it('named import from addon', async () => {
        const tpl = `
            import { n⚡ame } from 'my-addon/utils/hello';    
        `;
        const { content, position } = createPointer(tpl);

        const project = makeProject(
          {
            'app/components/hello/index.js': content,
          },
          {
            'my-addon': {
              'addon/utils/hello.js': `
                    export default const a = 42;
                    export const name = 'hello';
                `,
              'package.json': JSON.stringify({
                name: 'my-addon',
                keywords: ['ember-addon'],
              }),
            },
          }
        );

        const result = await getResult(DefinitionRequest.method, connection, project, 'app/components/hello/index.js', position);

        expect(result).toMatchSnapshot();
      });
      it('unknown named import from addon', async () => {
        const tpl = `
            import { n⚡ames } from 'my-addon/utils/hello';    
        `;
        const { content, position } = createPointer(tpl);

        const project = makeProject(
          {
            'app/components/hello/index.js': content,
          },
          {
            'my-addon': {
              'addon/utils/hello.js': `
                    export default const a = 42;
                    export const name = 'hello';
                `,
              'package.json': JSON.stringify({
                name: 'my-addon',
                keywords: ['ember-addon'],
              }),
            },
          }
        );

        const result = await getResult(DefinitionRequest.method, connection, project, 'app/components/hello/index.js', position);

        expect(result).toMatchSnapshot();
      });
      it('default import from addon', async () => {
        const tpl = `
            import n⚡ame from 'my-addon/utils/hello';    
        `;
        const { content, position } = createPointer(tpl);

        const project = makeProject(
          {
            'app/components/hello/index.js': content,
          },
          {
            'my-addon': {
              'addon/utils/hello.js': `
                    export default const a = 42;
                `,
              'package.json': JSON.stringify({
                name: 'my-addon',
                keywords: ['ember-addon'],
              }),
            },
          }
        );

        const result = await getResult(DefinitionRequest.method, connection, project, 'app/components/hello/index.js', position);

        expect(result).toMatchSnapshot();
      });
      it('not existing default import from addon', async () => {
        const tpl = `
            import n⚡ame from 'my-addon/utils/hello';    
        `;
        const { content, position } = createPointer(tpl);

        const project = makeProject(
          {
            'app/components/hello/index.js': content,
          },
          {
            'my-addon': {
              'addon/utils/hello.js': `
                    export const a = 42;
                `,
              'package.json': JSON.stringify({
                name: 'my-addon',
                keywords: ['ember-addon'],
              }),
            },
          }
        );

        const result = await getResult(DefinitionRequest.method, connection, project, 'app/components/hello/index.js', position);

        expect(result).toMatchSnapshot();
      });
    });
  });
});

describe('template files', function () {
  let instance!: ServerBucket;
  let connection!: MessageConnection;

  describe('yield positional path definition', () => {
    beforeAll(async () => {
      instance = await createServer({ asyncFsEnabled: false });
      connection = instance.connection;
    });

    afterAll(async () => {
      await instance.destroy();
    });

    describe('component definition as property path', () => {
      it('return component from property path', async () => {
        const tpl = `
          <MyComponent as |foo|>
            <foo.ba⚡r />
          </MyComponent>
        `;
        const { content, position } = createPointer(tpl);

        const project = makeProject({
          'app/components/hello/index.hbs': content,
          'app/components/bar/index.hbs': 'Hello',
          'app/components/my-component.hbs': `
              {{yield (hash bar=(component "bar"))}}
          `,
        });

        project['$meta'] = {
          waitForTemplateTokensToBeCollected: true,
        };

        const result = await getResult(DefinitionRequest.method, connection, project, 'app/components/hello/index.hbs', position);

        expect(result).toMatchSnapshot();
      });

      it('return component from property path for global scope override', async () => {
        const tpl = `
          {{#let (component "my-component") as |foo|}}
            <MyComponent as |foo|>
              <foo.ba⚡r />
            </MyComponent>
          {{/let}}
        `;
        const { content, position } = createPointer(tpl);

        const project = makeProject({
          'app/components/hello/index.hbs': content,
          'app/components/bar/index.hbs': 'Hello',
          'app/components/my-component.hbs': `
              {{yield (hash bar=(component "bar"))}}
          `,
        });

        project['$meta'] = {
          waitForTemplateTokensToBeCollected: true,
        };

        const result = await getResult(DefinitionRequest.method, connection, project, 'app/components/hello/index.hbs', position);

        expect(result).toMatchSnapshot();
      });
    });
  });
});
