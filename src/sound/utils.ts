import { Environment, SymbolType, Closure } from './types'
import * as create from '../utils/astCreator'
import * as es from 'estree'

export function declareAnonymousFunction(
  name: string,
  func: es.ArrowFunctionExpression | es.FunctionExpression
): es.FunctionDeclaration {
  const id = create.identifier(name)
  if (func.body.type !== 'BlockStatement') {
    func.body = create.blockStatement([create.returnStatement(func.body)])
  }
  return create.functionDeclaration(id, func.params, func.body)
}

export function ensureBlock(statements: es.Statement[] | es.Statement) {
  if (statements instanceof Array && statements.length === 1) {
    statements = statements[0]
  }

  if (statements instanceof Array) {
    return create.blockStatement(statements)
  } else if (statements.type === 'BlockStatement') {
    return statements
  } else {
    return create.blockStatement([statements])
  }
}

export function searchEnvironment(name: string, environment: Environment): [SymbolType, any] {
  let { head, tail } = environment

  if (head.hasOwnProperty(name)) {
    if (environment.name === 'global' && typeof head[name] === 'function') {
      if (name.startsWith('math_')) {
        return [
          'Builtin',
          create.memberExpression(create.identifier('Math'), name.substr('math_'.length))
        ]
      } else {
        return ['Builtin', create.identifier(name)]
      }
    }

    const value = head[name]

    if (['number', 'boolean', 'string', 'undefined'].includes(typeof value) || value === null) {
      return ['Literal', create.literal(value)]
    }

    if (value instanceof Closure) {
      return ['Closure', value]
    }

    if (value instanceof Array && value.length === 2) {
      return ['Pair', value]
    }

    throw new Error(`Unexpected symbol value ${value}`)
  }

  if (tail) {
    return searchEnvironment(name, tail)
  } else {
    throw new Error(`Cannot find symbol ${name} in the environment`)
  }
}

export { create }
