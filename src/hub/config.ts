import { readInt, readNumber, readString } from '../shared/env.js';
import type { Thresholds } from './deviceStatus.js';

export interface HubConfig {
  /** Interface d'écoute UDP (0.0.0.0 = toutes les interfaces). */
  udpHost: string;
  udpPort: number;
  /** Nombre de seq récents mémorisés par appareil pour distinguer retards et doublons. */
  sequenceWindow: number;
  thresholds: Thresholds;
  /** Port HTTP du tableau de bord. */
  httpPort: number;
  /** Intervalle d'envoi de la synthèse au navigateur. */
  dashboardRefreshMs: number;
}

export function loadHubConfig(env: NodeJS.ProcessEnv): HubConfig {
  const thresholds: Thresholds = {
    temperatureWarningC: readNumber(env, 'HUB_TEMP_WARNING_C', 60),
    temperatureCriticalC: readNumber(env, 'HUB_TEMP_CRITICAL_C', 75),
    voltageMinV: readNumber(env, 'HUB_VOLTAGE_MIN_V', 22),
    voltageMaxV: readNumber(env, 'HUB_VOLTAGE_MAX_V', 26),
    currentMaxA: readNumber(env, 'HUB_CURRENT_MAX_A', 10),
    silentAfterMs: readInt(env, 'HUB_SILENT_AFTER_MS', 3000, 1),
  };
  if (thresholds.temperatureWarningC >= thresholds.temperatureCriticalC) {
    throw new Error('HUB_TEMP_WARNING_C doit être inférieur à HUB_TEMP_CRITICAL_C');
  }
  if (thresholds.voltageMinV >= thresholds.voltageMaxV) {
    throw new Error('HUB_VOLTAGE_MIN_V doit être inférieur à HUB_VOLTAGE_MAX_V');
  }
  return {
    udpHost: readString(env, 'HUB_BIND', '0.0.0.0'),
    udpPort: readInt(env, 'HUB_PORT', 9000, 1, 65535),
    sequenceWindow: readInt(env, 'HUB_SEQ_WINDOW', 64, 1, 100_000),
    thresholds,
    httpPort: readInt(env, 'HUB_HTTP_PORT', 3000, 1, 65535),
    dashboardRefreshMs: readInt(env, 'HUB_DASHBOARD_REFRESH_MS', 500, 50, 60_000),
  };
}
