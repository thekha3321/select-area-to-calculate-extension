export interface Stats {
  numbers: number[]
  sum: number
  average: number
  min: number
  max: number
  count: number
}

export function calculateStats(numbers: number[]): Stats {
  const sum = numbers.reduce((a, b) => a + b, 0)
  return {
    numbers,
    count: numbers.length,
    sum,
    average: numbers.length ? sum / numbers.length : 0,
    min: numbers.length ? Math.min(...numbers) : 0,
    max: numbers.length ? Math.max(...numbers) : 0,
  }
}

/**
 * Evaluates a formula like "SUM * 0.1" or "MAX - MIN".
 * Supported tokens: SUM, AVG, MIN, MAX, COUNT + arithmetic operators.
 * Uses a recursive descent parser — no eval/Function constructor.
 */
export function evaluateFormula(formula: string, numbers: number[]): number {
  if (!formula.trim()) throw new Error('Empty formula')
  const s = calculateStats(numbers)

  const expr = formula
    .replace(/\bSUM\b/gi, String(s.sum))
    .replace(/\bAVERAGE\b/gi, String(s.average))
    .replace(/\bAVG\b/gi, String(s.average))
    .replace(/\bMIN\b/gi, String(s.min))
    .replace(/\bMAX\b/gi, String(s.max))
    .replace(/\bCOUNT\b/gi, String(s.count))

  return parse(expr)
}

// Recursive descent parser for arithmetic expressions
// Grammar: expr = term (('+' | '-') term)*
//          term = factor (('*' | '/' | '%') factor)*
//          factor = ('+' | '-') factor | '(' expr ')' | number
function parse(input: string): number {
  let pos = 0

  const ws = () => { while (pos < input.length && input[pos] === ' ') pos++ }

  const parseExpr = (): number => {
    let v = parseTerm()
    ws()
    while (pos < input.length && (input[pos] === '+' || input[pos] === '-')) {
      const op = input[pos++]; ws()
      v = op === '+' ? v + parseTerm() : v - parseTerm()
      ws()
    }
    return v
  }

  const parseTerm = (): number => {
    let v = parseFactor()
    ws()
    while (pos < input.length && (input[pos] === '*' || input[pos] === '/' || input[pos] === '%')) {
      const op = input[pos++]; ws()
      const r = parseFactor(); ws()
      if (op === '*') v *= r
      else if (op === '/') v /= r
      else v %= r
    }
    return v
  }

  const parseFactor = (): number => {
    ws()
    if (input[pos] === '-') { pos++; return -parseFactor() }
    if (input[pos] === '+') { pos++; return parseFactor() }
    if (input[pos] === '(') {
      pos++
      const v = parseExpr()
      ws()
      if (input[pos] !== ')') throw new Error('Missing closing parenthesis')
      pos++
      return v
    }
    const m = input.slice(pos).match(/^[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?/)
    if (!m) throw new Error(`Unexpected token at: ${input.slice(pos, pos + 8)}`)
    pos += m[0].length
    return parseFloat(m[0])
  }

  const result = parseExpr()
  ws()
  if (pos < input.length) throw new Error(`Unexpected token at: ${input.slice(pos, pos + 8)}`)
  return result
}
