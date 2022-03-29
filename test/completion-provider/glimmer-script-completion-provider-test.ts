import { Server } from '../../src';
import GlimmerScriptCompletionProvider from '../../src/completion-provider/glimmer-script-completion-provider';
import { Position } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

class ProjectMock {}
class ServerMock {
  constructor(private content: string, private project: ProjectMock | null) {}
  get projectRoots() {
    return {
      projectForUri: () => {
        return this.project;
      },
    };
  }
  get documents() {
    return {
      get: () => {
        return {
          getText: () => {
            return this.content;
          },
        };
      },
    };
  }
}

function createServer(content: string, project: ProjectMock | null) {
  return new ServerMock(content, project) as unknown as Server;
}

describe('GlimmerScriptCompletionProvider', function () {
  it('works', async function () {
    const tpl = `var n = 42; class Component { \n<template></template> }`;
    const project = null;
    const provider = new GlimmerScriptCompletionProvider(createServer(tpl, project));
    const results = await provider.provideCompletions({
      textDocument: {
        uri: '',
      },
      position: Position.create(1, 12),
    });

    expect(results).toStrictEqual([{ label: 'Component' }, { label: 'n' }]);
  });
  it('works with legacy logic', async function () {
    const tpl = `var n = 42; class Component { \n<template></template> }`;
    const project = new ProjectMock();
    const provider = new GlimmerScriptCompletionProvider(createServer(tpl, project));
    const results = await provider.provideCompletions({
      textDocument: {
        uri: '',
      },
      position: Position.create(1, 12),
    });

    expect(results).toStrictEqual([{ label: 'Component' }, { label: 'n' }]);
  });
  it('work with modern logic', async function () {
    const tpl = `var n = 42; class Component { \n<template></template> }`;
    const project = new ProjectMock();
    const provider = new GlimmerScriptCompletionProvider(createServer(tpl, project));
    const textDocument = TextDocument.create('/app/foo.gjs', 'javascript', 1, tpl);
    const results = await provider.provideCompletions({
      textDocument: textDocument,
      position: Position.create(1, 12),
    });

    expect(results).toStrictEqual([{ label: 'Component' }, { label: 'n' }]);
  });
});
