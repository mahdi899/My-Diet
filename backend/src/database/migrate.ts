import path from 'path';
import { fileURLToPath } from 'url';

export async function migrateUp(databaseUrl: string): Promise<void> {
  const { runner } = await import('node-pg-migrate');
  const here = path.dirname(fileURLToPath(import.meta.url));
  await runner({
    databaseUrl,
    dir: path.join(here, '../../migrations'),
    direction: 'up',
    migrationsTable: 'pgmigrations',
    log: () => undefined,
    checkOrder: true,
  });
}
