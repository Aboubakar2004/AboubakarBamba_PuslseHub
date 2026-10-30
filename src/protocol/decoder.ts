import { xorChecksum } from './checksum.js';
import {
  type DecodeErrorReason,
  type DecodeResult,
  FrameType,
  HEADER_SIZE,
  MAGIC_0,
  MAGIC_1,
  MAX_FRAME_SIZE,
  MEASUREMENT_SIZE,
  type Measurement,
  MetricId,
  PROTOCOL_VERSION,
  frameSize,
} from './types.js';

const fail = (reason: DecodeErrorReason): DecodeResult => ({ ok: false, reason });

const isKnownType = (type: number): type is FrameType =>
  type === FrameType.Telemetry || type === FrameType.Heartbeat;

const isKnownMetric = (id: number): id is MetricId =>
  id === MetricId.Temperature || id === MetricId.Voltage || id === MetricId.Current;

/**
 * Décode un datagramme PulseHub v1.
 * Fonction pure : ne lève jamais d'exception, toute anomalie est renvoyée comme `{ ok: false, reason }`.
 * Les contrôles vont du moins coûteux au plus coûteux, et chaque lecture est précédée d'un contrôle de taille.
 */
export function decodeFrame(bytes: Uint8Array): DecodeResult {
  if (bytes.length < frameSize(0)) return fail('TOO_SHORT');
  if (bytes.length > MAX_FRAME_SIZE) return fail('TOO_LONG');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (view.getUint8(0) !== MAGIC_0 || view.getUint8(1) !== MAGIC_1) return fail('BAD_MAGIC');
  if (view.getUint8(2) !== PROTOCOL_VERSION) return fail('BAD_VERSION');

  const type = view.getUint8(3);
  if (!isKnownType(type)) return fail('UNKNOWN_TYPE');

  const count = view.getUint8(14);
  if (bytes.length !== frameSize(count)) return fail('BAD_LENGTH');

  const checksumOffset = bytes.length - 1;
  if (xorChecksum(bytes, checksumOffset) !== view.getUint8(checksumOffset)) return fail('BAD_CHECKSUM');

  const deviceId = view.getUint16(4); // DataView lit en big-endian par défaut
  if (deviceId === 0) return fail('BAD_DEVICE_ID');

  if (type === FrameType.Heartbeat && count !== 0) return fail('HEARTBEAT_WITH_MEASUREMENTS');

  const measurements: Measurement[] = [];
  for (let i = 0; i < count; i++) {
    const offset = HEADER_SIZE + i * MEASUREMENT_SIZE;
    const metricId = view.getUint8(offset);
    if (!isKnownMetric(metricId)) return fail('UNKNOWN_METRIC');
    measurements.push({ metricId, value: view.getInt16(offset + 1) });
  }

  return {
    ok: true,
    frame: {
      type,
      deviceId,
      seq: view.getUint32(6),
      uptimeMs: view.getUint32(10),
      measurements,
    },
  };
}
