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

export interface NumberRule {
  min?: number;
  max?: number;
  integer?: boolean;
}

/** Convertit une chaîne en nombre en respectant les bornes ; lève une erreur explicite sinon. */
export function parseNumber(name: string, raw: string, rule: NumberRule = {}): number {
  const { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER, integer = false } = rule;
  const value = Number(raw);
  const typeOk = integer ? Number.isInteger(value) : Number.isFinite(value);
  if (raw.trim() === '' || !typeOk || value < min || value > max) {
    const kind = integer ? 'entier' : 'nombre';
    throw new Error(`Paramètre ${name} invalide : "${raw}" (${kind} attendu entre ${min} et ${max})`);
  }
  return value;
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
  return parseNumber(name, raw, { min, max, integer: true });
}

/** Lit une chaîne depuis l'environnement, avec valeur par défaut. */
export function readString(env: NodeJS.ProcessEnv, name: string, defaultValue: string): string {
  const raw = env[name];
  return raw === undefined || raw.trim() === '' ? defaultValue : raw.trim();
}
