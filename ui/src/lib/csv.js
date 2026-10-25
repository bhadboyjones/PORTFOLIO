// Client-side CSV download for the data behind any chart.

function cell(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** rows: array of plain objects; columns: [[key, header], ...] */
export function toCsv(rows, columns) {
  const head = columns.map(([, h]) => cell(h)).join(",");
  const body = rows.map((r) => columns.map(([k]) => cell(r[k])).join(","));
  return [head, ...body].join("\n");
}

export function downloadCsv(filename, rows, columns) {
  const blob = new Blob([toCsv(rows, columns)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
