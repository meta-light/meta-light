import mongoose from "mongoose";
import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { connect } from '../utils/database'

async function main() {
  const SOURCE_MONGODB_URI = '';
  const BACKUP_DIR = path.join(process.cwd(), "backups");
  if (!SOURCE_MONGODB_URI) {console.error("Missing SOURCE_MONGODB_URI."); process.exit(1);}
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const sourceConn = await connect("SOURCE", SOURCE_MONGODB_URI);
  const sourceDb = sourceConn.db!;
  const collections = await sourceDb.listCollections().toArray();
  const names = collections.map((c: any) => c.name).filter((name) => name !== "prices").sort();
  console.log(`Found ${names.length} collections in SOURCE (excluding 'prices').`);
  for (const collName of names) {
    console.log(`\n=== Backing up collection: ${collName} ===`);
    const srcColl = sourceDb.collection(collName);
    const documents = await srcColl.find({}).toArray();
    const filePath = path.join(BACKUP_DIR, `${collName}.json`);
    await fs.writeFile(filePath, JSON.stringify(documents, null, 2), "utf8");
    console.log(`Done: ${collName} (${documents.length} documents saved to ${filePath}).`);
  }
  console.log("\nBackup completed.");
  await sourceConn.close();
}

main().catch((err) => {console.error("\n❌ Backup failed:", err); process.exit(1);});