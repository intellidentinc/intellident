export function csvCell(value) {
  let text = String(value ?? '');
  if (typeof value !== 'number' && /^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
