type Cell = string | number | null | undefined;

/**
 * RFC 4180 CSV with a BOM so Excel opens UTF-8 correctly. Cells that start
 * with =, +, - or @ are prefixed with ' so spreadsheets don't run them as
 * formulas (CSV injection), but real numbers are left alone.
 */
export function toCsv(header: string[], rows: Cell[][]): string {
  const cell = (value: Cell): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") return String(value);
    let text = value;
    if (/^[=+\-@\t\r]/.test(text) && !/^[+-]?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return "﻿" + [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
