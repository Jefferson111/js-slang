import { Context } from '../types'
import { evaluate } from '../interpreter/interpreter'
import handleClosure from './handlers/closure'
import { searchEnvironment } from './utils'
import * as es from 'estree'

export function transpile(target: string, program: es.Node, context: Context): es.Node {
  let it = evaluate(program, context)
  let result = it.next()
  while (!result.done) {
    result = it.next()
  }

  return partialEvaluate(target, context)
}

function partialEvaluate(target: string, context: Context): es.Node {
  /**
   * Find the target symbol from the context
   */
  const [symbolType, value] = searchEnvironment(target, context.runtime.environments[0])
  // console.debug(`Transpile Target (${symbolType}) ${value}`)

  switch (symbolType) {
    case 'Literal':
      /**
       * It can be a literal, for example, duration
       */
      return value
    case 'Closure':
      /**
       * It can be a closure, for example, wave
       */
      return handleClosure(target, value)
    default:
      throw new Error('unimplemented unknown environemnt entry')
  }
}
