import { type Frame, MetricId } from '../protocol/types.js';
import {
  type DeviceReadings,
  type DeviceStatus,
  type Thresholds,
  evaluateStatus,
  findIssues,
  isCritical,
} from './deviceStatus.js';

export interface DeviceView extends DeviceReadings {
  deviceId: number;
  status: DeviceStatus;
  /** Temps écoulé depuis la dernière trame acceptée. */
  silentForMs: number;
  uptimeMs: number;
  /** Nombre de télémétries dont au moins une valeur dépassait un seuil critique. */
  outOfRangeCount: number;
  /** Explications lisibles du statut (vide si OK). */
  issues: string[];
}

export interface FleetSnapshot {
  devices: DeviceView[];
  countByStatus: Record<DeviceStatus, number>;
  outOfRangeCount: number;
}

interface DeviceRecord extends DeviceReadings {
  lastSeenMs: number;
  uptimeMs: number;
  outOfRangeCount: number;
}

/** Conversion des unités du protocole (centièmes de °C, mV, mA) vers les unités physiques. */
const TO_PHYSICAL: Record<MetricId, { key: keyof DeviceReadings; factor: number }> = {
  [MetricId.Temperature]: { key: 'temperatureC', factor: 1 / 100 },
  [MetricId.Voltage]: { key: 'voltageV', factor: 1 / 1000 },
  [MetricId.Current]: { key: 'currentA', factor: 1 / 1000 },
};

/**
 * État courant de la flotte, alimenté uniquement par les trames acceptées par le séquenceur.
 * Le temps est passé en paramètre (`nowMs`) : aucune horloge cachée, donc testable.
 */
export class FleetState {
  private readonly devices = new Map<number, DeviceRecord>();

  constructor(private readonly thresholds: Thresholds) {}

  update(frame: Frame, nowMs: number): void {
    const record = this.devices.get(frame.deviceId) ?? {
      temperatureC: null,
      voltageV: null,
      currentA: null,
      lastSeenMs: nowMs,
      uptimeMs: 0,
      outOfRangeCount: 0,
    };
    record.lastSeenMs = nowMs;
    record.uptimeMs = frame.uptimeMs;
    for (const { metricId, value } of frame.measurements) {
      const { key, factor } = TO_PHYSICAL[metricId];
      record[key] = value * factor;
    }
    // Un HEARTBEAT prouve que l'appareil est vivant mais ne change pas ses valeurs.
    if (frame.measurements.length > 0 && isCritical(record, this.thresholds)) {
      record.outOfRangeCount++;
    }
    this.devices.set(frame.deviceId, record);
  }

  snapshot(nowMs: number): FleetSnapshot {
    const countByStatus: Record<DeviceStatus, number> = { OK: 0, WARNING: 0, CRITICAL: 0, SILENT: 0 };
    let outOfRangeCount = 0;
    const devices = [...this.devices.entries()]
      .sort(([a], [b]) => a - b)
      .map(([deviceId, record]): DeviceView => {
        const silentForMs = nowMs - record.lastSeenMs;
        const status = evaluateStatus(record, silentForMs, this.thresholds);
        countByStatus[status]++;
        outOfRangeCount += record.outOfRangeCount;
        return {
          deviceId,
          status,
          silentForMs,
          uptimeMs: record.uptimeMs,
          temperatureC: record.temperatureC,
          voltageV: record.voltageV,
          currentA: record.currentA,
          outOfRangeCount: record.outOfRangeCount,
          issues:
            status === 'SILENT'
              ? [`Aucune trame depuis ${Math.floor(silentForMs / 1000)} s`]
              : findIssues(record, this.thresholds).map((issue) => issue.message),
        };
      });
    return { devices, countByStatus, outOfRangeCount };
  }
}
