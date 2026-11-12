import {
  MAX_ENV_FILE_BYTES,
  MAX_ENV_VARIABLES,
  type EnvParseIssue,
  type EnvParseResult,
  type EnvVariable,
  validateEnvVariables,
} from './parseEnv'

interface CsvRow {
  cells: string[]
  line: number
}

const KEY_HEADERS = new Set(['name', 'key', 'variable', 'variable_name', 'environment_variable'])
const VALUE_HEADERS = new Set(['value', 'secret', 'variable_value'])
const MAX_PARSE_ISSUES = 100

function recordIssue(issues: EnvParseIssue[], issue: EnvParseIssue): void {
  if (issues.length < MAX_PARSE_ISSUES - 1) {
    issues.push(issue)
  } else if (issues.length === MAX_PARSE_ISSUES - 1) {
    issues.push({ line: issue.line, message: 'Additional CSV errors omitted.' })
  }
}

function isBlankRow(cells: string[]): boolean {
  return cells.every((cell) => cell.trim() === '')
}

function parseCsvRows(source: string): { rows: CsvRow[]; issues: EnvParseIssue[] } {
  const rows: CsvRow[] = []
  const issues: EnvParseIssue[] = []
  let cells: string[] = []
  let field = ''
  let line = 1
  let rowLine = 1
  let inQuotes = false
  let quoteClosed = false
  let rowInvalid = false
  let atFieldStart = true

  const finishField = () => {
    cells.push(field)
    field = ''
    atFieldStart = true
    quoteClosed = false
  }

  const finishRow = () => {
    finishField()
    if (!rowInvalid && !isBlankRow(cells)) {
      rows.push({ cells, line: rowLine })
      if (rows.length > MAX_ENV_VARIABLES + 1) {
        recordIssue(issues, {
          line: rowLine,
          message: `Files may contain at most ${MAX_ENV_VARIABLES} variables.`,
        })
      }
    }
    cells = []
    rowInvalid = false
    rowLine = line + 1
  }

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]

    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
          quoteClosed = true
        }
      } else {
        if (character === '\r' && source[index + 1] === '\n') index += 1
        if (character === '\r' || character === '\n') line += 1
        field += character === '\r' ? '\n' : character
      }
      continue
    }

    if (character === ',') {
      finishField()
      continue
    }
    if (character === '\r' || character === '\n') {
      if (character === '\r' && source[index + 1] === '\n') index += 1
      finishRow()
      line += 1
      rowLine = line
      if (issues.some(({ message }) => message.startsWith('Files may contain at most'))) {
        return { rows, issues }
      }
      continue
    }
    if (quoteClosed) {
      if (character === ' ' || character === '\t') continue
      recordIssue(issues, { line, message: 'Unexpected character after a quoted CSV field.' })
      rowInvalid = true
      continue
    }
    if (character === '"' && atFieldStart) {
      field = ''
      inQuotes = true
      atFieldStart = false
      continue
    }
    if (character === '"') {
      recordIssue(issues, { line, message: 'A quote must start at the beginning of a CSV field.' })
      rowInvalid = true
      field += character
      atFieldStart = false
      continue
    }
    field += character
    if (character !== ' ' && character !== '\t') atFieldStart = false
  }

  if (inQuotes) {
    recordIssue(issues, { line: rowLine, message: 'Quoted CSV field is not closed.' })
  } else if (cells.length > 0 || field.length > 0) {
    finishRow()
  }

  if (issues.some(({ message }) => message.startsWith('Files may contain at most'))) {
    return { rows, issues }
  }
  return { rows, issues }
}

function normalizeHeader(value: string): string {
  return value.trim().replace(/^\uFEFF/, '').toLowerCase().replace(/[\s-]+/g, '_')
}

export function detectCsvFormat(source: string): boolean {
  const firstRow = parseCsvRows(source.replace(/^\uFEFF/, '')).rows[0]
  if (!firstRow) return false
  const headers = firstRow.cells.map(normalizeHeader)
  return headers.some((header) => KEY_HEADERS.has(header))
    && headers.some((header) => VALUE_HEADERS.has(header))
}

export function parseCsv(source: string): EnvParseResult {
  if (new TextEncoder().encode(source).byteLength > MAX_ENV_FILE_BYTES) {
    return {
      variables: [],
      issues: [{ line: 1, message: 'The CSV file exceeds the 1 MB limit.' }],
    }
  }

  const { rows, issues } = parseCsvRows(source.replace(/^\uFEFF/, ''))
  if (issues.some(({ message }) => message.startsWith('Files may contain at most'))) {
    return { variables: [], issues }
  }
  if (rows.length === 0) {
    return {
      variables: [],
      issues: issues.length > 0
        ? issues
        : [{ line: 1, message: 'The CSV file is empty.' }],
    }
  }

  const headers = rows[0].cells.map(normalizeHeader)
  const keyHeaders = headers.filter((header) => KEY_HEADERS.has(header))
  const valueHeaders = headers.filter((header) => VALUE_HEADERS.has(header))
  const keyIndex = headers.findIndex((header) => KEY_HEADERS.has(header))
  const valueIndex = headers.findIndex((header) => VALUE_HEADERS.has(header))
  if (
    keyIndex < 0 ||
    valueIndex < 0 ||
    keyIndex === valueIndex ||
    keyHeaders.length !== 1 ||
    valueHeaders.length !== 1
  ) {
    return {
      variables: [],
      issues: [
        ...issues,
        { line: rows[0].line, message: 'CSV needs a name/key and a value/secret column header, such as NAME,VALUE.' },
      ],
    }
  }

  const variables: EnvVariable[] = []
  for (const row of rows.slice(1)) {
    if (row.cells.length !== headers.length) {
      recordIssue(issues, {
        line: row.line,
        message: `Expected ${headers.length} CSV columns, but found ${row.cells.length}.`,
      })
      continue
    }

    const key = row.cells[keyIndex].trim()
    const value = row.cells[valueIndex]
    if (!key && value.trim() === '') continue
    variables.push({ key, value, line: row.line })
    if (variables.length > MAX_ENV_VARIABLES) {
      issues.push({
        line: row.line,
        message: `Files may contain at most ${MAX_ENV_VARIABLES} variables.`,
      })
      return { variables: [], issues }
    }
  }

  return validateEnvVariables(variables, issues)
}
