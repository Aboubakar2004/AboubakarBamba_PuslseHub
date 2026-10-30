import { readInt, readString } from '../shared/env.js';

export interface HubConfig {
  /** Interface d'écoute UDP (0.0.0.0 = toutes les interfaces). */
  udpHost: string;
  udpPort: number;
}

export function loadHubConfig(env: NodeJS.ProcessEnv): HubConfig {
  return {
    udpHost: readString(env, 'HUB_BIND', '0.0.0.0'),
    udpPort: readInt(env, 'HUB_PORT', 9000, 1, 65535),
  };
}
