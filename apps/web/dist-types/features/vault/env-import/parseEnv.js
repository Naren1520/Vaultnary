export const MAX_ENV_FILE_BYTES = 1024 * 1024;
export const MAX_ENV_VARIABLES = 100;
export const MAX_ENV_KEY_LENGTH = 256;
export const MAX_ENV_VALUE_BYTES = 60 * 1024;
const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MAX_PARSE_ISSUES = 100;
function recordIssue(issues, issue) {
    if (issues.length < MAX_PARSE_ISSUES - 1) {
        issues.push(issue);
    }
    else if (issues.length === MAX_PARSE_ISSUES - 1) {
        issues.push({ line: issue.line, message: 'Additional parsing errors omitted.' });
    }
}
export function validateEnvVariables(variables, issues = []) {
    const validVariables = [];
    const seen = new Set();
    for (const variable of variables) {
        if (!KEY_PATTERN.test(variable.key) || variable.key.length > MAX_ENV_KEY_LENGTH) {
            issues.push({ line: variable.line, message: 'Variable name is invalid or too long.' });
            continue;
        }
        if (seen.has(variable.key)) {
            issues.push({
                line: variable.line,
                message: `Duplicate variable "${variable.key}". Resolve duplicates before importing.`,
            });
            continue;
        }
        if (new TextEncoder().encode(variable.value).byteLength > MAX_ENV_VALUE_BYTES) {
            issues.push({ line: variable.line, message: 'Variable value exceeds the 60 KB limit.' });
            continue;
        }
        seen.add(variable.key);
        validVariables.push(variable);
        if (validVariables.length > MAX_ENV_VARIABLES) {
            issues.push({
                line: variable.line,
                message: `Files may contain at most ${MAX_ENV_VARIABLES} variables.`,
            });
            issues.sort((left, right) => left.line - right.line);
            return { variables: [], issues };
        }
    }
    if (validVariables.length === 0 && issues.length === 0) {
        issues.push({ line: 1, message: 'No environment variables were found.' });
    }
    issues.sort((left, right) => left.line - right.line);
    return { variables: validVariables, issues };
}
function isEscaped(value, index) {
    let backslashes = 0;
    for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) {
        backslashes += 1;
    }
    return backslashes % 2 === 1;
}
function decodeDoubleQuoted(value) {
    return value.replace(/\\(["\\$nrt])/g, (_match, escaped) => {
        switch (escaped) {
            case 'n': return '\n';
            case 'r': return '\r';
            case 't': return '\t';
            default: return escaped;
        }
    });
}
export function parseEnv(source) {
    const variables = [];
    const issues = [];
    if (new TextEncoder().encode(source).byteLength > MAX_ENV_FILE_BYTES) {
        return {
            variables,
            issues: [{ line: 1, message: 'The environment file exceeds the 1 MB limit.' }],
        };
    }
    const lines = source.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
    for (let index = 0; index < lines.length; index += 1) {
        const lineNumber = index + 1;
        const line = lines[index].trim();
        if (!line || line.startsWith('#'))
            continue;
        const assignment = line.replace(/^export\s+/, '');
        const separator = assignment.indexOf('=');
        if (separator < 0) {
            recordIssue(issues, { line: lineNumber, message: 'Expected KEY=value assignment.' });
            continue;
        }
        const key = assignment.slice(0, separator).trim();
        let rawValue = assignment.slice(separator + 1).trimStart();
        let value = '';
        const quote = rawValue[0];
        if (quote === '"' || quote === "'" || quote === '`') {
            let closingLine = index;
            let closingIndex = -1;
            let current = rawValue;
            while (closingLine < lines.length) {
                for (let cursor = 1; cursor < current.length; cursor += 1) {
                    if (current[cursor] === quote && !isEscaped(current, cursor)) {
                        closingIndex = cursor;
                        break;
                    }
                }
                if (closingIndex >= 0)
                    break;
                closingLine += 1;
                if (closingLine >= lines.length)
                    break;
                current += `\n${lines[closingLine]}`;
            }
            if (closingIndex < 0) {
                recordIssue(issues, { line: lineNumber, message: 'Quoted value is not closed.' });
                index = closingLine;
                continue;
            }
            const remainder = current.slice(closingIndex + 1).trim();
            if (remainder && !remainder.startsWith('#')) {
                recordIssue(issues, { line: lineNumber, message: 'Unexpected text after the quoted value.' });
                index = closingLine;
                continue;
            }
            const quotedValue = current.slice(1, closingIndex);
            value = quote === '"' ? decodeDoubleQuoted(quotedValue) : quotedValue;
            index = closingLine;
        }
        else {
            rawValue = rawValue.replace(/\s+#.*$/, '').trimEnd();
            value = rawValue;
        }
        variables.push({ key, value, line: lineNumber });
        if (variables.length > MAX_ENV_VARIABLES) {
            recordIssue(issues, {
                line: lineNumber,
                message: `Files may contain at most ${MAX_ENV_VARIABLES} variables.`,
            });
            return { variables: [], issues };
        }
    }
    return validateEnvVariables(variables, issues);
}
