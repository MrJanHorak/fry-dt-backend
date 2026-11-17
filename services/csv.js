/**
 * Small CSV writer. Protects against spreadsheet formula injection: a cell
 * starting with = + - @ (or tab/CR) is prefixed with an apostrophe so Excel
 * and Google Sheets show it as text instead of running it.
 */
const DANGEROUS_START = /^[=+\-@\t\r]/

export function csvCell(value) {
  if (value === null || value === undefined) return ''
  let text = value instanceof Date ? value.toISOString() : String(value)
  if (DANGEROUS_START.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * @param {object[]} rows
 * @param {{key: string, label: string, value?: (row) => any}[]} columns
 */
export function toCsv(rows, columns) {
  const header = columns.map((c) => csvCell(c.label)).join(',')
  const lines = rows.map((row) =>
    columns.map((c) => csvCell(c.value ? c.value(row) : row[c.key])).join(',')
  )
  // BOM so Excel opens UTF-8 (names with accents) correctly
  return '﻿' + [header, ...lines].join('\r\n') + '\r\n'
}

export function sendCsv(res, filename, csv) {
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename.replace(/[^\w.-]/g, '_')}"`,
    'Cache-Control': 'no-store'
  })
  res.send(csv)
}
