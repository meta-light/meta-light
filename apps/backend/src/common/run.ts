export function enabled(flag: string): boolean {
  return process.env[flag] === 'true';
}

export async function runSafe(label: string, method: () => Promise<unknown>) {
  try {
    await method();
  } catch (error) {
    console.error(label, error);
  }
}

export async function load<T>(base: string, specifier: string): Promise<T> {
  return (await import(new URL(specifier, base).href)) as T;
}
