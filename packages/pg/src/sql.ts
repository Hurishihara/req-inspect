const LEADING_COMMENTS = String.raw`(?:\s*(?:--[^\n]*(?:\n|$)|/\*[\s\S]*?\*/))*`
const OPERATION = new RegExp(String.raw`^${LEADING_COMMENTS}\s*([a-z]+)`, 'i')
const IDENT = String.raw`(?:"(?:[^"]|"")+"|[\w$]+)`
const TARGET = new RegExp(String.raw`\b(?:from|into|update|join)\s+(${IDENT}(?:\s*\.\s*${IDENT})*)`, 'i')

/** The first SQL keyword, uppercased; `QUERY` when there is none. */
export const sqlOperation = (text: string): string => OPERATION.exec(text)?.[1]?.toUpperCase() ?? 'QUERY'

/** Best-effort table name: the identifier after the first `from`, `into`, `update` or `join`. */
export const sqlTarget = (text: string): string | null =>
  TARGET.exec(text)?.[1]?.replace(/\s+/g, '').replace(/"/g, '') ?? null

// Quoted identifiers pass through; string and standalone numeric literals become `?` (not `$1`, not `t1`).
const LITERALS = /"(?:[^"]|"")*"|'(?:[^']|'')*'|(?<![\w$.])\d+(?:\.\d+)?(?:e[+-]?\d+)?(?![\w$])/gi

/** Whitespace-collapsed statement with inline string and numeric literals replaced by `?`. */
export const sqlFingerprint = (text: string): string =>
  text
    .replace(LITERALS, (m) => (m.startsWith('"') ? m : '?'))
    .replace(/\s+/g, ' ')
    .trim()
