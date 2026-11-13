// Node-only file helpers. Import from `@meta-light/utils/node`, never from a
// browser bundle.
import { mkdirSync, writeFileSync } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function hasFile(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function write_file_safe(
  path: string,
  content: string,
  encoding: BufferEncoding = "utf-8",
): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, { encoding });
}
