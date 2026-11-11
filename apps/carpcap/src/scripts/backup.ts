import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { closeDatabase, connectDatabase, queryObjects } from '../db/client';

const SKIPPED_TABLES = new Set(['prices']);

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Unexpected table name: ${name}`);
  return `"${name}"`;
}

async function main() {
  const backupDir = path.join(process.cwd(), "backups");
  await fs.mkdir(backupDir, { recursive: true });
  await connectDatabase();
  const tables = await queryObjects<{ name: string }>(
    "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '\\_cf\\_%' escape '\\' order by name",
  );
  const names = tables.map((row) => row.name).filter((name) => !SKIPPED_TABLES.has(name));
  console.log(`Found ${names.length} tables (excluding prices).`);
  for (const tableName of names) {
    console.log(`\n=== Backing up table: ${tableName} ===`);
    const rows = await queryObjects<Record<string, unknown>>(`select * from ${quoteIdent(tableName)}`);
    const filePath = path.join(backupDir, `${tableName}.json`);
    await fs.writeFile(filePath, JSON.stringify(rows, null, 2), "utf8");
    console.log(`Done: ${tableName} (${rows.length} rows saved to ${filePath}).`);
  }
  console.log("\nBackup completed.");
  await closeDatabase();
}

main().catch(async (err) => {
  console.error("\nBackup failed:", err);
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});
