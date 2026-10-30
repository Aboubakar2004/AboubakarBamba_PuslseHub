import { decodeFrame } from '../protocol/decoder.js';
import { loadDotEnv } from '../shared/env.js';
import { loadHubConfig } from './config.js';
import { ReceptionStats } from './receptionStats.js';
import { UdpReceiver } from './udpReceiver.js';

async function main(): Promise<void> {
  loadDotEnv();
  const config = loadHubConfig(process.env);
  const stats = new ReceptionStats();

  // Parcours d'une trame : socket -> décodeur -> compteurs (le séquenceur viendra s'insérer ici).
  const receiver = new UdpReceiver((datagram) => stats.record(decodeFrame(datagram)));
  await receiver.listen(config.udpPort, config.udpHost);
  console.log(`Hub PulseHub en écoute UDP sur ${config.udpHost}:${config.udpPort} (Ctrl+C pour arrêter)`);

  // Affichage provisoire, remplacé par le tableau de bord web à l'étape visualisation.
  const status = setInterval(() => {
    const s = stats.snapshot();
    const reasons = Object.entries(s.invalidByReason).map(([r, n]) => `${r} ${n}`).join(' · ') || '-';
    const line = `reçues ${s.received} · valides ${s.valid} · invalides ${s.invalid} (${reasons})`;
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
