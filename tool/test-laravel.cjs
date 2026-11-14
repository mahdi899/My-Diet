/* Disposable MySQL integration environment. Never connects to the application's .env database. */
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
const root = path.resolve(__dirname, '..');
const php = process.env.PHP_BINARY || path.join(root, '.tools/php84/php.exe');
const mysqlHome = process.env.MYSQL_HOME || path.join(root, '.tools/mysql84/mysql-8.4.13-winx64');
const binary = name => path.join(mysqlHome, 'bin', name + (process.platform === 'win32' ? '.exe' : ''));
const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer(); s.on('error', reject); s.listen(0, '127.0.0.1', () => {
    const port = s.address().port; s.close(() => resolve(port));
  });
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sabzine-mysql-test-'));
  const port = await freePort();
  const args = ['--no-defaults', '--host=127.0.0.1', '--port=' + port, '--user=root'];
  let server;
  let output = '';
  try {
    await run(binary('mysqld'), ['--no-defaults', '--initialize-insecure', '--basedir=' + mysqlHome, '--datadir=' + directory], { windowsHide: true, timeout: 90000 });
    server = spawn(binary('mysqld'), ['--no-defaults', '--basedir=' + mysqlHome, '--datadir=' + directory, '--bind-address=127.0.0.1', '--port=' + port, '--mysqlx=OFF', '--innodb-flush-log-at-trx-commit=2', '--sync-binlog=0', '--console'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', chunk => { output += chunk; });
    server.stderr.on('data', chunk => { output += chunk; });
    let ready = false;
    for (let i = 0; i < 120; i++) {
      if (server.exitCode !== null) throw new Error('Disposable MySQL exited: ' + output);
      try { await run(binary('mysqladmin'), [...args, 'ping'], { windowsHide: true, timeout: 2000 }); ready = true; break; } catch {}
      await delay(250);
    }
    if (!ready) throw new Error('Disposable MySQL did not become ready: ' + output);
    const password = crypto.randomBytes(24).toString('hex');
    await run(binary('mysql'), [...args, '--execute', `create database sabzine_test character set utf8mb4 collate utf8mb4_0900_bin; create user 'sabzine_test'@'127.0.0.1' identified by '${password}'; grant all privileges on sabzine_test.* to 'sabzine_test'@'127.0.0.1';`], { windowsHide: true });
    if (process.argv.includes('--cross-runtime')) {
      await run(binary('mysql'), [...args, '--execute', "create database sabzine_full_test character set utf8mb4 collate utf8mb4_0900_bin; grant all privileges on sabzine_full_test.* to 'sabzine_test'@'127.0.0.1';"], { windowsHide: true });
    }
    const url = `mysql://sabzine_test:${password}@127.0.0.1:${port}/sabzine_test`;
    const env = { ...process.env, APP_ENV: 'testing', NODE_ENV: 'development', DATABASE_URL: url, MYSQL_TEST_URL: url,
      DB_CONNECTION: 'mysql', CACHE_STORE: 'array', SESSION_DRIVER: 'array', SMS_PROVIDER: 'console', OTP_FIXED_CODE: '123456',
      JWT_SECRET: 'test-only-cross-runtime-jwt-secret', OTP_PEPPER: 'test-only-cross-runtime-otp-pepper', FIELD_KEY: 'test-only-cross-runtime-field-key', PHP_BINARY: php };
    const options = { cwd: path.join(root, 'backend-laravel'), env, windowsHide: true, timeout: 120000, maxBuffer: 8 * 1024 * 1024 };
    const migrated = await run(php, ['artisan', 'migrate', '--force', '--no-interaction'], {
      ...options, env: { ...env, DATABASE_URL: `mysql://root@127.0.0.1:${port}/sabzine_test` },
    });
    process.stdout.write(migrated.stdout);
    if (!process.argv.includes('--schema-only')) {
      const tests = await run(php, ['vendor/bin/phpunit'], options);
      process.stdout.write(tests.stdout);
    }
    if (process.argv.includes('--cross-runtime')) {
      const browserModule = path.join(root, '.tools/browser-tests/node_modules/playwright');
      try {
        await fs.access(path.join(browserModule, 'package.json'));
        env.PLAYWRIGHT_MODULE ||= browserModule;
      } catch {}
      const fullTarget = new URL(url);
      fullTarget.pathname = '/sabzine_full_test';
      const fullUrl = fullTarget.href;
      const fullMigration = await run(php, ['artisan', 'migrate', '--force', '--no-interaction'], { ...options, env: { ...env, MIGRATION_SKIP_PRODUCT_SEEDS: 'true', DATABASE_URL: `mysql://root@127.0.0.1:${port}/sabzine_full_test` } });
      process.stdout.write(fullMigration.stdout);
      const testFileIndex = process.argv.indexOf('--test-file');
      const testFiles = testFileIndex === -1 ? ['test/compatibility/laravel.spec.ts', 'test/compatibility/product-import.spec.ts'] : [process.argv[testFileIndex + 1]];
      const result = await run(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', ...testFiles], { ...options, env: { ...env, MYSQL_FULL_TEST_URL: fullUrl }, cwd: path.join(root, 'backend'), timeout: 240000 });
      process.stdout.write(result.stdout);
    }
    await run(binary('mysqladmin'), [...args, 'shutdown'], { windowsHide: true, timeout: 20000 });
    await new Promise(resolve => server.exitCode !== null ? resolve() : server.once('exit', resolve));
  } finally {
    await run(binary('mysqladmin'), [...args, 'shutdown'], { windowsHide: true, timeout: 20000 }).catch(() => undefined);
    if (server && server.exitCode === null) {
      server.kill();
      await new Promise(resolve => server.once('exit', resolve));
    }
    const resolved = path.resolve(directory);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('sabzine-mysql-test-')) {
      throw new Error('Unexpected disposable database cleanup path');
    }
    await fs.rm(resolved, { recursive: true, force: true, maxRetries: 15, retryDelay: 200 });
  }
})().catch(error => {
  if (error.stdout) process.stderr.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  console.error(error.message);
  process.exitCode = 1;
});
