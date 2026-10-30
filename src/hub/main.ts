import { decodeFrame } from '../protocol/decoder.js';
import { loadDotEnv } from '../shared/env.js';
import { loadHubConfig } from './config.js';
import { DashboardServer } from './dashboard/dashboardServer.js';
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

  const dashboard = new DashboardServer(currentSummary, config.dashboardRefreshMs);
  await receiver.listen(config.udpPort, config.udpHost);
  await dashboard.listen(config.httpPort);
  console.log(`Hub PulseHub en écoute UDP sur ${config.udpHost}:${config.udpPort}`);
  console.log(`Tableau de bord : http://localhost:${config.httpPort}  (Ctrl+C pour arrêter)`);

  process.on('SIGINT', () => {
    dashboard.close();
    receiver.close();
    console.log('\nArrêt du hub.');
    process.exit(0);
  });
}

main().catch((error: Error) => {
  console.error(`Impossible de démarrer le hub : ${error.message}`);
  process.exit(1);
});
