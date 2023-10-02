import type { ASTv1 } from '@glimmer/syntax';

export type CaseContent = null | ['component' | 'helper' | 'modifier', string | string[]];
export type TemplateYieldContext = Record<string, CaseContent>;

export function extractYieldMetadata(template: ASTv1.Template) {
  type ExpressionResult = {
    $fn: string;
    $params?: unknown[];
    $hash?: Record<string, unknown>;
  };
  class Extractors {
    set: Set<ExpressionResult> = new Set();
    Program(node: ASTv1.Program) {
      return this.Template(node);
    }
    ElementModifierStatement(node: ASTv1.ElementModifierStatement) {
      return this.SubExpression(node);
    }
    Block(node: ASTv1.Block) {
      return {
        params: node.blockParams.map((p) => p),
        body: this.map(node.body).filter((e) => typeof e !== 'string'),
      };
    }
    StringLiteral(node: ASTv1.StringLiteral) {
      return node.original;
    }
    TextNode(node: ASTv1.TextNode) {
      return node.chars;
    }
    NumberLiteral(node: ASTv1.NumberLiteral) {
      return node.original;
    }
    NullLiteral(node: ASTv1.NullLiteral) {
      return node.original;
    }
    BooleanLiteral(node: ASTv1.BooleanLiteral) {
      return node.original;
    }
    UndefinedLiteral(node: ASTv1.UndefinedLiteral) {
      return node.original;
    }
    PathExpression(node: ASTv1.PathExpression) {
      return node.original;
    }
    Hash(node: ASTv1.Hash): Record<string, unknown> {
      const acc: Record<string, unknown> = {};

      return node.pairs
        .map((pair) => {
          return this.HashPair(pair);
        })
        .reduce((acc, curr) => {
          acc[curr.key] = curr.value;

          return acc;
        }, acc);
    }
    HashPair(node: ASTv1.HashPair) {
      return {
        key: node.key,
        value: this[node.value.type](node.value as never),
      };
    }
    AttrNode(node: ASTv1.AttrNode) {
      return [node.name, this[node.value.type](node.value as never)];
    }
    ElementNode(node: ASTv1.ElementNode) {
      const acc: Record<string, unknown> = {};

      return {
        $element: node.tag,
        $attributes: this.map(node.attributes).reduce((acc, [key, val]) => {
          Object.defineProperty(acc, key, {
            value: val,
          });

          return acc;
        }, acc),
        $modifiers: this.map(node.modifiers),
        $programs: this.map(node.children).filter((e) => typeof e !== 'string'),
      };
    }
    Template(node: ASTv1.Template | ASTv1.Program) {
      return {
        $programs: this.map(node.body).filter((e) => typeof e !== 'string'),
      };
    }
    ConcatStatement(node: ASTv1.ConcatStatement) {
      return this.map(node.parts);
    }
    PartialStatement(node: ASTv1.PartialStatement) {
      return node.name;
    }
    CommentStatement(node: ASTv1.CommentStatement) {
      return node.value;
    }
    MustacheCommentStatement(node: ASTv1.MustacheCommentStatement) {
      return node.value;
    }
    Expression(node: ASTv1.Expression) {
      return this[node.type](node as never);
    }
    SubExpression(node: ASTv1.SubExpression | ASTv1.MustacheStatement | ASTv1.BlockStatement | ASTv1.ElementModifierStatement) {
      const name = this[node.path.type](node.path as never);
      const hash = this.Hash(node.hash);
      const params = this.map(node.params);

      if (name === 'hash') {
        return hash;
      }

      if (name === 'array') {
        return params;
      }

      const result: ExpressionResult = {
        $fn: name as string,
      };

      if (node.params.length) {
        result.$params = params;
      }

      if (node.hash.pairs.length) {
        result.$hash = hash;
      }

      this.set.add(result);

      return result;
    }
    MustacheStatement(node: ASTv1.MustacheStatement) {
      return this.SubExpression(node);
    }
    BlockStatement(node: ASTv1.BlockStatement) {
      const result = this.SubExpression(node);

      const $programs = [this.Block(node.program)];

      if (node.inverse) {
        $programs.push(this.Block(node.inverse));
      }

      Object.defineProperty(result, '$programs', {
        value: $programs,
      });

      return result;
    }
    map(items: ASTv1.Node[]): unknown[] {
      if (!Array.isArray(items)) {
        return [];
      }

      return items.map((p) => {
        if (typeof this[p.type] !== 'function') {
          throw new Error(p.type);
        }

        return this[p.type](p as never);
      });
    }
  }

  const extractors = new Extractors();

  extractors.Template(template); // todo, check if this is correct
  const items = Array.from(extractors.set);
  const yields = items.filter((e) => e.$fn == 'yield');

  const cases: TemplateYieldContext = {};

  function getCase(value: ExpressionResult): CaseContent {
    if (value.$fn === 'component' || value.$fn === 'helper' || value.$fn === 'modifier') {
      const param = value.$params?.[0];
      const fns = ['or', 'if', 'unless', 'and'];

      if (typeof param === 'string') {
        return [value.$fn, param];
      } else if (param && fns.includes((param as ExpressionResult).$fn)) {
        const names: string[] = [];

        (param as ExpressionResult).$params?.forEach((el) => {
          if (typeof el === 'string' && !el.includes('.') && !el.startsWith('@')) {
            names.push(el);
          }
        });

        return [value.$fn, names];
      } else if (param && (param as ExpressionResult).$fn === 'if') {
        const names: string[] = [];

        (param as ExpressionResult).$params?.forEach((el) => {
          if (typeof el === 'string' && !el.includes('.') && !el.startsWith('@')) {
            names.push(el);
          }
        });

        return [value.$fn, names];
      }
    }

    return null;
  }

  yields.forEach((el) => {
    el.$params?.forEach((p, index) => {
      const isObject = typeof p === 'object' && p !== null && !Array.isArray(p);
      const isPOJO = isObject && !('$fn' in p);

      if (isPOJO) {
        Object.keys(p).forEach((key) => {
          const itemKey = `${el.$hash?.to ?? 'default'}:${index}:${key}`;
          const value = (p as never)[key] as ExpressionResult;

          cases[itemKey] = getCase(value);
        });
      } else if (isObject) {
        const itemKey = `${el.$hash?.to ?? 'default'}:${index}:`;

        cases[itemKey] = getCase(p as ExpressionResult);
      }
    });
  });

  return cases;
}
