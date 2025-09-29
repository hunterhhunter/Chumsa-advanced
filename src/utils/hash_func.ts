import { x86, x64 } from "murmurhash3js-revisited"

export function hashString(input: string, seed: number=42): number {
    const bytes = new TextEncoder().encode(input);
    const n = x86.hash32(bytes, seed);
    return n >>> 0;
}