export interface Sql {
  run(query: string, params?: unknown[]): Promise<void>;
  all<T = Record<string, unknown>>(query: string, params?: unknown[]): Promise<T[]>;
}

export const MAX_PARAMS = 100;

export async function insertRows(
  sql: Sql,
  table: string,
  columns: readonly string[],
  rows: readonly (readonly unknown[])[],
  onConflict = '',
): Promise<number> {
  const per = Math.max(1, Math.floor(MAX_PARAMS / columns.length));
  const tuple = `(${columns.map(() => '?').join(', ')})`;
  for (let i = 0; i < rows.length; i += per) {
    const chunk = rows.slice(i, i + per);
    await sql.run(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${chunk.map(() => tuple).join(', ')} ${onConflict}`.trim(),
      chunk.flat(),
    );
  }
  return rows.length;
}

export const upsert = (keys: readonly string[], columns: readonly string[]): string => {
  const rest = columns.filter((c) => !keys.includes(c));
  return rest.length
    ? `ON CONFLICT (${keys.join(', ')}) DO UPDATE SET ${rest.map((c) => `${c} = excluded.${c}`).join(', ')}`
    : `ON CONFLICT (${keys.join(', ')}) DO NOTHING`;
};
