export function output(data: unknown, json: boolean): void {
  if (json) {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
  } else if (typeof data === "string") {
    process.stdout.write(data + "\n");
  } else if (Array.isArray(data)) {
    printTable(data);
  } else if (typeof data === "object" && data !== null) {
    for (const [key, value] of Object.entries(data)) {
      process.stdout.write(`${key}: ${value}\n`);
    }
  }
}

function printTable(rows: Record<string, unknown>[]): void {
  if (rows.length === 0) {
    process.stdout.write("(empty)\n");
    return;
  }
  const keys = Object.keys(rows[0]);
  const widths = keys.map((k) =>
    Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length)),
  );
  const header = keys.map((k, i) => k.padEnd(widths[i])).join("  ");
  const sep = widths.map((w) => "─".repeat(w)).join("──");
  process.stdout.write(`${header}\n${sep}\n`);
  for (const row of rows) {
    const line = keys.map((k, i) => String(row[k] ?? "").padEnd(widths[i])).join("  ");
    process.stdout.write(`${line}\n`);
  }
}

export function error(msg: string): never {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(1);
}
