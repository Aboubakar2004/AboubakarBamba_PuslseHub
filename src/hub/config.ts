import { readInt, readString } from '../shared/env.js';

export interface HubConfig {
  /** Interface d'écoute UDP (0.0.0.0 = toutes les interfaces). */
  udpHost: string;
  udpPort: number;
  /** Nombre de seq récents mémorisés par appareil pour distinguer retards et doublons. */
  sequenceWindow: number;
}

export function loadHubConfig(env: NodeJS.ProcessEnv): HubConfig {
  return {
    udpHost: readString(env, 'HUB_BIND', '0.0.0.0'),
    udpPort: readInt(env, 'HUB_PORT', 9000, 1, 65535),
    sequenceWindow: readInt(env, 'HUB_SEQ_WINDOW', 64, 1, 100_000),
  };
}
