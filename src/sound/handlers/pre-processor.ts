// import { cloneDeep } from 'lodash'
import { Closure, ClosureTask, Environment, pEnvironment, sym } from '../types'
import { create, ensureBlock, searchEnvironment } from '../utils'
import { optimize, transformIfStatement } from './optimizer'
import { strict as assert } from 'assert'
import * as es from 'estree'

export function processExpression(
  node: es.Expression,
  cenv: Environment,
  penv: pEnvironment
): es.Expression {
  if (exprProcessor.hasOwnProperty(node.type)) {
    return exprProcessor[node.type](node, cenv, penv)
  } else {
    throw new Error(`unimplemented: cannot find expression pre-processor for ${node.type}`)
  }
}

export function processStatement(
  node: es.Statement,
  cenv: Environment,
  penv: pEnvironment
): es.Statement {
  if (stmtProcessor.hasOwnProperty(node.type)) {
    return stmtProcessor[node.type](node, cenv, penv)
  } else {
    throw new Error(`unimplemented: cannot find statement pre-processor for ${node.type}`)
  }
}

const exprProcessor = {
  Literal(node: es.Literal, cenv: Environment, penv: pEnvironment): es.Expression {
    return node
  },
  Identifier(node: es.Identifier, cenv: Environment, penv: pEnvironment): es.Expression {
    const symbol = penv.find(node.name)
    if (symbol) {
      return symbol.type === 'Constant' ? symbol.node : node
    }

    const [SymbolType, value] = searchEnvironment(node.name, cenv)

    const processor = {
      Element(value: any): es.Expression {
        if (['number', 'boolean', 'string', 'undefined'].includes(typeof value) || value === null) {
          return create.literal(value)
        }

        if (value instanceof Closure) {
          return processor.Closure(value)
        }

        if (value instanceof Array && value.length === 2) {
          return processor.Pair(value)
        }

        throw new Error(`Unexpected symbol value ${value}`)
      },
      Pair(value: any[]): es.Expression {
        return create.arrayExpression(value.map(processor.Element))
      },
      Closure(value: Closure): es.Expression {
        const rename = penv.name(node.name)
        penv.tasks.push(new ClosureTask(rename, value))
        return create.identifier(rename)
      }
    }

    switch (SymbolType) {
      case 'Literal':
      case 'Builtin':
        return value
      case 'Pair':
        return processor.Pair(value)
      case 'Closure':
        return processor.Closure(value)
      default:
        throw new Error('unimplemented: unknown environemnt entry')
    }
  },
  MemberExpression(
    node: es.MemberExpression,
    cenv: Environment,
    penv: pEnvironment
  ): es.Expression {
    assert(node.object.type !== 'Super', 'Assumption: the object cannot be Super')
    return {
      type: 'MemberExpression',
      object: processExpression(node.object, cenv, penv),
      property: processExpression(node.property, cenv, penv),
      computed: node.computed,
      optional: node.optional
    }
  },
  UnaryExpression(node: es.UnaryExpression, cenv: Environment, penv: pEnvironment) {
    return create.unaryExpression(node.operator, processExpression(node.argument, cenv, penv))
  },
  BinaryExpression(
    node: es.BinaryExpression,
    cenv: Environment,
    penv: pEnvironment
  ): es.Expression {
    return create.binaryExpression(
      node.operator,
      processExpression(node.left, cenv, penv),
      processExpression(node.right, cenv, penv)
    )
  },
  LogicalExpression(
    node: es.LogicalExpression,
    cenv: Environment,
    penv: pEnvironment
  ): es.Expression {
    return create.logicalExpression(
      node.operator,
      processExpression(node.left, cenv, penv),
      processExpression(node.right, cenv, penv)
    )
  },
  ConditionalExpression(
    node: es.ConditionalExpression,
    cenv: Environment,
    penv: pEnvironment
  ): es.Expression {
    return create.conditionalExpression(
      processExpression(node.test, cenv, penv),
      processExpression(node.consequent, cenv, penv),
      processExpression(node.alternate, cenv, penv)
    )
  },
  AssignmentExpression(
    node: es.AssignmentExpression,
    cenv: Environment,
    penv: pEnvironment
  ): es.Expression {
    assert(node.left.type === 'Identifier')
    const symbol = penv.find(node.left.name, true)
    assert(symbol && symbol.type === 'Variable', JSON.stringify(symbol))

    return optimize(
      create.assignmentExpression(node.left, processExpression(node.right, cenv, penv))
    )
  },
  CallExpression(node: es.CallExpression, cenv: Environment, penv: pEnvironment): es.Expression {
    assert(node.callee.type !== 'Super', 'Assumption: the callee cannot be Super')

    return create.callExpression(
      processExpression(node.callee, cenv, penv),
      node.arguments.map(arg => {
        assert(arg.type !== 'SpreadElement', 'function call parameters cannot be SpreadElement')
        return processExpression(arg, cenv, penv)
      })
    )
  },
  FunctionExpression(
    node: es.FunctionExpression,
    cenv: Environment,
    penv: pEnvironment
  ): es.Expression {
    assert(node.params.every(p => p.type === 'Identifier'))

    const p2env = new pEnvironment(`PF`, 'Function', penv)
    for (const param of node.params) {
      assert(param.type === 'Identifier')
      p2env.symbols[param.name] = sym.parameter()
    }
    const body = ensureBlock(processStatement(node.body, cenv, p2env))
    penv.tasks.push(...p2env.tasks)

    return create.functionExpression(node.params as es.Identifier[], body)
  },
  ArrowFunctionExpression(
    node: es.ArrowFunctionExpression,
    cenv: Environment,
    penv: pEnvironment
  ): es.Expression {
    assert(node.params.every(p => p.type === 'Identifier'))

    const body =
      node.body.type === 'BlockStatement'
        ? node.body
        : create.blockStatement([create.returnStatement(node.body)])

    return processExpression(
      create.functionExpression(node.params as es.Identifier[], body),
      cenv,
      penv
    )
  }
}

const stmtProcessor = {
  BlockStatement(node: es.BlockStatement, cenv: Environment, penv: pEnvironment): es.Statement {
    const p2env = new pEnvironment(`PB`, 'Block', penv)
    const body = node.body.map(stmt => processStatement(stmt, cenv, p2env))
    penv.tasks.push(...p2env.tasks)

    return ensureBlock(body)
  },
  ReturnStatement(node: es.ReturnStatement, cenv: Environment, penv: pEnvironment): es.Statement {
    assert(node.argument)
    return create.returnStatement(processExpression(node.argument, cenv, penv))
  },
  ExpressionStatement(
    node: es.ExpressionStatement,
    cenv: Environment,
    penv: pEnvironment
  ): es.Statement {
    return create.expressionStatement(processExpression(node.expression, cenv, penv))
  },
  IfStatement(node: es.IfStatement, cenv: Environment, penv: pEnvironment): es.Statement {
    return transformIfStatement({
      type: 'IfStatement',
      test: processExpression(node.test, cenv, penv),
      consequent: ensureBlock(processStatement(node.consequent, cenv, penv)),
      alternate: node.alternate
        ? ensureBlock(processStatement(node.alternate, cenv, penv))
        : node.alternate
    })
  },
  ForStatement(node: es.ForStatement, cenv: Environment, penv: pEnvironment): es.Statement {
    assert(node.test, 'unimplemented: for loop must have a test expression')

    const p2env = new pEnvironment(`PL`, 'Loop', penv)

    const init = node.init
      ? node.init.type === 'VariableDeclaration'
        ? (processStatement(node.init, cenv, p2env) as es.VariableDeclaration)
        : processExpression(node.init, cenv, p2env)
      : null
    const test = processExpression(node.test, cenv, p2env)
    const body = processStatement(node.body, cenv, p2env)
    const update = node.update ? processExpression(node.update, cenv, p2env) : null

    penv.tasks.push(...p2env.tasks)

    return {
      type: 'ForStatement',
      init,
      test,
      update,
      body
    }
  },
  VariableDeclaration(
    node: es.VariableDeclaration,
    cenv: Environment,
    penv: pEnvironment
  ): es.Statement {
    const { kind, declarations } = node

    for (const decl of declarations) {
      assert(decl.id.type === 'Identifier')
      assert(decl.init)
      if (kind === 'let') {
        penv.symbols[decl.id.name] = sym.variable(processExpression(decl.init, cenv, penv))
      } else {
        penv.symbols[decl.id.name] = sym.constant(processExpression(decl.init, cenv, penv))
      }
    }

    return node
  }
}
