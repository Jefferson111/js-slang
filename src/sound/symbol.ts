import * as es from 'estree'

export interface SymbolBase {
  type: string
  node: es.Expression | null
}

export interface Parameter extends SymbolBase {
  type: 'Parameter'
  node: null
}

export interface Variable extends SymbolBase {
  type: 'Variable'
  node: es.Expression | null
}

export interface Constant extends SymbolBase {
  type: 'Constant'
  node: es.Expression
}

export interface Hardcode extends SymbolBase {
  type: 'Hardcode'
  node: es.Expression
}

export function parameter(): Parameter {
  return {
    type: 'Parameter',
    node: null
  }
}

export function variable(node: es.Expression | null): Variable {
  return {
    type: 'Variable',
    node
  }
}

export function constant(node: es.Expression): Constant {
  return {
    type: 'Constant',
    node
  }
}

export function hardcode(node: es.Expression): Hardcode {
  return {
    type: 'Hardcode',
    node
  }
}

export type Symbol = Parameter | Variable | Constant | Hardcode
