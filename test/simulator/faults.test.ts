import { describe, expect, it } from 'vitest';
import { decodeFrame } from '../../src/protocol/decoder.js';
import { encodeFrame } from '../../src/protocol/encoder.js';
import { FrameType } from '../../src/protocol/types.js';
import { CorruptChecksumFault, DuplicateFault, ReorderFault, applyFaults } from '../../src/simulator/faults.js';

const packet = (deviceId: number, seq: number) =>
  encodeFrame({ type: FrameType.Heartbeat, deviceId, seq, uptimeMs: 0, measurements: [] });
const seqOf = (p: Buffer) => p.readUInt32BE(6);
const always = () => 0;
const never = () => 0.99;

describe('défauts du simulateur', () => {
  it('CorruptChecksumFault rend la trame invalide pour le décodeur', () => {
    const [corrupted] = new CorruptChecksumFault(1, always).apply(packet(1, 1));
    expect(decodeFrame(corrupted!)).toEqual({ ok: false, reason: 'BAD_CHECKSUM' });
  });

  it('CorruptChecksumFault ne touche à rien quand le tirage ne tombe pas', () => {
    const original = packet(1, 1);
    expect(new CorruptChecksumFault(0.5, never).apply(original)).toEqual([original]);
  });

  it('DuplicateFault émet deux fois le même paquet', () => {
    const fault = new DuplicateFault(1, always);
    expect(fault.apply(packet(1, 1))).toHaveLength(2);
    expect(fault.injected).toBe(1);
  });

  it('ReorderFault inverse deux trames consécutives du même appareil', () => {
    const draws = [0, 0.99]; // retient la 1re trame, laisse passer la 2e
    const fault = new ReorderFault(0.5, () => draws.shift() ?? 0.99);
    expect(fault.apply(packet(1, 1))).toEqual([]);
    expect(fault.apply(packet(2, 1)).map(seqOf)).toEqual([1]); // autre appareil : non affecté
    expect(fault.apply(packet(1, 2)).map(seqOf)).toEqual([2, 1]);
  });

  it('applyFaults enchaîne les défauts', () => {
    const out = applyFaults([new DuplicateFault(1, always), new CorruptChecksumFault(1, always)], packet(1, 1));
    expect(out).toHaveLength(2);
    expect(out.every((p) => !decodeFrame(p).ok)).toBe(true);
  });
});
