import { createSocket } from 'node:dgram';
import { encodeFrame } from '../protocol/encoder.js';
import { loadDotEnv } from '../shared/env.js';
import { HELP, type SimulatorConfig, parseSimulatorConfig } from './config.js';
import { VirtualDevice } from './device.js';
import { CorruptChecksumFault, DuplicateFault, type PacketFault, ReorderFault, applyFaults } from './faults.js';

/** Construit la flotte : les derniers appareils sont ceux qui s'arrêtent, les premiers ceux qui chauffent. */
function createFleet(config: SimulatorConfig, startMs: number): VirtualDevice[] {
  return Array.from({ length: config.devices }, (_, i) => {
    const id = i + 1;
    return new VirtualDevice(id, startMs, {
      heartbeatEvery: config.heartbeatEvery,
      abnormalRate: config.abnormalRate,
      overheats: id <= config.overheatCount,
      stopAtMs: id > config.devices - config.stopCount ? startMs + config.stopAfterSec * 1000 : undefined,
      random: Math.random,
    });
  });
}

function createFaults(config: SimulatorConfig): PacketFault[] {
  return [
    new ReorderFault(config.reorderRate, Math.random),
    new DuplicateFault(config.duplicateRate, Math.random),
    new CorruptChecksumFault(config.badChecksumRate, Math.random),
  ];
}

function main(): void {
  loadDotEnv();
  let config: SimulatorConfig | 'help';
  try {
    config = parseSimulatorConfig(process.argv.slice(2), process.env);
  } catch (error) {
    console.error((error as Error).message + '\n\n' + HELP);
    process.exit(1);
  }
  if (config === 'help') {
    console.log(HELP);
    return;
  }

  const startMs = Date.now();
  const fleet = createFleet(config, startMs);
  const faults = createFaults(config);
  const socket = createSocket('udp4');
  let sent = 0;
  let sendErrors = 0;
  let sentLastSecond = 0;

  socket.on('error', (error) => {
    sendErrors++;
    console.error(`\nErreur socket : ${error.message}`);
  });

  const emitRound = (now: number) => {
    for (const device of fleet) {
      const frame = device.nextFrame(now);
      if (!frame) continue;
      for (const packet of applyFaults(faults, encodeFrame(frame))) {
        socket.send(packet, config.port, config.host, (error) => {
          if (error) sendErrors++;
        });
        sent++;
      }
    }
  };

  // setInterval n'est pas précis (≈15 ms de granularité sous Windows) : on calcule le nombre de
  // tours dus depuis le démarrage et on rattrape le retard, pour tenir exactement F Hz en moyenne.
  let rounds = 0;
  const tick = setInterval(() => {
    const now = Date.now();
    const due = Math.floor(((now - startMs) * config.hz) / 1000);
    rounds = Math.max(rounds, due - config.hz); // pas de rafale de plus d'une seconde après une pause
    while (rounds < due) {
      emitRound(now);
      rounds++;
    }
  }, 1000 / config.hz);

  const status = setInterval(() => {
    const now = Date.now();
    const active = fleet.filter((d) => !d.isStopped(now)).length;
    const abnormal = fleet.reduce((sum, d) => sum + d.abnormalCount, 0);
    const injected = faults.map((f) => `${f.name} ${f.injected}`).join(' · ');
    const rate = sent - sentLastSecond;
    sentLastSecond = sent;
    const line = `${rate}/s · total ${sent} · actifs ${active}/${fleet.length} · ${injected} · aberrantes ${abnormal} · erreurs ${sendErrors}`;
    // Ligne tronquée à la largeur du terminal : sinon elle passe à la ligne et \r ne l'efface plus.
    const width = (process.stdout.columns ?? 120) - 1;
    process.stdout.write('\r' + line.slice(0, width).padEnd(width));
  }, 1000);

  console.log(
    `Simulateur PulseHub : ${config.devices} appareils à ${config.hz} Hz vers ${config.host}:${config.port} (Ctrl+C pour arrêter)`,
  );

  process.on('SIGINT', () => {
    clearInterval(tick);
    clearInterval(status);
    socket.close();
    console.log(`\nArrêt du simulateur : ${sent} trames envoyées.`);
    process.exit(0);
  });
}

main();
