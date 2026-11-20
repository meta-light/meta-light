import { createHash } from "node:crypto";

const IV = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

export function sha256Reduced(message: Uint8Array, rounds: number): string {
  if (rounds < 1 || rounds > 64) throw new Error(`rounds must be 1..64, got ${rounds}`);
  const padLen = (55 - message.length) % 64;
  const padded = new Uint8Array(message.length + 1 + ((padLen + 64) % 64) + 8);
  padded.set(message);
  padded[message.length] = 0x80;
  new DataView(padded.buffer).setBigUint64(padded.length - 8, BigInt(message.length) * 8n);
  const view = new DataView(padded.buffer);
  const state = [...IV];
  for (let offset = 0; offset < padded.length; offset += 64) {
    const w = new Array<number>(rounds);
    for (let i = 0; i < Math.min(16, rounds); i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < rounds; i++) {
      const x = w[i - 15]!;
      const y = w[i - 2]!;
      const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
      const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = state as [number, number, number, number, number, number, number, number];
    for (let i = 0; i < rounds; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i]! + w[i]!) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    [a, b, c, d, e, f, g, h].forEach((v, i) => (state[i] = (state[i]! + v) | 0));
  }

  return state.map((v) => (v >>> 0).toString(16).padStart(8, "0")).join("");
}

const M1 =
  "33ee28ac5f8ef994c787777c079d17e11198d1beb527c8554bfeff014ab531951cf31bd2bbfc637e122da4f948e6e447d5a6b8b6ea9e7af5aac1aeabeeaceb0dbd07668b833fe88e689ffe8da52259da14b9855eee5138ba88355f4806d5cf5d161c50014c6b7d7e0e7eb888747559fc990a7af69dd8e59f57d7f6a3c0fbd03b";
const M2 =
  "33ee28ac5f8ef994c787777c079d17e11198d1beb527c8554bfeff014ab531951cf31bd2bbfc637e122da4f948e6e447d5a6b8b6ea9e7af5aac1aeabeeaceb0dbd07668b833fe88e689ffe8da52259da14b9855eee5138ba88355f4838b3d19d161c4ffd4c6b7d7e0e813888747559fc990a7af69dd8e59f57d7f6a3c0fbd03f";

if (import.meta.main) {
  const m1 = Buffer.from(M1, "hex");
  const m2 = Buffer.from(M2, "hex");
  for (const m of [m1, m2, Buffer.alloc(0), Buffer.from("abc")]) {
    const ours = sha256Reduced(m, 64);
    const ref = createHash("sha256").update(m).digest("hex");
    if (ours !== ref) throw new Error(`64-round mismatch: ${ours} != ${ref}`);
  }
  console.log("64-round implementation matches node:crypto sha256 ✓\n");
  const diffBytes = [...m1].flatMap((byte, i) => (byte !== m2[i] ? [i] : []));
  console.log(`message length: ${m1.length} bytes (${Math.ceil((m1.length + 9) / 64)} blocks)`);
  console.log(`messages differ: ${!m1.equals(m2)} (${diffBytes.length} bytes at offsets ${diffBytes.join(", ")})\n`);
  const rounds = process.argv[2] ? [Number(process.argv[2])] : [36, 37, 38, 39, 64];
  for (const r of rounds) {
    const h1 = sha256Reduced(m1, r);
    const h2 = sha256Reduced(m2, r);
    console.log(`${String(r).padStart(2)} rounds: ${h1 === h2 ? "COLLIDE" : "differ "}  ${h1}  ${h2}`);
  }
}
