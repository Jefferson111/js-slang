import { create } from '../utils'
import { evaluateBinaryExpression, evaluateUnaryExpression } from '../../utils/operators'
import { strict as assert } from 'assert'
import * as es from 'estree'

function isEqual(node1: es.Expression, node2: es.Expression): boolean {
  if (node1.type !== node2.type) {
    return false
  }

  if (node1.type === 'Literal' && node2.type === 'Literal') {
    return node1.value === node2.value
  }

  if (node1.type === 'Identifier' && node2.type === 'Identifier') {
    return node1.name === node2.name
  }

  if (node1.type === 'BinaryExpression' && node2.type === 'BinaryExpression') {
    if (node1.operator != node2.operator) {
      return false
    }
    return isEqual(node1.left, node2.left) && isEqual(node1.right, node2.right)
  }

  return false
}

type Predicate = es.BinaryExpression | es.LogicalExpression

interface AtomicPredicate extends es.BinaryExpression {
  type: 'BinaryExpression'
  operator: '<' | '<=' | '>' | '>='
  left: es.Identifier
  right: es.Literal
}

function atomic(predicate: Predicate): AtomicPredicate | null {
  return predicate.type === 'BinaryExpression' &&
    predicate.left.type === 'Identifier' &&
    predicate.right.type === 'Literal' &&
    (predicate.operator === '<' ||
      predicate.operator === '<=' ||
      predicate.operator === '>' ||
      predicate.operator === '>=')
    ? (predicate as AtomicPredicate)
    : null
}

function resolveLogicalExpression(
  left: es.BinaryExpression,
  operator: '&&' | '||',
  right: es.BinaryExpression
): boolean | null {
  const l = atomic(left)
  const r = atomic(right)

  if (l && r) {
    const lVal = l.right.value
    const lOp = l.operator
    const rVal = r.right.value
    const rOp = r.operator

    assert(typeof lVal === 'number')
    assert(typeof rVal === 'number')

    if (operator === '&&') {
      if (lVal < rVal && (lOp === '<' || lOp === '<=') && (rOp === '>' || rOp === '>=')) {
        // (t < 0.3236 && t >= 1) === false
        return false
      }
      if (lVal === rVal && lOp === '<' && rOp === '>') {
        // (t < 0.3236 && t >= 1) === false
        return false
      }
    }
    if (operator === '||') {
    }
  }

  return null
}

export function optimize(node: es.Expression): es.Expression {
  if (optimizer.hasOwnProperty(node.type)) {
    return optimizer[node.type](node)
  } else {
    return node
  }
}

const optimizer = {
  AssignmentExpression(node: es.AssignmentExpression): es.Expression {
    const { operator, left, right } = node
    if (operator === '=' && left.type === 'Identifier' && right.type === 'BinaryExpression') {
      if (right.operator === '+') {
        const l = right.left
        const r = right.right

        if (l.type === 'Identifier' && left.name === l.name) {
          if (r.type === 'Literal' && r.value === 1) {
            return {
              type: 'UpdateExpression',
              operator: '++',
              argument: left,
              prefix: true
            }
          } else {
            return {
              type: 'AssignmentExpression',
              operator: '+=',
              left: left,
              right: r
            }
          }
        }
      }
    }

    return node
  },
  UnaryExpression(node: es.UnaryExpression): es.Expression {
    if (node.argument.type === 'Literal') {
      return create.literal(evaluateUnaryExpression(node.operator, node.argument.value))
    }

    return node
  },
  BinaryExpression(node: es.BinaryExpression): es.Expression {
    const left = optimize(node.left)
    const right = optimize(node.right)
    const { operator } = node

    if (node.left.type === 'Literal' && node.right.type === 'Literal') {
      return create.literal(
        evaluateBinaryExpression(node.operator, node.left.value, node.right.value)
      )
    }

    if (left.type === 'Literal') {
      if (left.value === 0) {
        if (operator === '+') {
          // 0 + Right === Right
          return right
        }
        if (operator === '*') {
          // 0 * Right === 0
          return create.literal(0)
        }
      }
      if (left.value === 1 && operator === '*') {
        // 1 * Right === Right
        return right
      }
    }

    if (right.type === 'BinaryExpression') {
      if (
        (operator === '+' && right.operator === '+') ||
        (operator === '*' && right.operator === '*')
      ) {
        // Left + (subLeft + subRight) === Left + subLeft + subRight
        // Left * (subLeft * subRight) === Left * subLeft * subRight
        return create.binaryExpression(
          operator,
          optimize(create.binaryExpression(operator, left, right.left)),
          right.right
        )
      }
    }

    if (right.type === 'Literal') {
      if (right.value === 0) {
        if (operator === '+' || operator === '-') {
          // Left + 0 === 0
          // Left - 0 === 0
          return left
        }
        if (operator === '*') {
          // Left * 0 === 0
          return create.literal(0)
        }
        if (operator === '<' && left.type === 'Identifier') {
          return create.literal(false)
        }
      }
      if (right.value === 1 && (operator === '*' || operator === '/')) {
        // Left * 1 === Left
        // Left / 1 === Left
        return left
      }
      if (left.type === 'BinaryExpression') {
        const subLeft = left.left
        const subRight = left.right
        const subOp = left.operator
        if (subOp === operator) {
          if (operator === '+' || operator === '*') {
            if (subLeft.type === 'Literal') {
              // (subLeft + subRight) + Right === subRight + (subLeft + Right)
              // (subLeft * subRight) * Right === subRight * (subLeft * Right)
              return create.binaryExpression(
                operator,
                create.literal(evaluateBinaryExpression(operator, subLeft.value, right.value)),
                subRight
              )
            }
            if (subRight.type === 'Literal') {
              // (subLeft + subRight) + Right === subLeft + (subRight + Right)
              // (subLeft * subRight) * Right === subLeft * (subRight * Right)
              return create.binaryExpression(
                operator,
                subLeft,
                create.literal(evaluateBinaryExpression(operator, subRight.value, right.value))
              )
            }
          }
          if (operator === '-' && subRight.type === 'Literal') {
            // (subLeft - subRight) - Right === subLeft - (subRight + Right)
            return create.binaryExpression(
              '-',
              subLeft,
              create.literal(evaluateBinaryExpression('+', subRight.value, right.value))
            )
          }
        }
        if (
          subOp === '-' &&
          subRight.type === 'Literal' &&
          (operator === '<' || operator === '>' || operator === '<=' || operator === '>=')
        ) {
          // subLeft - subRight < Right === subLeft < subRight + subLeft
          return create.binaryExpression(
            operator,
            subLeft,
            create.literal(evaluateBinaryExpression('+', subRight.value, right.value))
          )
        }
      }
    }

    // if (left.type === 'ConditionalExpression') {
    //   // (predicate ? conseq : alternate) * T = (predicate ? conseq * T : alternate * T)
    //   assert(left.alternate)
    //   return optimize(
    //     create.conditionalExpression(
    //       left.test,
    //       this.BinaryExpression(create.binaryExpression(operator, left.consequent, right)),
    //       this.BinaryExpression(create.binaryExpression(operator, left.alternate, right))
    //     )
    //   )
    // }

    // if (right.type === 'ConditionalExpression') {
    //   // (predicate ? conseq : alternate) * T = (predicate ? conseq * T : alternate * T)
    //   assert(right.alternate)
    //   return optimize(
    //     create.conditionalExpression(
    //       right.test,
    //       this.BinaryExpression(create.binaryExpression(operator, left, right.consequent)),
    //       this.BinaryExpression(create.binaryExpression(operator, left, right.alternate))
    //     )
    //   )
    // }

    return node
  },
  LogicalExpression(node: es.LogicalExpression): es.Expression {
    // console.log(generate(node))
    const { operator, left, right } = node
    assert(operator != '??')

    if (left.type === 'Literal') {
      if (operator === '&&') {
        // true && p === p
        // false && p === false
        return left.value ? right : left
      } else {
        // true || p === true
        // false || p === p
        return left.value ? left : right
      }
    }

    if (right.type === 'Literal') {
      if (operator === '&&') {
        // p && true === p
        // p && false === false
        return right.value ? left : right
      } else {
        // p || true === true
        // p || false === p
        return right.value ? right : left
      }
    }

    if (left.type === 'BinaryExpression' && right.type === 'BinaryExpression') {
      const ret = resolveLogicalExpression(left, operator, right)
      if (ret !== null) {
        return create.literal(ret)
      }
    }

    return node
  },
  ConditionalExpression(node: es.ConditionalExpression): es.Expression {
    function hasSideEffect(node: es.Expression): boolean {
      switch (node.type) {
        case 'Literal':
        case 'Identifier':
          return false
        case 'BinaryExpression':
        case 'LogicalExpression':
          return (
            hasSideEffect((node as es.BinaryExpression).left) ||
            hasSideEffect((node as es.BinaryExpression).right)
          )
        case 'ConditionalExpression':
          return hasSideEffect(node.test)
        default:
          return true
      }
    }

    let { test, consequent, alternate } = node
    consequent = optimize(consequent)
    alternate = optimize(alternate)

    if (test.type === 'Literal') {
      if (test.value) {
        return consequent
      } else {
        return alternate
      }
    }

    if (!hasSideEffect(test) && isEqual(consequent, alternate)) {
      // p ? X : X
      // p -> X ; \neg p -> X
      return consequent
    }

    while (consequent.type === 'ConditionalExpression' && isEqual(test, consequent.test)) {
      // p ? (p : C2 : A2) : A
      // p -> C2 ; \neg P -> A
      consequent = consequent.consequent
    }

    while (alternate.type === 'ConditionalExpression' && isEqual(test, alternate.test)) {
      // p ? C : (p : C2 : A2)
      // p -> C ; \neg P -> A2
      alternate = alternate.alternate
    }

    // if (consequent.type === 'ConditionalExpression') {
    //   if (
    //     test.type === 'BinaryExpression' &&
    //     consequent.test.type === 'LogicalExpression' &&
    //     consequent.test.operator === '||' &&
    //     consequent.test.left.type === 'BinaryExpression'
    //   ) {
    //     const pred = this.LogicalExpression(
    //       create.logicalExpression('&&', test, consequent.test.left)
    //     )
    //     if (pred.type === 'Literal') {
    //       if (pred.value === false) {
    //         consequent.test = consequent.test.right
    //       } else {
    //         consequent = consequent.consequent
    //       }
    //     }
    //   }
    // }

    if (consequent.type === 'ConditionalExpression') {
      const pred = this.LogicalExpression(create.logicalExpression('&&', test, consequent.test))
      if (pred.type === 'Literal') {
        if (pred.value) {
          consequent = consequent.consequent
        } else {
          consequent = consequent.alternate
        }
      }
    }

    return create.conditionalExpression(test, consequent, alternate)
  }
}

export function transformIfStatement(node: es.IfStatement): es.Statement {
  if (node.alternate && node.alternate.type === 'BlockStatement') {
    const body = node.alternate.body
    if (body.length === 1 && body[0].type === 'IfStatement') {
      node.alternate = node.alternate.body[0]
    }
  }

  if (node.alternate) {
    const consequent =
      node.consequent.type === 'BlockStatement' && node.consequent.body.length === 1
        ? node.consequent.body[0]
        : node.consequent

    const alternate =
      node.alternate.type === 'BlockStatement' && node.alternate.body.length === 1
        ? node.alternate.body[0]
        : node.alternate

    if (
      consequent.type === 'ReturnStatement' &&
      alternate.type === 'ReturnStatement' &&
      consequent.argument &&
      alternate.argument
    ) {
      return create.returnStatement(
        optimize(create.conditionalExpression(node.test, consequent.argument, alternate.argument))
      )
    }
  }
  return node
}
