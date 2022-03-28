import { createServer, getResult, ServerBucket, createPointer } from './test_helpers/public-integration-helpers';
import { MessageConnection } from 'vscode-jsonrpc/node';
import { CompletionRequest, DefinitionRequest } from 'vscode-languageserver-protocol/node';

describe('has basic template imports support', function () {
  let instance!: ServerBucket;
  let connection!: MessageConnection;

  describe('CompletionRequest inside <template>', () => {
    beforeAll(async () => {
      instance = await createServer({ asyncFsEnabled: false });
      connection = instance.connection;
    });

    afterAll(async () => {
      await instance.destroy();
    });

    describe('template imports completion requests working fine', () => {
      it('support component autocomplete from scope for .gjs files', async () => {
        const tpl = `
          import FooBar from './../foo';
          export default class Foo extends Bar {
            firstName = "a";
            lastName = "b";
            <template><⚡</template>
          }
        `;
        const { content, position } = createPointer(tpl);
        const result = await getResult(
          CompletionRequest.method,
          connection,
          {
            app: {
              components: {
                hello: {
                  'index.gjs': content,
                },
              },
            },
          },
          'app/components/hello/index.gjs',
          position
        );

        expect(result).toMatchSnapshot();
      });
      it('support component autocomplete from scope for .gts files', async () => {
        const tpl = `
          import FooBar from './../foo';
          export default class Foo extends Bar {
            firstName = "a";
            lastName = "b";
            <template><⚡</template>
          }
        `;
        const { content, position } = createPointer(tpl);
        const result = await getResult(
          CompletionRequest.method,
          connection,
          {
            app: {
              components: {
                hello: {
                  'index.gts': content,
                },
              },
            },
          },
          'app/components/hello/index.gts',
          position
        );

        expect(result).toMatchSnapshot();
      });
      it('support component autocomplete from scope and layout for .gts files', async () => {
        const tpl = `
          import FooBar from './../foo';
          export default class Foo extends Bar {
            firstName = "a";
            lastName = "b";
            <template><⚡</template>
          }
        `;
        const { content, position } = createPointer(tpl);
        const result = await getResult(
          CompletionRequest.method,
          connection,
          {
            app: {
              components: {
                hello: {
                  'index.gts': content,
                },
                world: {
                  'index.hbs': '',
                },
              },
            },
          },
          'app/components/hello/index.gts',
          position
        );

        expect(result).toMatchSnapshot();
      });
    });
  });

  describe('DefinitionRequest inside <template>', () => {
    beforeAll(async () => {
      instance = await createServer({ asyncFsEnabled: false });
      connection = instance.connection;
    });

    afterAll(async () => {
      await instance.destroy();
    });

    describe('template imports definition requests working fine [legacy mode]', () => {
      it('support component definition in .gjs files', async () => {
        const tpl = `
          export default class Foo extends Bar {
            <template>
              <W⚡orld/>
            </template>
          }
        `;
        const { content, position } = createPointer(tpl);
        const result = await getResult(
          DefinitionRequest.method,
          connection,
          {
            app: {
              components: {
                hello: {
                  'index.gjs': content,
                },
                world: {
                  'index.gts': '',
                },
              },
            },
          },
          'app/components/hello/index.gjs',
          position
        );

        expect(result).toMatchSnapshot();
      });
    });
  });
});
