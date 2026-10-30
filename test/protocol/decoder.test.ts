import { describe, expect, it } from 'vitest';
import { decodeFrame } from '../../src/protocol/decoder.js';
import { encodeFrame } from '../../src/protocol/encoder.js';
import { xorChecksum } from '../../src/protocol/checksum.js';
import { type Frame, FrameType, MetricId } from '../../src/protocol/types.js';

/** Trame d'exemple du sujet : HEARTBEAT appareil 7, seq 1, uptime 1000 ms. */
const SPEC_HEARTBEAT = Buffer.from('50 48 01 02 00 07 00 00 00 01 00 00 03 E8 00 F6'.replaceAll(' ', ''), 'hex');

const telemetry: Frame = {
  type: FrameType.Telemetry,
  deviceId: 42,
  seq: 123456,
  uptimeMs: 98765,
  measurements: [
    { metricId: MetricId.Temperature, value: 4250 },
    { metricId: MetricId.Voltage, value: 12000 },
    { metricId: MetricId.Current, value: -1500 },
  ],
};

/** Recalcule le checksum après une modification volontaire, pour isoler le contrôle testé. */
function withValidChecksum(bytes: Buffer): Buffer {
  bytes[bytes.length - 1] = xorChecksum(bytes, bytes.length - 1);
  return bytes;
}

describe('decodeFrame', () => {
  it("décode la trame d'exemple du sujet", () => {
    expect(SPEC_HEARTBEAT).toHaveLength(16);
    expect(decodeFrame(SPEC_HEARTBEAT)).toEqual({
      ok: true,
      frame: { type: FrameType.Heartbeat, deviceId: 7, seq: 1, uptimeMs: 1000, measurements: [] },
    });
  });

  it('décode une télémétrie avec valeurs signées (aller-retour encodeur)', () => {
    expect(decodeFrame(encodeFrame(telemetry))).toEqual({ ok: true, frame: telemetry });
  });

  it('lit seq et uptime sur 32 bits non signés', () => {
    const frame: Frame = { ...telemetry, seq: 0xffffffff, uptimeMs: 0xfffffffe, measurements: [] };
    expect(decodeFrame(encodeFrame(frame))).toEqual({ ok: true, frame });
  });

  it('rejette une trame trop courte', () => {
    expect(decodeFrame(SPEC_HEARTBEAT.subarray(0, 10))).toEqual({ ok: false, reason: 'TOO_SHORT' });
    expect(decodeFrame(new Uint8Array(0))).toEqual({ ok: false, reason: 'TOO_SHORT' });
  });

  it('rejette une trame de plus de 512 octets', () => {
    expect(decodeFrame(Buffer.alloc(513))).toEqual({ ok: false, reason: 'TOO_LONG' });
  });

  it('rejette un magic incorrect', () => {
    const bytes = Buffer.from(SPEC_HEARTBEAT);
    bytes[0] = 0x00;
    expect(decodeFrame(withValidChecksum(bytes))).toEqual({ ok: false, reason: 'BAD_MAGIC' });
  });

  it('rejette une version incorrecte', () => {
    const bytes = Buffer.from(SPEC_HEARTBEAT);
    bytes[2] = 2;
    expect(decodeFrame(withValidChecksum(bytes))).toEqual({ ok: false, reason: 'BAD_VERSION' });
  });

  it('rejette un type inconnu', () => {
    const bytes = Buffer.from(SPEC_HEARTBEAT);
    bytes[3] = 0x09;
    expect(decodeFrame(withValidChecksum(bytes))).toEqual({ ok: false, reason: 'UNKNOWN_TYPE' });
  });

  it('rejette une longueur incohérente avec count', () => {
    const bytes = Buffer.from(SPEC_HEARTBEAT);
    bytes[14] = 2; // annonce 2 mesures, mais aucune n'est présente
    expect(decodeFrame(withValidChecksum(bytes))).toEqual({ ok: false, reason: 'BAD_LENGTH' });
  });

  it('rejette un checksum faux', () => {
    const bytes = Buffer.from(SPEC_HEARTBEAT);
    bytes[15] = 0x00;
    expect(decodeFrame(bytes)).toEqual({ ok: false, reason: 'BAD_CHECKSUM' });
  });

  it('détecte un octet corrompu dans le corps via le checksum', () => {
    const bytes = encodeFrame(telemetry);
    bytes.writeUInt8(bytes.readUInt8(16) ^ 0x01, 16); // inverse un bit de la première valeur
    expect(decodeFrame(bytes)).toEqual({ ok: false, reason: 'BAD_CHECKSUM' });
  });

  it("rejette l'identifiant d'appareil 0", () => {
    const bytes = encodeFrame({ ...telemetry, deviceId: 0 });
    expect(decodeFrame(bytes)).toEqual({ ok: false, reason: 'BAD_DEVICE_ID' });
  });

  it('rejette un HEARTBEAT qui porte des mesures', () => {
    const bytes = encodeFrame({ ...telemetry, type: FrameType.Heartbeat });
    expect(decodeFrame(bytes)).toEqual({ ok: false, reason: 'HEARTBEAT_WITH_MEASUREMENTS' });
  });

  it('rejette un metricId inconnu', () => {
    const bytes = encodeFrame(telemetry);
    bytes[15] = 0x09; // premier metricId
    expect(decodeFrame(withValidChecksum(bytes))).toEqual({ ok: false, reason: 'UNKNOWN_METRIC' });
  });

  it("ne lève jamais d'exception sur des octets aléatoires", () => {
    for (let i = 0; i < 1000; i++) {
      const random = Buffer.alloc(Math.floor(Math.random() * 600));
      for (let j = 0; j < random.length; j++) random[j] = Math.floor(Math.random() * 256);
      expect(() => decodeFrame(random)).not.toThrow();
    }
  });

  it('décode correctement une vue sur un buffer plus grand (byteOffset non nul)', () => {
    const big = Buffer.concat([Buffer.from([0xaa, 0xbb, 0xcc]), SPEC_HEARTBEAT]);
    const result = decodeFrame(big.subarray(3));
    expect(result.ok).toBe(true);
  });
});

describe('encodeFrame', () => {
  it("produit exactement la trame d'exemple du sujet", () => {
    const bytes = encodeFrame({ type: FrameType.Heartbeat, deviceId: 7, seq: 1, uptimeMs: 1000, measurements: [] });
    expect(bytes.toString('hex')).toBe(SPEC_HEARTBEAT.toString('hex'));
  });

  it('refuse plus de mesures que ne le permet la taille maximale', () => {
    const measurements = Array.from({ length: 166 }, () => ({ metricId: MetricId.Voltage, value: 0 }));
    expect(() => encodeFrame({ ...telemetry, measurements })).toThrow(RangeError);
  });
});
