import { decodeFrame } from '../protocol/decoder.js';
import { loadDotEnv } from '../shared/env.js';
import { loadHubConfig } from './config.js';
import { FleetState } from './fleetState.js';
import { RateMeter } from './rateMeter.js';
import { ReceptionStats } from './receptionStats.js';
import { Sequencer } from './sequencer.js';
import { type HubSummary, buildSummary } from './summary.js';
import { UdpReceiver } from './udpReceiver.js';

async function main(): Promise<void> {
  loadDotEnv();
  const config = loadHubConfig(process.env);
  const startedAtMs = Date.now();
  const stats = new ReceptionStats();
  const rate = new RateMeter();
  const sequencer = new Sequencer(config.sequenceWindow);
  const fleet = new FleetState(config.thresholds);

  // Parcours d'une trame : socket -> décodeur -> séquenceur -> état de la flotte.
  const receiver = new UdpReceiver((datagram) => {
    const now = Date.now();
    rate.record(now);
    const result = decodeFrame(datagram);
    stats.record(result);
    if (!result.ok) return;
    if (sequencer.process(result.frame.deviceId, result.frame.seq) === 'accepted') {
      fleet.update(result.frame, now);
    }
  });
  await receiver.listen(config.udpPort, config.udpHost);
  console.log(`Hub PulseHub en écoute UDP sur ${config.udpHost}:${config.udpPort} (Ctrl+C pour arrêter)`);

  const currentSummary = (): HubSummary => {
    const now = Date.now();
    return buildSummary({
      nowMs: now,
      startedAtMs,
      reception: stats.snapshot(),
      sequence: sequencer.totals(),
      framesPerSecond: rate.rate(now),
      fleet: fleet.snapshot(now),
      lostOf: (deviceId) => sequencer.countersOf(deviceId).lost,
    });
  };

  // Affichage provisoire, remplacé par le tableau de bord web à l'étape visualisation.
  const status = setInterval(() => {
    const { reception: r, fleet: f } = currentSummary();
    const c = f.countByStatus;
    const line =
      `${r.framesPerSecond}/s · reçues ${r.received} · invalides ${r.invalid} · pertes ${r.lossRatePercent} % · ` +
      `appareils ${f.deviceCount} : OK ${c.OK} · chauds ${c.WARNING} · critiques ${c.CRITICAL} · muets ${c.SILENT} · ` +
      `hors limites ${f.outOfRangeCount}`;
    const width = (process.stdout.columns ?? 120) - 1;
    process.stdout.write('\r' + line.slice(0, width).padEnd(width));
  }, 500);

  process.on('SIGINT', () => {
    clearInterval(status);
    receiver.close();
    console.log('\nArrêt du hub.');
    process.exit(0);
  });
}

main().catch((error: Error) => {
  console.error(`Impossible de démarrer le hub : ${error.message}`);
  process.exit(1);
});
