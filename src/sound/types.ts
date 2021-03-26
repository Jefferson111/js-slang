import { create } from './utils'
import { Environment } from '../types'
import * as es from 'estree'
import * as sym from './symbol'
import Closure from '../interpreter/closure'

// type BoundVariables = {
//   [name: string]:
//     | 'FunctionParameter'
//     | 'MutableDeclaration'
//     | 'ConstantDeclaration'
//     | es.FunctionDeclaration
// }

type SymbolType = 'Builtin' | 'Literal' | 'Closure' | 'Pair'

class ClosureTask {
  constructor(public name: string, public target: Closure) {}
}

class ClosureTaskResult {
  constructor(public target: es.FunctionDeclaration, public prelude: ClosureTask[]) {}
}

type pEnvironmentType = 'Closure' | 'Block' | 'Loop' | 'Substitute' | 'Function'

const manual = ['length']

class pEnvironment {
  id: any[]
  type: pEnvironmentType
  previous: pEnvironment | null
  symbols: { [name: string]: sym.Symbol } = {}
  tasks: ClosureTask[] = []

  constructor(id: any, type: pEnvironmentType, parent: pEnvironment | null) {
    this.id = parent ? [...parent.id, id] : id ? [id] : []
    this.type = type
    this.previous = parent
  }

  find(name: string, write: boolean = false): sym.Symbol | null {
    if (this.symbols.hasOwnProperty(name)) {
      return this.symbols[name]
    } else if (write && this.type === 'Closure') {
      /**
       * This checks if the closure is a pure fucntion
       * by checking if the written variable is declared within the closure
       */
      throw new Error(`Looking for ${name}, The function may not be pure`)
    } else if (this.previous !== null) {
      return this.previous.find(name, write)
    } else if (manual.includes(name)) {
      return sym.hardcode(create.identifier(name))
    }

    return null
  }

  name(name: any): string {
    return `$${[...this.id, name].join('')}`
  }
}

export type { Environment }
export { Closure, pEnvironment, ClosureTask, ClosureTaskResult, SymbolType, sym }
