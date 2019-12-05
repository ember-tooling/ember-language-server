import { Position } from 'vscode-languageserver';
import { preprocess } from '@glimmer/syntax';

import ASTPath, { getLocalScope, componentNameForPath, sourceForNode } from '../src/glimmer-utils';
import { toPosition } from '../src/estree-utils';

describe('glimmer-utils', function() {
  describe('ASTPath', function() {
    it('works as expected', function() {
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
  describe('getLocalScope', function() {
    it('works as expected', function() {
      const input = `
<Component as |items|>
{{#let items as |item bar|}}
{{foo}}
{{/let}}
</Component>
        `;
      const astPath = ASTPath.toPosition(preprocess(input), toPosition(Position.create(3, 5)));
      expect(getLocalScope(astPath).map(([el, , ind]) => [el, ind])).toEqual([['item', 0], ['bar', 1], ['items', 0]]);
    });
  });
  describe('componentNameForPath', function() {
    it('works as expected', function() {
      const input = `
<Component as |items|>
{{#let items as |item bar|}}
{{items}}
{{/let}}
</Component>
        `;
      const astPath = ASTPath.toPosition(preprocess(input), toPosition(Position.create(3, 5)));
      expect(componentNameForPath(astPath)).toEqual('Component');
    });
  });
  describe('sourceForNode', function() {
    it('works as expected', function() {
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
    it('works as expected for MustachePaths', function() {
      const input = ['<Component as |items|>', '{{#let items as |item bar|}}', '{{items}}', '{{/let}}', '</Component>'].join('\n');
      const astPath = ASTPath.toPosition(preprocess(input), toPosition(Position.create(2, 3)));
      expect(astPath.node.original).toEqual('items');
      expect(sourceForNode(astPath.node, input)).toEqual('items');
    });
  });
});
