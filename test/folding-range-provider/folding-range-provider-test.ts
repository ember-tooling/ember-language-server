import { createServer, getResult, ServerBucket } from './../test_helpers/public-integration-helpers';
import { MessageConnection } from 'vscode-jsonrpc/node';
import { FoldingRangeRequest } from 'vscode-languageserver-protocol/node';

describe('has folding range support', function () {
  let instance!: ServerBucket;
  let connection!: MessageConnection;
  const cursor = {
    line: 0,
    character: 0,
  };

  describe('for handlebars language', () => {
    beforeAll(async () => {
      instance = await createServer({ asyncFsEnabled: false });
      connection = instance.connection;
    });

    afterAll(async () => {
      await instance.destroy();
    });

    describe('folding range for [.hbs] files', () => {
      it('able to provide folding ranges ', async () => {
        const tpl = `
          <div>
            {{#if a}}
                hello
            {{else}}
                hello
            {{/if}}
          </div>
        `.trim();
        const result = await getResult(
          FoldingRangeRequest.method,
          connection,
          {
            'app/components/hello/index.hbs': tpl,
          },
          'app/components/hello/index.hbs',
          cursor
        );

        expect(result).toMatchSnapshot();
      });
      it('able to provide folding ranges for comments', async () => {
        const tpl = `
          
            {{!--
            {{#if a}}
                hello
            {{else}}
                hello
            {{/if}}
            --}}
    
        `.trim();
        const result = await getResult(
          FoldingRangeRequest.method,
          connection,
          {
            'app/components/hello/index.hbs': tpl,
          },
          'app/components/hello/index.hbs',
          cursor
        );

        expect(result).toMatchSnapshot();
      });
      it('able to provide folding ranges for tags', async () => {
        const tpl = `
          
            <MyComponent>

            </MyComponent>
    
        `.trim();
        const result = await getResult(
          FoldingRangeRequest.method,
          connection,
          {
            'app/components/hello/index.hbs': tpl,
          },
          'app/components/hello/index.hbs',
          cursor
        );

        expect(result).toMatchSnapshot();
      });
      it('able to provide folding ranges for blocks', async () => {
        const tpl = `
          
            {{#if}}
                a
            {{/if}}
        `.trim();
        const result = await getResult(
          FoldingRangeRequest.method,
          connection,
          {
            'app/components/hello/index.hbs': tpl,
          },
          'app/components/hello/index.hbs',
          cursor
        );

        expect(result).toMatchSnapshot();
      });
      it('able to provide folding ranges for inverse blocks', async () => {
        const tpl = `
          
            {{#if}}
                a
            {{else}}
                b
            {{/if}}
        `.trim();
        const result = await getResult(
          FoldingRangeRequest.method,
          connection,
          {
            'app/components/hello/index.hbs': tpl,
          },
          'app/components/hello/index.hbs',
          cursor
        );

        expect(result).toMatchSnapshot();
      });
      it('does not provide ranges for inline tags', async () => {
        const tpl = `
          <div></div>
        `.trim();
        const result = await getResult(
          FoldingRangeRequest.method,
          connection,
          {
            'app/components/hello/index.hbs': tpl,
          },
          'app/components/hello/index.hbs',
          cursor
        );

        expect(result.response.length).toBe(0);
      });
      it('does not provide ranges for inline blocks', async () => {
        const tpl = `
            {{#if a}}hello{{/if}}
        `.trim();
        const result = await getResult(
          FoldingRangeRequest.method,
          connection,
          {
            'app/components/hello/index.hbs': tpl,
          },
          'app/components/hello/index.hbs',
          cursor
        );

        expect(result.response.length).toBe(0);
      });
      it('does not provide ranges for inline comments', async () => {
        const tpl = `
            {{!--{{#if a}}hello{{/if}}--}}
        `.trim();
        const result = await getResult(
          FoldingRangeRequest.method,
          connection,
          {
            'app/components/hello/index.hbs': tpl,
          },
          'app/components/hello/index.hbs',
          cursor
        );

        expect(result.response.length).toBe(0);
      });
      it('does not fail if syntax is incorrect and return null', async () => {
        const tpl = `
          <div>
            {{#if a}}
                hello
            {{el
            {{/if}}
          </div>
        `.trim();
        const result = await getResult(
          FoldingRangeRequest.method,
          connection,
          {
            'app/components/hello/index.hbs': tpl,
          },
          'app/components/hello/index.hbs',
          cursor
        );

        expect(result.response).toBe(null);
      });
    });

    describe('folding range for [.ts] files', () => {
      it('able to provide folding ranges ', async () => {
        const tpl = `
            import hbs from "htmlbars-inline-precompile";
            const tpl = hbs\`<div>
              {{#if a}}
                  hello
              {{else}}
                  hello
              {{/if}}
            </div>\`
          `.trim();
        const result = await getResult(
          FoldingRangeRequest.method,
          connection,
          {
            'app/components/hello/index.ts': tpl,
          },
          'app/components/hello/index.ts',
          cursor
        );

        expect(result).toMatchSnapshot();
      });
      it('does not fail if ts syntax is incorrect and return null', async () => {
        const tpl = `
        import hbs from "htmlbars-inline-precompile";
          const tpl = hbs<div>
          {{#if a}}
              hello
          {{else}}
              hello
          {{/if}}
        </div>\`
      `.trim();
        const result = await getResult(
          FoldingRangeRequest.method,
          connection,
          {
            'app/components/hello/index.ts': tpl,
          },
          'app/components/hello/index.ts',
          cursor
        );

        expect(result.response).toBe(null);
      });
      it('does not fail if hbs syntax is incorrect and return null', async () => {
        const tpl = `
        import hbs from "htmlbars-inline-precompile";
          const tpl = hbs\`<div>
          {{#if
              hello
          {{else}}
              hello
          {{/if}}
        </div>\`
      `.trim();
        const result = await getResult(
          FoldingRangeRequest.method,
          connection,
          {
            'app/components/hello/index.ts': tpl,
          },
          'app/components/hello/index.ts',
          cursor
        );

        expect(result.response).toBe(null);
      });
    });

    describe('folding range for [.gts] files', () => {
      it('able to provide folding ranges ', async () => {
        const tpl = `
  
                class Component {
                    <template>
                        <div>
                            {{#if a}}
                                hello
                            {{else}}
                                hello
                            {{/if}}
                        </div>
                    </template>
                }
            `.trim();
        const result = await getResult(
          FoldingRangeRequest.method,
          connection,
          {
            'app/components/hello/index.gts': tpl,
          },
          'app/components/hello/index.gts',
          cursor
        );

        expect(result).toMatchSnapshot();
      });

      it('does not fail if syntax is incorrect and return null', async () => {
        const tpl = `
  
        class Component {
            <template>
                <div>
                    {if a}}
                        hello
                    {{els
                        hello
                    {{/if}}
                </div>
            </template>
        }
    `.trim();
        const result = await getResult(
          FoldingRangeRequest.method,
          connection,
          {
            'app/components/hello/index.gts': tpl,
          },
          'app/components/hello/index.gts',
          cursor
        );

        expect(result.response).toBe(null);
      });
    });
  });
});
