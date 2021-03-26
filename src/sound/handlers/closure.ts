import { Closure, ClosureTask, ClosureTaskResult, pEnvironment } from '../types'
import { create, declareAnonymousFunction } from '../utils'
// import { generate } from 'astring'
import { handleExpression } from './handler'
import { processExpression } from './pre-processor'
import { strict as assert } from 'assert'
import * as es from 'estree'

export default function handleClosure(name: string, closure: Closure): es.FunctionDeclaration {
  const tasks: ClosureTask[] = [new ClosureTask(name, closure)]
  const result: es.FunctionDeclaration[] = []
  const resultSet: Set<string> = new Set()

  while (tasks.length) {
    const task = tasks.pop()
    assert(task)

    if (!resultSet.has(task.name)) {
      const { prelude, target } = resolveClosureTask(task)
      assert(target.id && target.id.type === 'Identifier' && target.id.name === task.name)

      tasks.push(...prelude)
      result.unshift(target)
      resultSet.add(task.name)
    }
  }

  const target = result.pop()
  assert(target && target.id && target.id.type === 'Identifier')

  const { id, body } = target
  assert(id.name === name)
  body.body.unshift(...result)

  // try {
  //   console.debug(generate(body))
  // } catch (error) {
  //   console.warn(body)
  //   throw error
  // }

  /**
   * Recursively unwrap the function calls.
   */
  const penv = new pEnvironment(null, 'Closure', null)
  const funcexpr = create.functionExpression(
    target.params.map(p => {
      assert(p.type === 'Identifier')
      return p
    }),
    body
  )
  const func = handleExpression(funcexpr, penv, 0)
  assert(func.type === 'FunctionExpression')

  return declareAnonymousFunction(name, func)
}

function resolveClosureTask(task: ClosureTask): ClosureTaskResult {
  // pre-process the closure
  const { name, target } = task
  const { node, environment } = target

  const params = node.params.map(p => {
    assert(p.type === 'Identifier')
    return p
  })

  const body =
    node.body.type === 'BlockStatement'
      ? node.body
      : create.blockStatement([create.returnStatement(node.body)])

  // resolve the closure
  const penv = new pEnvironment(task.name, 'Closure', null)
  const result = processExpression(create.functionExpression(params, body), environment, penv)
  assert(result.type === 'FunctionExpression')

  // extract new tasks from penv
  assert(penv.previous === null)

  return new ClosureTaskResult(declareAnonymousFunction(name, result), penv.tasks)
}
