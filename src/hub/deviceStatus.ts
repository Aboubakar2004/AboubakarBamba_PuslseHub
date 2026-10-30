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

/** Problème détecté sur une mesure, avec un message lisible par la régie. */
export interface Issue {
  severity: 'CRITICAL' | 'WARNING';
  message: string;
}

/** Format français pour les messages destinés à la régie (virgule décimale). */
const fr = (value: number, digits: number) => value.toFixed(digits).replace('.', ',');

/** Liste les seuils dépassés par les dernières valeurs : source unique des règles de statut. */
export function findIssues(readings: DeviceReadings, t: Thresholds): Issue[] {
  const { temperatureC, voltageV, currentA } = readings;
  const issues: Issue[] = [];
  if (temperatureC !== null && temperatureC > t.temperatureCriticalC) {
    issues.push({ severity: 'CRITICAL', message: `Température ${fr(temperatureC, 1)} °C > ${t.temperatureCriticalC} °C` });
  } else if (temperatureC !== null && temperatureC > t.temperatureWarningC) {
    issues.push({ severity: 'WARNING', message: `Température ${fr(temperatureC, 1)} °C > ${t.temperatureWarningC} °C` });
  }
  if (voltageV !== null && (voltageV < t.voltageMinV || voltageV > t.voltageMaxV)) {
    issues.push({ severity: 'CRITICAL', message: `Tension ${fr(voltageV, 2)} V hors ${t.voltageMinV}–${t.voltageMaxV} V` });
  }
  if (currentA !== null && currentA > t.currentMaxA) {
    issues.push({ severity: 'CRITICAL', message: `Courant ${fr(currentA, 2)} A > ${t.currentMaxA} A` });
  }
  return issues;
}

/** Une mesure dépasse-t-elle un seuil critique ? Sert à compter les valeurs hors limites. */
export function isCritical(readings: DeviceReadings, t: Thresholds): boolean {
  return findIssues(readings, t).some((issue) => issue.severity === 'CRITICAL');
}

/**
 * Règle de statut, fonction pure : mêmes entrées, même verdict.
 * Ordre de priorité : un appareil muet l'est quelles que soient ses dernières valeurs (périmées).
 */
export function evaluateStatus(readings: DeviceReadings, silentForMs: number, t: Thresholds): DeviceStatus {
  if (silentForMs > t.silentAfterMs) return 'SILENT';
  const issues = findIssues(readings, t);
  if (issues.some((issue) => issue.severity === 'CRITICAL')) return 'CRITICAL';
  return issues.length > 0 ? 'WARNING' : 'OK';
}
