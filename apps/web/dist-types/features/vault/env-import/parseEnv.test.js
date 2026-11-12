import { describe, expect, it } from 'vitest';
import { parseEnv } from './parseEnv';
describe('parseEnv', () => {
    it('parses comments, export prefixes, whitespace, and inline comments', () => {
        const result = parseEnv(`
# deployment config
export API_URL = https://example.test/path # public endpoint
TOKEN=abc#part-of-value
EMPTY=
`);
        expect(result.issues).toEqual([]);
        expect(result.variables.map(({ key, value }) => [key, value])).toEqual([
            ['API_URL', 'https://example.test/path'],
            ['TOKEN', 'abc#part-of-value'],
            ['EMPTY', ''],
        ]);
    });
    it('parses quoted values, escaped newlines, and multiline secrets', () => {
        const result = parseEnv('DOUBLE="line one\\nline two"\nSINGLE=\'literal $value\'\nCERT="first line\nsecond line"');
        expect(result.issues).toEqual([]);
        expect(result.variables.map(({ key, value }) => [key, value])).toEqual([
            ['DOUBLE', 'line one\nline two'],
            ['SINGLE', 'literal $value'],
            ['CERT', 'first line\nsecond line'],
        ]);
    });
    it('reports invalid lines, duplicate names, and unclosed quotes', () => {
        const result = parseEnv('NOT AN ASSIGNMENT\nTOKEN=one\nTOKEN=two\nBROKEN="unfinished');
        expect(result.variables.map(({ key }) => key)).toEqual(['TOKEN']);
        expect(result.issues).toEqual([
            { line: 1, message: 'Expected KEY=value assignment.' },
            { line: 3, message: 'Duplicate variable "TOKEN". Resolve duplicates before importing.' },
            { line: 4, message: 'Quoted value is not closed.' },
        ]);
    });
    it('rejects invalid keys and unexpected text after a quoted value', () => {
        const result = parseEnv('1BAD=value\nGOOD="value" trailing');
        expect(result.variables).toEqual([]);
        expect(result.issues).toHaveLength(2);
        expect(result.issues[0].line).toBe(1);
        expect(result.issues[1].line).toBe(2);
    });
    it('rejects files that exceed the input size limit', () => {
        const result = parseEnv(`VALUE=${'x'.repeat(1024 * 1024)}`);
        expect(result.variables).toEqual([]);
        expect(result.issues[0].message).toContain('1 MB limit');
    });
    it('limits values by UTF-8 byte length to stay within the encrypted payload limit', () => {
        const result = parseEnv(`VALUE=${'é'.repeat(31 * 1024)}`);
        expect(result.variables).toEqual([]);
        expect(result.issues[0].message).toContain('60 KB limit');
    });
});
