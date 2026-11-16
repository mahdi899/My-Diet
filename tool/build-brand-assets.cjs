// Export the approved vector masters to all app/site icon sizes.
// Uses the same local Playwright installation as the browser checks.
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '../.tools/browser-tests/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const masters = path.join(root, 'references/brand');
const output = path.join(root, 'frontend/public/brand');
const write = async (file, data) => {
  const target = path.join(root, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, data);
};
const read = name => fs.readFile(path.join(masters, `${name}.svg`), 'utf8');
const white = svg => svg.replace(/fill="(?:url\(#[^)]+\)|#[0-9a-f]+)"/gi, 'fill="#FFFFFF"');
const mono = svg => white(svg).replaceAll('#FFFFFF', '#0B7A55');
const nested = (svg, x, y, width, height) => svg.replace('<svg ', `<svg x="${x}" y="${y}" width="${width}" height="${height}" `);
const wrap = (body, width, height) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${body}</svg>\n`;
const icon = (symbol, { maskable = false, foreground = false } = {}) => wrap(
  (foreground ? '' : `<rect width="512" height="512" rx="${maskable ? 0 : 104}" fill="#0B7A55"/>`) +
  nested(white(symbol), 97, 97, 318, 318), 512, 512,
);
const lockup = (symbol, wordmark) => wrap(nested(symbol, 304, 4, 164, 152) + nested(wordmark, 8, 30, 280, 100), 480, 160);

async function main() {
  const symbol = await read('symbol');
  const wordmark = await read('wordmark');
  const assets = {
    'symbol.svg': symbol,
    'symbol-white.svg': white(symbol),
    'symbol-mono.svg': mono(symbol),
    'wordmark.svg': wordmark,
    'wordmark-white.svg': white(wordmark),
    'logo.svg': lockup(symbol, wordmark),
    'logo-white.svg': lockup(white(symbol), white(wordmark)),
    'icon.svg': icon(symbol),
  };
  for (const [name, svg] of Object.entries(assets)) await write(`frontend/public/brand/${name}`, svg);
  // Keep historical public asset URLs current for bookmarks and old consumers.
  for (const file of ['frontend/public/mark.svg', 'frontend/public/assets/mark.svg', 'frontend/public/onboarding/assets/mark.svg']) {
    await write(file, assets['icon.svg']);
  }
  await write('app/web/sabzine-mark.svg', symbol);
  await write('app/web/favicon.svg', assets['icon.svg']);

  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'chrome' } : {}) });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const render = async (svg, file, width, height = width) => {
      await page.setViewportSize({ width, height });
      await page.setContent(`<style>html,body{margin:0;background:transparent}body>svg{display:block;width:100vw;height:100vh}</style>${svg}`);
      const target = path.join(root, file);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await page.screenshot({ path: target, omitBackground: true });
    };
    await render(symbol, 'app/assets/brand/symbol.png', 1024);
    await render(wordmark, 'app/assets/brand/wordmark.png', 1200, 388);
    await render(assets['logo.svg'], 'frontend/public/brand/logo.png', 960, 320);
    await render(icon(symbol), 'frontend/public/brand/icon.png', 1024);
    await render(symbol, 'frontend/public/brand/symbol.png', 1024);
    for (const file of ['frontend/public/onboarding/assets/logo.png', 'frontend/public/admin-assets/logo.png']) {
      await render(symbol, file, 256);
    }
    // The deprecated JPEG is retained as a cream-backed compatibility export.
    await page.setContent(`<style>html,body{margin:0;background:#FBF7EE}svg{width:256px;height:256px;display:block}</style>${symbol}`);
    await page.setViewportSize({ width: 256, height: 256 });
    await page.screenshot({ path: path.join(root, 'frontend/public/onboarding/assets/logo.jpg'), type: 'jpeg', quality: 95 });
    for (const size of [192, 512]) {
      await render(icon(symbol), `app/web/icons/Icon-${size}.png`, size);
      await render(icon(symbol, { maskable: true }), `app/web/icons/Icon-maskable-${size}.png`, size);
    }
    await render(icon(symbol), 'app/web/favicon.png', 32);
    await render(icon(symbol, { maskable: true }), 'frontend/public/brand/apple-touch-icon.png', 180);
    for (const [density, size] of Object.entries({ mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 })) {
      await render(icon(symbol), `app/android/app/src/main/res/mipmap-${density}/ic_launcher.png`, size);
    }
    // Standard ICO: one PNG-compressed 256px image supported by Windows Vista+.
    const png = await fs.readFile(path.join(output, 'icon.png'));
    await render(icon(symbol), 'references/brand/windows-icon-256.png', 256);
    const icoPng = await fs.readFile(path.join(masters, 'windows-icon-256.png'));
    const header = Buffer.alloc(22);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(1, 4);
    header.writeUInt16LE(1, 10);
    header.writeUInt16LE(32, 12);
    header.writeUInt32LE(icoPng.length, 14);
    header.writeUInt32LE(22, 18);
    await write('app/windows/runner/resources/app_icon.ico', Buffer.concat([header, icoPng]));
    console.log(`Brand exports generated (${png.length} byte 1024px icon).`);
  } finally {
    await browser.close();
  }

  // Android startup/adaptive icons share the exact SVG curves.
  const xmlEscape = text => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  const box = symbol.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  const native = ({ background = false, whiteInk = false, width = 72 } = {}) => {
    const scale = width / box[2];
    const x = (108 - width) / 2 - box[0] * scale;
    const y = (108 - box[3] * scale) / 2 - box[1] * scale;
    const paths = [...symbol.matchAll(/<path ([^>]+)\/>/g)].map(([, attrs]) => {
      const d = attrs.match(/\bd="([^"]+)"/)[1];
      const translate = attrs.match(/transform="translate\(([^)]+)\)"/)?.[1].split(/[ ,]+/).map(Number) || [0, 0];
      const fill = whiteInk ? '#FFFFFF' : attrs.includes('#B8E04A') ? '#B8E04A' : '#12A072';
      return `<group android:translateX="${translate[0]}" android:translateY="${translate[1]}"><path android:fillColor="${fill}" android:pathData="${xmlEscape(d)}"/></group>`;
    }).join('');
    return `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">${background ? '<path android:fillColor="#0B7A55" android:pathData="M0,0h108v108h-108z"/>' : ''}<group android:translateX="${x}" android:translateY="${y}" android:scaleX="${scale}" android:scaleY="${scale}">${paths}</group></vector>\n`;
  };
  await write('app/android/app/src/main/res/drawable/sabzine_splash.xml', native());
  await write('app/android/app/src/main/res/drawable/sabzine_icon.xml', native({ background: true, whiteInk: true }));
  await write('app/android/app/src/main/res/drawable/sabzine_launcher_foreground.xml', native({ whiteInk: true, width: 62 }));
  await write('app/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml', '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/brand_icon_background"/><foreground android:drawable="@drawable/sabzine_launcher_foreground"/></adaptive-icon>\n');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
