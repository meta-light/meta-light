import "dotenv/config";
import { parseBool, parseList, connect, Boolish } from '../utils/database'

function shouldIncludeCollection(collName: string, include: Set<string> | null, exclude: Set<string> | null) {
  if (exclude && exclude.has(collName)) return false;
  if (include) return include.has(collName);
  return true;
}

async function copyIndexes(sourceDb: any, destDb: any, collName: string) {
  const srcColl = sourceDb.collection(collName);
  const dstColl = destDb.collection(collName);
  const indexes = await srcColl.indexes();
  const toCreate = indexes.filter((ix: any) => ix.name !== "_id_").map((ix: any) => {const { key, name, ...rest } = ix; return { key, options: { name, ...rest } };});
  if (toCreate.length === 0) return;
  for (const ix of toCreate) {await dstColl.createIndex(ix.key, ix.options);}
}

async function main() {
  const SOURCE_MONGODB_URI = '';
  const DEST_MONGODB_URI = ''
  if (!SOURCE_MONGODB_URI || !DEST_MONGODB_URI) {
    console.error("Missing SOURCE_MONGODB_URI or DEST_MONGODB_URI environment variables.");
    process.exit(1);
  }
  const DROP_DEST = parseBool(process.env.DROP_DEST as Boolish, false);
  const COPY_INDEXES = parseBool(process.env.COPY_INDEXES as Boolish, true);
  const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? "1000");
  if (!Number.isFinite(BATCH_SIZE) || BATCH_SIZE < 1) {
    console.error("BATCH_SIZE must be a positive number.");
    process.exit(1);
  }
  const include = parseList(process.env.INCLUDE_COLLECTIONS);
  const exclude = parseList(process.env.EXCLUDE_COLLECTIONS);
  const sourceConn = await connect("SOURCE", SOURCE_MONGODB_URI);
  const destConn = await connect("DEST", DEST_MONGODB_URI);
  const sourceDb = sourceConn.db!;
  const destDb = destConn.db!;
  const collections = await sourceDb.listCollections().toArray();
  const names = collections.map((c: any) => c.name).sort();
  console.log(`Found ${names.length} collections in SOURCE.`);
  const selected = names.filter((n) => shouldIncludeCollection(n, include, exclude));
  console.log(`Will migrate ${selected.length} collections.`);
  for (const collName of selected) {
    console.log(`\n=== Migrating collection: ${collName} ===`);
    const srcColl = sourceDb.collection(collName);
    const dstColl = destDb.collection(collName);
    if (DROP_DEST) {
      const exists = await destDb.listCollections({ name: collName }).hasNext();
      if (exists) {
        console.log(`Dropping DEST.${collName} ...`);
        await dstColl.drop().catch((err: any) => {if (err?.codeName !== "NamespaceNotFound") throw err;});
      }
    }
    const destExists = await destDb.listCollections({ name: collName }).hasNext();
    if (!destExists) {await destDb.createCollection(collName);}
    if (COPY_INDEXES) {console.log(`Copying indexes for ${collName} ...`); await copyIndexes(sourceDb, destDb, collName);}
    const cursor = srcColl.find({}, { noCursorTimeout: true });
    let ops: any[] = [];
    let total = 0;
    try {
      for await (const doc of cursor) {
        ops.push({replaceOne: {filter: { _id: doc._id }, replacement: doc, upsert: true}});
        if (ops.length >= BATCH_SIZE) {
          const res = await dstColl.bulkWrite(ops, { ordered: false });
          total += res.upsertedCount + res.modifiedCount + res.insertedCount;
          ops = [];
          process.stdout.write(`\rCopied ~${total} docs...`);
        }
      }
      if (ops.length > 0) {
        const res = await dstColl.bulkWrite(ops, { ordered: false });
        total += res.upsertedCount + res.modifiedCount + res.insertedCount;
        ops = [];
      }
    } 
    finally {await cursor.close().catch(() => undefined);}
    console.log(`\nDone: ${collName} (processed ${total} docs ops).`);
  }
  console.log("\n Migration completed.");
  await sourceConn.close();
  await destConn.close();
}

main().catch((err) => {console.error("\n Migration failed:", err); process.exit(1);});