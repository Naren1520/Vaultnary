import { describe, expect, it } from 'vitest'
import { detectCsvFormat, parseCsv } from './parseCsv'

describe('parseCsv', () => {
  it('parses aliases, CRLF, quoted commas, escaped quotes, and multiline values', () => {
    const result = parseCsv(
      'KEY,VALUE,DESCRIPTION\r\n' +
      'DATABASE_URL,"postgres://user,pass@localhost/db","primary, db"\r\n' +
      'CERTIFICATE,"line one\r\nline ""two""",multiline',
    )

    expect(result.issues).toEqual([])
    expect(result.variables.map(({ key, value, line }) => [key, value, line])).toEqual([
      ['DATABASE_URL', 'postgres://user,pass@localhost/db', 2],
      ['CERTIFICATE', 'line one\nline "two"', 3],
    ])
  })

  it('detects CSV headers with quotes and normalizes header aliases', () => {
    expect(detectCsvFormat('"Variable Name","Secret"\nTOKEN,value')).toBe(true)
    expect(parseCsv('Variable Name,Secret\nTOKEN,value').variables[0].key).toBe('TOKEN')
  })

  it('reports duplicate names and invalid variable keys', () => {
    const result = parseCsv('NAME,VALUE\nTOKEN,one\nTOKEN,two\n1INVALID,bad')

    expect(result.variables.map(({ key }) => key)).toEqual(['TOKEN'])
    expect(result.issues).toEqual([
      { line: 3, message: 'Duplicate variable "TOKEN". Resolve duplicates before importing.' },
      { line: 4, message: 'Variable name is invalid or too long.' },
    ])
  })

  it('rejects missing and ambiguous key or value headers', () => {
    expect(parseCsv('NAME,OTHER\nTOKEN,value').issues[0].message).toContain(
      'name/key and a value/secret column header',
    )
    expect(parseCsv('NAME,KEY,VALUE\nTOKEN,TOKEN,value').issues[0].message).toContain(
      'name/key and a value/secret column header',
    )
    expect(parseCsv('NAME,VALUE,SECRET\nTOKEN,value,another').issues[0].message).toContain(
      'name/key and a value/secret column header',
    )
  })

  it('reports malformed quoting and rows with the source line', () => {
    const malformedQuote = parseCsv('NAME,VALUE\nTOKEN,"unfinished')
    expect(malformedQuote.issues).toContainEqual({
      line: 2,
      message: 'Quoted CSV field is not closed.',
    })

    const malformedRow = parseCsv('NAME,VALUE\nTOKEN,one,extra')
    expect(malformedRow.issues).toContainEqual({
      line: 2,
      message: 'Expected 2 CSV columns, but found 3.',
    })
  })

  it('limits values by UTF-8 bytes and rejects oversized input', () => {
    expect(parseCsv(`NAME,VALUE\nTOKEN,${'é'.repeat(31 * 1024)}`).issues[0].message).toContain(
      '60 KB limit',
    )
    expect(parseCsv(`NAME,VALUE\nTOKEN,${'x'.repeat(1024 * 1024)}`).issues[0].message).toContain(
      '1 MB limit',
    )
  })

  it('limits the number of CSV variables', () => {
    const rows = Array.from({ length: 101 }, (_, index) => `KEY_${index},value`)
    const result = parseCsv(`NAME,VALUE\n${rows.join('\n')}`)

    expect(result.variables).toEqual([])
    expect(result.issues[0].message).toContain('at most 100 variables')
  })
})
