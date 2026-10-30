import { decodeFrame } from '../protocol/decoder.js';
import { loadDotEnv } from '../shared/env.js';
import { loadHubConfig } from './config.js';
import { ReceptionStats } from './receptionStats.js';
import { Sequencer } from './sequencer.js';
import { UdpReceiver } from './udpReceiver.js';

async function main(): Promise<void> {
  loadDotEnv();
  const config = loadHubConfig(process.env);
  const stats = new ReceptionStats();
  const sequencer = new Sequencer(config.sequenceWindow);

  // Parcours d'une trame : socket -> décodeur -> séquenceur (la synthèse viendra s'insérer ici).
  const receiver = new UdpReceiver((datagram) => {
    const result = decodeFrame(datagram);
    stats.record(result);
    if (!result.ok) return;
    sequencer.process(result.frame.deviceId, result.frame.seq);
  });
  await receiver.listen(config.udpPort, config.udpHost);
  console.log(`Hub PulseHub en écoute UDP sur ${config.udpHost}:${config.udpPort} (Ctrl+C pour arrêter)`);

  // Affichage provisoire, remplacé par le tableau de bord web à l'étape visualisation.
  const status = setInterval(() => {
    const s = stats.snapshot();
    const reasons = Object.entries(s.invalidByReason).map(([r, n]) => `${r} ${n}`).join(' · ') || '-';
    const q = sequencer.totals();
    const line =
      `reçues ${s.received} · invalides ${s.invalid} (${reasons}) · ` +
      `acceptées ${q.accepted} · doublons ${q.duplicates} · retards ${q.late} · pertes ${q.lost}`;
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
