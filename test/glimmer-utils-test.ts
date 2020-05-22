import { Position } from 'vscode-languageserver';
import { preprocess } from '@glimmer/syntax';

import ASTPath, { getLocalScope, maybeComponentNameForPath, sourceForNode, focusedBlockParamName, maybeBlockParamDefinition } from '../src/glimmer-utils';
import { toPosition } from '../src/estree-utils';

describe('glimmer-utils', function () {
  describe('ASTPath', function () {
    it('works as expected', function () {
      const input = `
<Component as |items|>
{{#let items as |item bar|}}
{{foo}}
{{/let}}
</Component>
        `;
      const astPath = ASTPath.toPosition(preprocess(input), toPosition(Position.create(3, 5)));

      expect(astPath.node).toMatchSnapshot();
    });
  });
  describe('getLocalScope', function () {
    it('works as expected', function () {
      const input = `
<Component as |items|>
{{#let items as |item bar|}}
{{foo}}
{{/let}}
</Component>
        `;
      const astPath = ASTPath.toPosition(preprocess(input), toPosition(Position.create(3, 5)));

      expect(getLocalScope(astPath).map(({ name, index }) => [name, index])).toEqual([
        ['item', 0],
        ['bar', 1],
        ['items', 0],
      ]);
    });
  });
  describe('maybeComponentNameForPath', function () {
    it('works as expected', function () {
      const input = `
<Component as |items|>
{{#let items as |item bar|}}
{{items}}
{{/let}}
</Component>
        `;
      const astPath = ASTPath.toPosition(preprocess(input), toPosition(Position.create(3, 5)));

      expect(maybeComponentNameForPath(astPath)).toEqual('Component');
    });
  });
  describe('sourceForNode', function () {
    it('works as expected', function () {
      const input = `
      <Component as |items|>
      {{#let items as |item bar|}}
      {{items}}
      {{/let}}
      </Component>
              `;
      const astPath = ASTPath.toPosition(preprocess(input), toPosition(Position.create(2, 2)));

      expect(astPath.node.tag).toEqual('Component');
      expect(sourceForNode(astPath.node, input)).toEqual(input.trim());
    });
    it('works as expected for MustachePaths', function () {
      const input = ['<Component as |items|>', '{{#let items as |item bar|}}', '{{items}}', '{{/let}}', '</Component>'].join('\n');
      const astPath = ASTPath.toPosition(preprocess(input), toPosition(Position.create(2, 3)));

      expect(astPath.node.original).toEqual('items');
      expect(sourceForNode(astPath.node, input)).toEqual('items');
    });
  });
  describe('maybeBlockParamDefinition', function () {
    it('able to handle wrong paths', function () {
      const input = ['<Component as |items|>', '{{foo}}', '</Component>'].join('\n');
      const pos = toPosition(Position.create(1, 3));
      const astPath = ASTPath.toPosition(preprocess(input), pos);

      expect(maybeBlockParamDefinition(astPath, input, pos)).toEqual(undefined);
    });
    it('able to handle single param', function () {
      const input = ['<Component as |items|>', '{{foo}}', '</Component>'].join('\n');
      const pos = toPosition(Position.create(0, 16));
      const astPath = ASTPath.toPosition(preprocess(input), pos);

      expect(maybeBlockParamDefinition(astPath, input, pos)).toMatchSnapshot();
    });
    it('able to handle single fiew params', function () {
      const input = ['<Component as |items boo zoo|>', '{{foo}}', '</Component>'].join('\n');
      const pos = toPosition(Position.create(0, 22));
      const astPath = ASTPath.toPosition(preprocess(input), pos);

      expect(maybeBlockParamDefinition(astPath, input, pos)).toMatchSnapshot();
    });
  });
  describe('focusedBlockParamName', function () {
    it('works as expected for MustachePaths', function () {
      const input = ['<Component as |items|>', '{{#let items as |item bar|}}', '{{items}}', '{{/let}}', '</Component>'].join('\n');
      const paramName = focusedBlockParamName(input, toPosition(Position.create(1, 24)));

      expect(paramName).toEqual('bar');
    });
    it('works as expected for corner cases [left]', function () {
      const input = ['<C as |items|>'].join('\n');
      let paramName = focusedBlockParamName(input, toPosition(Position.create(0, 7)));

      expect(paramName).toEqual('items');
      paramName = focusedBlockParamName(input, toPosition(Position.create(0, 8)));
      expect(paramName).toEqual('items');
      paramName = focusedBlockParamName(input, toPosition(Position.create(0, 6)));
      expect(paramName).toEqual('');
    });
    it('works as expected for corner cases [right]', function () {
      const input = ['<C as |items|>'].join('\n');
      let paramName = focusedBlockParamName(input, toPosition(Position.create(0, 12)));

      expect(paramName).toEqual('items');
      paramName = focusedBlockParamName(input, toPosition(Position.create(0, 11)));
      expect(paramName).toEqual('items');
      paramName = focusedBlockParamName(input, toPosition(Position.create(0, 13)));
      expect(paramName).toEqual('');
    });
    it('works as expected for corner cases for 1+ param [right]', function () {
      const input = ['<C as |items foo|>'].join('\n');
      let paramName = focusedBlockParamName(input, toPosition(Position.create(0, 6)));

      expect(paramName).toEqual('');
      paramName = focusedBlockParamName(input, toPosition(Position.create(0, 12)));
      expect(paramName).toEqual('items');
      paramName = focusedBlockParamName(input, toPosition(Position.create(0, 13)));
      expect(paramName).toEqual('foo');
      paramName = focusedBlockParamName(input, toPosition(Position.create(0, 16)));
      expect(paramName).toEqual('foo');
      paramName = focusedBlockParamName(input, toPosition(Position.create(0, 17)));
      expect(paramName).toEqual('');
    });
    it('works as expected for corner cases for 1+ param and long blanks', function () {
      const input = ['<C as | items  foo |>'].join('\n');
      let paramName = focusedBlockParamName(input, toPosition(Position.create(0, 7)));

      expect(paramName).toEqual('');
      paramName = focusedBlockParamName(input, toPosition(Position.create(0, 13)));
      expect(paramName).toEqual('items');
      paramName = focusedBlockParamName(input, toPosition(Position.create(0, 14)));
      expect(paramName).toEqual('');
      paramName = focusedBlockParamName(input, toPosition(Position.create(0, 15)));
      expect(paramName).toEqual('foo');
      paramName = focusedBlockParamName(input, toPosition(Position.create(0, 19)));
      expect(paramName).toEqual('');
    });
    it('works as expected for Tags', function () {
      const input = ['<Component as |items|>', '{{#let items as |item bar|}}', '{{items}}', '{{/let}}', '</Component>'].join('\n');
      const paramName = focusedBlockParamName(input, toPosition(Position.create(0, 16)));

      expect(paramName).toEqual('items');
    });
  });
});
