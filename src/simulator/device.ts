import { type Frame, FrameType, type Measurement, MetricId } from '../protocol/types.js';

export type Random = () => number;

export interface DeviceOptions {
  /** Une trame sur N est un HEARTBEAT (les autres sont des TELEMETRY). */
  heartbeatEvery: number;
  /** Probabilité (0..1) qu'une télémétrie porte une valeur aberrante. */
  abnormalRate: number;
  /** Appareil qui chauffe progressivement (pour tester les alertes de température). */
  overheats: boolean;
  /** Instant (ms, horloge du simulateur) où l'appareil cesse d'émettre ; undefined = jamais. */
  stopAtMs?: number;
  random: Random;
}

/** Valeurs physiques plausibles, dans les unités du protocole (centièmes de °C, mV, mA). */
const NOMINAL = { temperature: 3500, voltage: 24000, current: 2000 };
const ABNORMAL = { temperature: 12000, voltage: 32000, current: 30000 };
const INT16_MAX = 32767;
/** Hausse de température par trame d'un appareil en surchauffe (3 = +0,03 °C, soit +0,6 °C/s à 20 Hz). */
const OVERHEAT_STEP = 3;

/** Marche aléatoire bornée : la valeur dérive doucement autour de sa valeur nominale. */
function drift(value: number, nominal: number, step: number, random: Random): number {
  const next = value + (random() - 0.5) * 2 * step + (nominal - value) * 0.01;
  return Math.round(Math.min(INT16_MAX, Math.max(0, next)));
}

/**
 * Appareil virtuel : produit sa prochaine trame à chaque appel de `nextFrame`.
 * Ne connaît ni le réseau ni l'encodage binaire : il ne fabrique que des objets `Frame`.
 */
export class VirtualDevice {
  private seq = 0;
  private temperature: number;
  private voltage: number;
  private current: number;
  abnormalCount = 0;

  constructor(
    readonly id: number,
    private readonly startedAtMs: number,
    private readonly options: DeviceOptions,
  ) {
    const jitter = () => (options.random() - 0.5) * 0.1; // ±5 % entre appareils
    this.temperature = Math.round(NOMINAL.temperature * (1 + jitter()));
    this.voltage = Math.round(NOMINAL.voltage * (1 + jitter()));
    this.current = Math.round(NOMINAL.current * (1 + jitter()));
  }

  isStopped(nowMs: number): boolean {
    return this.options.stopAtMs !== undefined && nowMs >= this.options.stopAtMs;
  }

  /** Retourne la prochaine trame, ou null si l'appareil est arrêté. */
  nextFrame(nowMs: number): Frame | null {
    if (this.isStopped(nowMs)) return null;

    this.seq = (this.seq + 1) >>> 0; // uint32 : repasse à 0 après 4 294 967 295
    const header = {
      deviceId: this.id,
      seq: this.seq,
      uptimeMs: (nowMs - this.startedAtMs) >>> 0,
    };

    if (this.seq % this.options.heartbeatEvery === 0) {
      return { ...header, type: FrameType.Heartbeat, measurements: [] };
    }
    return { ...header, type: FrameType.Telemetry, measurements: this.measure() };
  }

  private measure(): Measurement[] {
    const { random } = this.options;
    this.temperature = this.options.overheats
      ? Math.min(INT16_MAX, this.temperature + OVERHEAT_STEP)
      : drift(this.temperature, NOMINAL.temperature, 5, random);
    this.voltage = drift(this.voltage, NOMINAL.voltage, 20, random);
    this.current = drift(this.current, NOMINAL.current, 15, random);

    const measurements: Measurement[] = [
      { metricId: MetricId.Temperature, value: this.temperature },
      { metricId: MetricId.Voltage, value: this.voltage },
      { metricId: MetricId.Current, value: this.current },
    ];

    if (random() < this.options.abnormalRate) {
      const index = Math.floor(random() * measurements.length);
      const target = measurements[index]!;
      target.value = abnormalValue(target.metricId);
      this.abnormalCount++;
    }
    return measurements;
  }
}

function abnormalValue(metricId: MetricId): number {
  switch (metricId) {
    case MetricId.Temperature:
      return ABNORMAL.temperature;
    case MetricId.Voltage:
      return ABNORMAL.voltage;
    case MetricId.Current:
      return ABNORMAL.current;
  }
}
