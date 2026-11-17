const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const run = promisify(execFile);

test('frozen SQL contracts accept both line endings and reject changed SQL', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mydiet-contract-check-'));
  try {
    const tools = path.join(directory, 'tool');
    const contracts = path.join(directory, 'backend-laravel', 'contracts');
    const snapshots = path.join(contracts, 'postgres-source');
    await fs.mkdir(tools, { recursive: true });
    await fs.mkdir(snapshots, { recursive: true });
    const checker = path.join(tools, 'laravel-contracts.cjs');
    await fs.copyFile(path.join(__dirname, 'laravel-contracts.cjs'), checker);
    const route = { method: 'GET', path: 'v1/example', public: true, roles: [], defaultStatus: 200,
      module: 'fixture', source: 'fixture.ts', handler: 'example' };
    await fs.writeFile(path.join(contracts, 'nest-routes.json'), JSON.stringify({ routes: Array(271).fill(route) }));
    const sql = '-- frozen fixture\nSELECT 1;\n';
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    await fs.writeFile(path.join(snapshots, 'manifest.json'), JSON.stringify({ 'fixture.sql': checksum }));
    const fixture = path.join(snapshots, 'fixture.sql');
    for (const content of [sql, sql.replace(/\n/g, '\r\n')]) {
      await fs.writeFile(fixture, content);
      const checked = await run(process.execPath, [checker, '--check'], { windowsHide: true });
      assert.match(checked.stdout, /1 PostgreSQL source snapshots verified/);
    }
    await fs.writeFile(fixture, sql.replace('SELECT 1', 'SELECT 2'));
    await assert.rejects(run(process.execPath, [checker, '--check'], { windowsHide: true }),
      error => error.code === 1 && /PostgreSQL source snapshot mismatch/.test(error.stderr));
  } finally {
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('mydiet-contract-check-'));
    await fs.rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
