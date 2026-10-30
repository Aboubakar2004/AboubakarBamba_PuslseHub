import { readFileSync } from 'node:fs';
import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import type { HubSummary } from '../summary.js';

/**
 * Serveur HTTP du tableau de bord, sans framework :
 * - GET /             -> la page (un seul fichier HTML, sans dépendance)
 * - GET /api/summary  -> la synthèse courante en JSON
 * - GET /events       -> la synthèse poussée en continu (Server-Sent Events)
 * Il ne calcule rien : il reçoit une fonction qui fournit la synthèse (injection de dépendance).
 */
export class DashboardServer {
  private readonly page = readFileSync(new URL('./index.html', import.meta.url));
  private readonly clients = new Set<ServerResponse>();
  private readonly server: Server;
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly getSummary: () => HubSummary,
    private readonly refreshMs: number,
  ) {
    this.server = createServer((req, res) => this.route(req, res));
  }

  listen(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(port, () => {
        this.server.off('error', reject);
        // Une seule synthèse calculée par rafraîchissement, partagée par tous les navigateurs ouverts.
        this.timer = setInterval(() => this.broadcast(), this.refreshMs);
        resolve();
      });
    });
  }

  close(): void {
    clearInterval(this.timer);
    for (const client of this.clients) client.end();
    this.server.close();
  }

  private route(req: IncomingMessage, res: ServerResponse): void {
    const path = (req.url ?? '/').split('?')[0];
    if (req.method !== 'GET') {
      res.writeHead(405).end();
    } else if (path === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(this.page);
    } else if (path === '/api/summary') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(this.getSummary()));
    } else if (path === '/events') {
      this.subscribe(res);
    } else {
      res.writeHead(404).end('Not found');
    }
  }

  private subscribe(res: ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    this.clients.add(res);
    res.on('close', () => this.clients.delete(res));
    res.write(`data: ${JSON.stringify(this.getSummary())}\n\n`); // affichage immédiat, sans attendre le premier tick
  }

  private broadcast(): void {
    if (this.clients.size === 0) return;
    const message = `data: ${JSON.stringify(this.getSummary())}\n\n`;
    for (const client of this.clients) client.write(message);
  }
}
