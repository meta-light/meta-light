import mongoose from "mongoose";

export type Boolish = "true" | "false" | undefined;

export function parseBool(v: Boolish, defaultVal: boolean) {if (v === undefined) return defaultVal; return v.toLowerCase() === "true";}
export function parseList(v?: string): Set<string> | null {if (!v) return null; const items = v.split(",").map((s) => s.trim()).filter(Boolean); return new Set(items);}

export async function connect(name: string, uri: string) {
  const conn = await mongoose.createConnection(uri, {serverSelectionTimeoutMS: 30_000, socketTimeoutMS: 0}).asPromise();
  if (!conn.db) {throw new Error(`[${name}] Connection established but database handle is missing.`);}
  const admin = conn.db.admin();
  const info = await admin.serverStatus().catch(() => null);
  const version = info?.version ? ` (MongoDB ${info.version})` : "";
  console.log(`[${name}] connected${version}`);
  return conn;
}