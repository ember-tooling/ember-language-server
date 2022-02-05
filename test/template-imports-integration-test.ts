import { createServer, getResult, ServerBucket } from './test_helpers/public-integration-helpers';
import { MessageConnection } from 'vscode-jsonrpc/node';
import { CompletionRequest } from 'vscode-languageserver-protocol/node';

function createPointer(tpl = '') {
  const findMe = '⚡';
  const parts = tpl.split('\n');
  const line = parts.findIndex((e) => e.includes(findMe));
  const character = parts[line].indexOf(findMe) - 1;

  return {
    content: tpl.replace(findMe, ''),
    position: {
      line,
      character,
    },
  };
}

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
});
