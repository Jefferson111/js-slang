import { transpile } from './interpret'
import * as es from 'estree'
import { prelude,  parseSource } from './__tests__/.utils'

function findTarget() : string {
    return 'wave'
}

export function transpileToSound(program: es.Program) {
    const target = findTarget()
    return transpile(target, ...parseSource(prelude + program))
}