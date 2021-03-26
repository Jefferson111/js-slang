import { zip } from 'lodash'
import { create, ensureBlock } from '../utils'
import { generate } from 'astring'
import { optimize } from './optimizer'
import { pEnvironment, sym } from '../types'
import { strict as assert } from 'assert'
import * as es from 'estree'

export function handleExpression(
  node: es.Expression,
  env: pEnvironment,
  index: number | string
): es.Expression {
  if (exprHandler.hasOwnProperty(node.type)) {
    return exprHandler[node.type](node, env, index)
  } else {
    throw new Error(`unimplemented: cannot find expression handler for ${node.type}`)
  }
}

export function handleStatement(
  node: es.Statement,
  env: pEnvironment,
  index: number | string
): es.Statement[] {
  if (stmtHandler.hasOwnProperty(node.type)) {
    return stmtHandler[node.type](node, env, index)
  } else {
    throw new Error(`unimplemented: cannot find statement handler for ${node.type}`)
  }
}

const exprHandler = {
  Literal(node: es.Literal, env: pEnvironment, index: any): es.Expression {
    return node
  },
  FunctionExpression(node: es.FunctionExpression, env: pEnvironment, index: any): es.Expression {
    const penv = new pEnvironment(`HF${index}`, 'Function', env)

    node.params.forEach(p => {
      assert(p.type === 'Identifier')
      penv.symbols[p.name] = sym.parameter()
    })
    const body = ensureBlock(handleStatement(node.body, penv, index))

    return create.functionExpression(node.params as es.Identifier[], body)
  },
  Identifier(node: es.Identifier, env: pEnvironment, index: any): es.Expression {
    const symbol = env.find(node.name, false)
    if (symbol === null) {
      throw new Error(`Cannot find symbol ${node.name}`)
    }

    return symbol.type === 'Constant' ? symbol.node : node
  },
  ArrayExpression(node: es.ArrayExpression, env: pEnvironment, index: any): es.Expression {
    return create.arrayExpression(
      node.elements.map((elem, idx) => {
        assert(elem.type !== 'SpreadElement', 'Requirement: SpreadElement is not allowed')
        return handleExpression(elem, env, idx)
      })
    )
  },
  MemberExpression(node: es.MemberExpression, env: pEnvironment, index: any): es.Expression {
    assert(node.object.type !== 'Super')

    // Math.x
    if (
      node.object.type === 'Identifier' &&
      node.object.name === 'Math' &&
      node.property.type === 'Identifier' &&
      Math.hasOwnProperty(node.property.name)
    ) {
      return node
    }

    // General handling
    const object = handleExpression(node.object, env, index)
    const property = handleExpression(node.property, env, index)

    // xs[1]
    if (
      object.type === 'ArrayExpression' &&
      property.type === 'Literal' &&
      (typeof property.value === 'number' || typeof property.value === 'string')
    ) {
      const elem = object.elements[property.value]
      assert(elem.type !== 'SpreadElement')
      return elem
    }

    assert(object.type === 'Identifier', object.type)
    assert(property.type === 'Literal', property.type)
    assert(typeof property.value === 'number')

    return create.memberExpression(object, property.value)
  },
  UnaryExpression(node: es.UnaryExpression, env: pEnvironment, index: any): es.Expression {
    return optimize(
      create.unaryExpression(node.operator, handleExpression(node.argument, env, index))
    )
  },
  BinaryExpression(node: es.BinaryExpression, env: pEnvironment, index: any): es.Expression {
    return optimize(
      create.binaryExpression(
        node.operator,
        handleExpression(node.left, env, index),
        handleExpression(node.right, env, index)
      )
    )
  },
  LogicalExpression(node: es.LogicalExpression, env: pEnvironment, index: any): es.Expression {
    return optimize(
      create.logicalExpression(
        node.operator,
        handleExpression(node.left, env, index),
        handleExpression(node.right, env, index)
      )
    )
  },
  ConditionalExpression(
    node: es.ConditionalExpression,
    env: pEnvironment,
    index: any
  ): es.Expression {
    return optimize(
      create.conditionalExpression(
        handleExpression(node.test, env, index),
        handleExpression(node.consequent, env, index),
        handleExpression(node.alternate, env, index)
      )
    )
  },
  CallExpression(
    node: es.CallExpression,
    env: pEnvironment,
    index: any,
    force: boolean = false
  ): es.Expression {
    let callee = handleExpression(node.callee as es.Expression, env, index)

    /**
     * manually handle hardcoded function
     */
    if (callee.type === 'Identifier') {
      if (callee.name === 'length') {
        assert(node.arguments.length === 1)
        let xs = node.arguments[0]

        let len = 0
        while (xs.type === 'ArrayExpression') {
          assert(xs.elements.length === 2)
          xs = xs.elements[1] as es.Expression
          len++
        }

        assert(xs.type === 'Literal' && xs.value === null)

        return create.literal(len)
      }
    }

    /**
     * evaluate arguments
     */
    const args = node.arguments.map((arg, idx) => {
      assert(arg.type !== 'SpreadElement')
      return optimize(handleExpression(arg, env, idx))
    })

    if (callee.type === 'MemberExpression') {
      /**
       * for Math.x function, keep the function call
       */
      if (
        callee.object.type === 'Identifier' &&
        callee.object.name === 'Math' &&
        callee.property.type === 'Identifier' &&
        Math.hasOwnProperty(callee.property.name)
      ) {
        if (callee.property.name !== 'random' && args.every(arg => arg.type === 'Literal')) {
          return create.literal(
            Math[callee.property.name].apply(
              {},
              args.map(arg => (arg as es.Literal).value)
            )
          )
        }

        return create.callExpression(callee, args)
      }

      callee = handleExpression(callee, env, index)
    }

    /**
     * Unwrap function call
     */
    assert(callee.type === 'FunctionExpression', generate(callee))

    const penv = new pEnvironment(`HS${index}`, 'Substitute', env)
    for (const [param, arg] of zip(callee.params, args)) {
      assert(param && param.type === 'Identifier')
      assert(arg)
      penv.symbols[param.name] = sym.constant(arg)
    }

    const stmt = handleStatement(callee.body, penv, index)

    const result = stmt.pop()
    assert(result)

    if (result.type === 'ReturnStatement') {
      assert(result.argument)
      return optimize(result.argument)
    }

    throw new Error('unreachable code')
  }
}

const stmtHandler = {
  BlockStatement(node: es.BlockStatement, env: pEnvironment, index: any): es.Statement[] {
    const body: es.Statement[] = []
    const penv = new pEnvironment(`HB${index}`, 'Block', env)

    for (const idx in node.body) {
      body.push(...handleStatement(node.body[idx], penv, idx))
    }

    if (
      body.length === 3 &&
      body[0].type === 'VariableDeclaration' &&
      body[0].kind === 'let' &&
      body[0].declarations.length === 1 &&
      body[1].type === 'ExpressionStatement' &&
      body[1].expression.type === 'AssignmentExpression' &&
      body[2].type === 'ReturnStatement' &&
      body[2].argument
    ) {
      const decl = body[0].declarations[0]
      const expr = body[1].expression
      const ret = body[2].argument

      if (
        decl.id.type === 'Identifier' &&
        expr.left.type === 'Identifier' &&
        decl.id.name === expr.left.name &&
        ret.type === 'Identifier' &&
        ret.name === decl.id.name &&
        expr.operator === '='
      ) {
        return [create.returnStatement(expr.right)]
      }
    }

    return body
  },
  ReturnStatement(node: es.ReturnStatement, env: pEnvironment, index: any): es.Statement[] {
    assert(node.argument)
    return [create.returnStatement(handleExpression(node.argument, env, index))]
  },
  ForStatement(node: es.ForStatement, env: pEnvironment, index: any): es.Statement[] {
    /**
     * Try to unwind it to a single expression
     *
     * let answer = 0;
     * for (let i = 1; i <= fourier_expansion_level; i = i + 1) {
     *   answer = answer + math_sin(2 * math_PI * (2 * i - 1) * freq * t) / (2 * i - 1);
     * }
     */

    assert(node.init && node.init.type === 'VariableDeclaration')
    assert(node.init.declarations.length === 1)
    const loopVar = node.init.declarations[0]
    assert(loopVar.id.type === 'Identifier')
    assert(loopVar.init && loopVar.init.type === 'Literal')

    assert(node.update)
    const update = node.update.type === 'AssignmentExpression' ? optimize(node.update) : node.update
    assert(update.type === 'UpdateExpression' && update.operator === '++')
    assert(update.argument.type === 'Identifier' && update.operator === '++')
    assert(update.argument.name === loopVar.id.name)

    const test = node.test
    assert(test && test.type === 'BinaryExpression')
    assert(test.left.type === 'Identifier' && test.right.type === 'Literal')
    assert(test.operator === '<' || test.operator === '<=')
    assert(test.left.name === loopVar.id.name)

    const body =
      node.body.type === 'BlockStatement' && node.body.body.length === 1
        ? node.body.body[0]
        : node.body
    assert(body.type === 'ExpressionStatement')

    const expr = optimize(body.expression)
    assert(expr.type === 'AssignmentExpression' && expr.left.type === 'Identifier')
    assert(expr.operator === '+=')

    // start unwinding

    const elem: es.Expression[] = []
    const sup = test.right.value
    assert(typeof sup === 'number')
    let val = loopVar.init.value
    assert(typeof val === 'number')
    const predicate = (val: number, sup: number) => (test.operator === '<' ? val < sup : val <= sup)

    const senv = new pEnvironment(index, 'Loop', env)
    for (val; predicate(val, sup); val++) {
      senv.symbols[loopVar.id.name] = sym.constant(create.literal(val))
      elem.push(handleExpression(expr.right, senv, val))
    }

    const sumVar = handleExpression(expr.left, env, index)
    assert(sumVar.type === 'Identifier')

    assert(elem.length > 0)
    const result = create.assignmentExpression(sumVar, elem.shift() as es.Expression)
    while (elem.length > 0) {
      result.right = create.binaryExpression('+', result.right, elem.shift() as es.Expression)
    }

    return [create.expressionStatement(result)]
  },
  FunctionDeclaration(node: es.FunctionDeclaration, env: pEnvironment, index: any): es.Statement[] {
    assert(node.id, 'missing function name')

    env.symbols[node.id.name] = sym.constant(
      create.functionExpression(node.params as es.Identifier[], node.body)
    )

    return []
  },
  VariableDeclaration(node: es.VariableDeclaration, env: pEnvironment, index: any): es.Statement[] {
    if (node.kind === 'let') {
      const declarations = node.declarations.map((decl, idx) => {
        assert(decl.id.type === 'Identifier')
        assert(decl.init)

        const name = env.name(`VA${idx}_${decl.id.name}`)
        env.symbols[decl.id.name] = sym.constant(create.identifier(name))

        return create.declaration(name, 'let', handleExpression(decl.init, env, idx))
      })

      return declarations
    } else {
      /**
       * Constant variable declaration should have already been substituted in preprocessing
       */
      throw new Error('unreachable code')
    }
  }
}
