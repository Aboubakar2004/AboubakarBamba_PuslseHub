import { xorChecksum } from './checksum.js';
import {
  type Frame,
  HEADER_SIZE,
  MAGIC_0,
  MAGIC_1,
  MAX_MEASUREMENTS,
  MEASUREMENT_SIZE,
  PROTOCOL_VERSION,
  frameSize,
} from './types.js';

/**
 * Encode une trame PulseHub v1 (utilisé par le simulateur et les tests).
 * Lève une erreur si la trame ne peut pas être représentée : c'est une erreur de programmation, pas de réseau.
 */
export function encodeFrame(frame: Frame): Buffer {
  const count = frame.measurements.length;
  if (count > MAX_MEASUREMENTS) {
    throw new RangeError(`Trop de mesures : ${count} (max ${MAX_MEASUREMENTS})`);
  }

  const buffer = Buffer.alloc(frameSize(count));
  buffer.writeUInt8(MAGIC_0, 0);
  buffer.writeUInt8(MAGIC_1, 1);
  buffer.writeUInt8(PROTOCOL_VERSION, 2);
  buffer.writeUInt8(frame.type, 3);
  buffer.writeUInt16BE(frame.deviceId, 4);
  buffer.writeUInt32BE(frame.seq, 6);
  buffer.writeUInt32BE(frame.uptimeMs, 10);
  buffer.writeUInt8(count, 14);

  frame.measurements.forEach((m, i) => {
    const offset = HEADER_SIZE + i * MEASUREMENT_SIZE;
    buffer.writeUInt8(m.metricId, offset);
    buffer.writeInt16BE(m.value, offset + 1);
  });

  const checksumOffset = buffer.length - 1;
  buffer.writeUInt8(xorChecksum(buffer, checksumOffset), checksumOffset);
  return buffer;
}
