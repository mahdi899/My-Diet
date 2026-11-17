// Edit app/lib (and web/assets), then refresh http://127.0.0.1:8781/app/
// Starts the static preview server and rebuilds Flutter web on save.
const { spawn } = require('node:child_process');
const { watch } = require('node:fs');
const { existsSync, statSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const appDir = resolve(root, 'app');
const watchDirs = ['lib', 'web', 'assets', 'pubspec.yaml'].map((p) =>
  resolve(appDir, p),
);

let building = false;
let queued = false;
let debounce = null;
let preview = null;

function flutterArgs() {
  return [
    'build',
    'web',
    '--debug',
    `--dart-define=API_BASE_URL=http://127.0.0.1:${Number(process.env.SABZINE_PREVIEW_PORT || 8781)}`,
    ...(process.argv.includes('--demo') ? ['--dart-define=USE_DEMO=true'] : []),
    '--no-wasm-dry-run',
  ];
}

function build() {
  if (building) {
    queued = true;
    return;
  }
  building = true;
  console.log('[preview-app] building web (debug)…');
  const child = spawn('flutter', flutterArgs(), {
    cwd: appDir,
    stdio: 'inherit',
    shell: true,
  });
  child.on('close', (code) => {
    building = false;
    if (code === 0) {
      console.log('[preview-app] ready — refresh http://127.0.0.1:8781/app/');
    } else {
      console.error('[preview-app] build failed (exit', code, ')');
    }
    if (queued) {
      queued = false;
      scheduleBuild();
    }
  });
}

function scheduleBuild() {
  clearTimeout(debounce);
  debounce = setTimeout(build, 1200);
}

function startPreview() {
  preview = spawn('node', [resolve(__dirname, 'preview_frontend.cjs')], {
    stdio: 'inherit',
    env: process.env,
  });
  preview.on('error', (err) => {
    console.error('[preview-app]', err.message);
    if (err.code === 'EADDRINUSE') {
      console.error('[preview-app] port 8781 busy — close the other preview and retry.');
    }
    process.exit(1);
  });
  preview.on('close', (code) => {
    if (code !== 0 && code !== null) process.exit(code);
  });
}

function watchSources() {
  const interesting = /\.(dart|html|json|yaml|svg|png|ttf|woff2)$/i;
  for (const target of watchDirs) {
    if (!existsSync(target)) continue;
    watch(target, { recursive: statSync(target).isDirectory() }, (_ev, file) => {
      if (file && !interesting.test(file)) return;
      console.log('[preview-app] change:', file || target);
      scheduleBuild();
    });
  }
}

function shutdown() {
  preview?.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

if (!existsSync(resolve(appDir, 'pubspec.yaml'))) {
  console.error('app/pubspec.yaml not found');
  process.exit(1);
}

startPreview();
build();
watchSources();
console.log('[preview-app] watching app/lib — keep this terminal open');
