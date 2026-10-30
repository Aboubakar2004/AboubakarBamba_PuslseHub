import { parseArgs } from 'node:util';
import { parseNumber, readString } from '../shared/env.js';

export interface SimulatorConfig {
  host: string;
  port: number;
  devices: number;
  hz: number;
  heartbeatEvery: number;
  badChecksumRate: number;
  duplicateRate: number;
  reorderRate: number;
  abnormalRate: number;
  overheatCount: number;
  stopCount: number;
  stopAfterSec: number;
}

export const HELP = `Usage : npm run sim -- [options]

  --host <ip>             Adresse du hub            (env HUB_HOST, défaut 127.0.0.1)
  --port <n>              Port UDP du hub           (env HUB_PORT, défaut 9000)
  --devices <n>           Nombre d'appareils        (env SIM_DEVICES, défaut 50)
  --hz <n>                Trames/s par appareil     (env SIM_HZ, défaut 20)
  --heartbeat-every <n>   1 trame sur n est un HEARTBEAT (env SIM_HEARTBEAT_EVERY, défaut 20)

Défauts injectables (taux entre 0 et 1) :
  --bad-checksum <taux>   Checksum faux
  --duplicate <taux>      Trames dupliquées
  --reorder <taux>        Trames désordonnées
  --abnormal <taux>       Valeurs aberrantes
  --overheat <n>          n appareils qui chauffent progressivement
  --stop <n>              n appareils qui s'arrêtent...
  --stop-after <s>        ...après s secondes (défaut 10)

Exemple : npm run sim -- --bad-checksum 0.02 --duplicate 0.01 --stop 2
`;

/** Ordre de priorité : option CLI > variable d'environnement > valeur par défaut. */
export function parseSimulatorConfig(argv: string[], env: NodeJS.ProcessEnv): SimulatorConfig | 'help' {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      host: { type: 'string' },
      port: { type: 'string' },
      devices: { type: 'string' },
      hz: { type: 'string' },
      'heartbeat-every': { type: 'string' },
      'bad-checksum': { type: 'string' },
      duplicate: { type: 'string' },
      reorder: { type: 'string' },
      abnormal: { type: 'string' },
      overheat: { type: 'string' },
      stop: { type: 'string' },
      'stop-after': { type: 'string' },
    },
  });
  if (values.help) return 'help';

  const int = (name: string, cli: string | undefined, envName: string | null, def: number, min: number, max: number) => {
    const raw = cli ?? (envName ? env[envName] : undefined);
    return raw === undefined ? def : parseNumber(name, raw, { min, max, integer: true });
  };
  const rate = (name: string, cli: string | undefined) =>
    cli === undefined ? 0 : parseNumber(name, cli, { min: 0, max: 1 });

  const devices = int('--devices', values.devices, 'SIM_DEVICES', 50, 1, 65535);
  return {
    host: values.host ?? readString(env, 'HUB_HOST', '127.0.0.1'),
    port: int('--port', values.port, 'HUB_PORT', 9000, 1, 65535),
    devices,
    hz: int('--hz', values.hz, 'SIM_HZ', 20, 1, 1000),
    heartbeatEvery: int('--heartbeat-every', values['heartbeat-every'], 'SIM_HEARTBEAT_EVERY', 20, 1, 1_000_000),
    badChecksumRate: rate('--bad-checksum', values['bad-checksum']),
    duplicateRate: rate('--duplicate', values.duplicate),
    reorderRate: rate('--reorder', values.reorder),
    abnormalRate: rate('--abnormal', values.abnormal),
    overheatCount: int('--overheat', values.overheat, null, 0, 0, devices),
    stopCount: int('--stop', values.stop, null, 0, 0, devices),
    stopAfterSec: int('--stop-after', values['stop-after'], null, 10, 0, 86_400),
  };
}
