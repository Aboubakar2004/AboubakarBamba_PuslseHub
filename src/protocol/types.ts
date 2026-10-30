/** Constantes et types du protocole PulseHub v1 (valeurs multi-octets en big-endian). */

export const MAGIC_0 = 0x50; // 'P'
export const MAGIC_1 = 0x48; // 'H'
export const PROTOCOL_VERSION = 1;

/** Taille de l'en-tête fixe : magic(2) + version(1) + type(1) + deviceId(2) + seq(4) + uptimeMs(4) + count(1). */
export const HEADER_SIZE = 15;
export const MEASUREMENT_SIZE = 3; // metricId(1) + value(2)
export const CHECKSUM_SIZE = 1;
export const MAX_FRAME_SIZE = 512;
/** Nombre maximal de mesures pour rester sous MAX_FRAME_SIZE. */
export const MAX_MEASUREMENTS = Math.floor((MAX_FRAME_SIZE - HEADER_SIZE - CHECKSUM_SIZE) / MEASUREMENT_SIZE);

export enum FrameType {
  Telemetry = 0x01,
  Heartbeat = 0x02,
}

export enum MetricId {
  /** Centièmes de °C (4250 = 42,50 °C). */
  Temperature = 1,
  /** Millivolts. */
  Voltage = 2,
  /** Milliampères. */
  Current = 3,
}

export interface Measurement {
  metricId: MetricId;
  /** Valeur brute int16, dans l'unité du protocole. */
  value: number;
}

export interface Frame {
  type: FrameType;
  deviceId: number;
  seq: number;
  uptimeMs: number;
  measurements: Measurement[];
}

/** Raisons de rejet d'une trame : chacune est comptée séparément par le hub. */
export type DecodeErrorReason =
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'BAD_MAGIC'
  | 'BAD_VERSION'
  | 'UNKNOWN_TYPE'
  | 'BAD_LENGTH'
  | 'BAD_CHECKSUM'
  | 'BAD_DEVICE_ID'
  | 'HEARTBEAT_WITH_MEASUREMENTS'
  | 'UNKNOWN_METRIC';

/** Résultat du décodage : jamais d'exception, une trame invalide est une valeur comme une autre. */
export type DecodeResult = { ok: true; frame: Frame } | { ok: false; reason: DecodeErrorReason };

export function frameSize(measurementCount: number): number {
  return HEADER_SIZE + MEASUREMENT_SIZE * measurementCount + CHECKSUM_SIZE;
}
