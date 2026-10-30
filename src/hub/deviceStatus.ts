/** Statut d'un appareil, du plus grave au moins grave. */
export type DeviceStatus = 'SILENT' | 'CRITICAL' | 'WARNING' | 'OK';

/** Seuils d'interprétation, en unités physiques (°C, V, A, ms). Tous configurables. */
export interface Thresholds {
  temperatureWarningC: number;
  temperatureCriticalC: number;
  voltageMinV: number;
  voltageMaxV: number;
  currentMaxA: number;
  /** Au-delà de ce délai sans aucune trame (télémétrie ou heartbeat), l'appareil est muet. */
  silentAfterMs: number;
}

/** Dernières valeurs connues d'un appareil (null tant qu'aucune télémétrie n'a été reçue). */
export interface DeviceReadings {
  temperatureC: number | null;
  voltageV: number | null;
  currentA: number | null;
}

/** Une mesure dépasse-t-elle un seuil critique ? Sert aussi à compter les valeurs hors limites. */
export function isCritical(readings: DeviceReadings, t: Thresholds): boolean {
  const { temperatureC, voltageV, currentA } = readings;
  return (
    (temperatureC !== null && temperatureC > t.temperatureCriticalC) ||
    (voltageV !== null && (voltageV < t.voltageMinV || voltageV > t.voltageMaxV)) ||
    (currentA !== null && currentA > t.currentMaxA)
  );
}

/**
 * Règle de statut, fonction pure : mêmes entrées, même verdict.
 * Ordre de priorité : un appareil muet l'est quelles que soient ses dernières valeurs.
 */
export function evaluateStatus(readings: DeviceReadings, silentForMs: number, t: Thresholds): DeviceStatus {
  if (silentForMs > t.silentAfterMs) return 'SILENT';
  if (isCritical(readings, t)) return 'CRITICAL';
  if (readings.temperatureC !== null && readings.temperatureC > t.temperatureWarningC) return 'WARNING';
  return 'OK';
}
