import { existsSync } from 'node:fs';

/**
 * Charge un fichier .env s'il existe (Node >= 20.12), sans dépendance externe.
 * Les variables déjà définies dans l'environnement restent prioritaires.
 */
export function loadDotEnv(path = '.env'): void {
  if (existsSync(path)) {
    process.loadEnvFile(path);
  }
}

/** Lit un entier depuis l'environnement, avec valeur par défaut et bornes. */
export function readInt(
  env: NodeJS.ProcessEnv,
  name: string,
  defaultValue: number,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return defaultValue;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Variable ${name} invalide : "${raw}" (entier attendu entre ${min} et ${max})`);
  }
  return value;
}

/** Lit une chaîne depuis l'environnement, avec valeur par défaut. */
export function readString(env: NodeJS.ProcessEnv, name: string, defaultValue: string): string {
  const raw = env[name];
  return raw === undefined || raw.trim() === '' ? defaultValue : raw.trim();
}
