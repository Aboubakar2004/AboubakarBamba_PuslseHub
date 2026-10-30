/** XOR de tous les octets de `bytes` dans l'intervalle [0, end[. */
export function xorChecksum(bytes: Uint8Array, end: number = bytes.length): number {
  let checksum = 0;
  for (let i = 0; i < end; i++) {
    checksum ^= bytes[i]!;
  }
  return checksum;
}
