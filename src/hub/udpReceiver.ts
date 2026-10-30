import { type Socket, createSocket } from 'node:dgram';

export type DatagramHandler = (datagram: Buffer) => void;

/**
 * Socket UDP du hub : transmet chaque datagramme reçu au handler, sans rien savoir du protocole.
 * Une erreur dans le traitement d'un datagramme est comptée puis ignorée : elle ne doit jamais arrêter le hub.
 */
export class UdpReceiver {
  private readonly socket: Socket = createSocket('udp4');
  handlerErrors = 0;

  constructor(private readonly onDatagram: DatagramHandler) {
    this.socket.on('message', (datagram) => {
      try {
        this.onDatagram(datagram);
      } catch (error) {
        this.handlerErrors++;
        console.error('Erreur de traitement d\'un datagramme :', error);
      }
    });
    this.socket.on('error', (error) => console.error('Erreur socket UDP :', error.message));
  }

  /** Démarre l'écoute ; la promesse échoue si le port est déjà utilisé. */
  listen(port: number, host: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.once('error', reject);
      this.socket.bind(port, host, () => {
        this.socket.off('error', reject);
        resolve();
      });
    });
  }

  close(): void {
    this.socket.close();
  }
}
