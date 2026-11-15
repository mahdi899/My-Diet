const { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } = require('node:fs');
const { resolve, dirname } = require('node:path');

const root = resolve(__dirname, '..');
const desktopHtml = resolve(root, '..', '..', 'sabzine.html');
const onboardingDir = existsSync(resolve(root, 'onboarding'))
  ? resolve(root, 'onboarding')
  : resolve(root, '..', 'demo');
const siteAssets = resolve(root, 'frontend', 'public', 'assets');
const assetsDir = resolve(onboardingDir, 'assets');

if (!existsSync(desktopHtml)) {
  console.error('Missing source:', desktopHtml);
  process.exit(1);
}

mkdirSync(assetsDir, { recursive: true });
const iranFontDir = resolve(process.env.USERPROFILE, 'Desktop', 'New folder (17)');
const iranFonts = [
  'IRANSansX-Regular.ttf',
  'IRANSansX-Medium.ttf',
  'IRANSansX-DemiBold.ttf',
  'IRANSansX-Bold.ttf',
  'IRANSansX-ExtraBold.ttf',
  'IRANSansX-Black.ttf',
];
for (const name of ['mark.svg', 'salad.jpg']) {
  copyFileSync(resolve(siteAssets, name), resolve(assetsDir, name));
}
for (const name of iranFonts) {
  const fromIran = resolve(iranFontDir, name);
  const fromAssets = resolve(assetsDir, name);
  if (existsSync(fromIran)) {
    copyFileSync(fromIran, resolve(assetsDir, name));
  } else if (!existsSync(fromAssets)) {
    console.warn('Missing demo font:', name);
  }
}
const logoFromSite = resolve(siteAssets, 'logo.png');
if (existsSync(logoFromSite)) {
  copyFileSync(logoFromSite, resolve(assetsDir, 'logo.png'));
} else {
  const logoJpg = resolve(siteAssets, 'logo.jpg');
  if (existsSync(logoJpg)) {
    copyFileSync(logoJpg, resolve(assetsDir, 'logo.jpg'));
  }
}
copyFileSync(resolve(siteAssets, 'salad.jpg'), resolve(assetsDir, 'hero.jpg'));

let html = readFileSync(desktopHtml, 'utf8');

html = html.replace(
  /src="data:image\/jpeg;base64,[^"]+"/,
  'src="assets/hero.jpg"',
);

html = html.replace(
  /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]+" rel="stylesheet">/,
  '<link rel="icon" href="assets/logo.png" type="image/png">\n  <link rel="stylesheet" href="theme.css">',
);

html = html.replace(
  /<meta name="viewport"[^>]+>/,
  '$&\n  <meta name="theme-color" content="#205638">',
);

html = html.replace(
  /<script src="https:\/\/cdn\.tailwindcss\.com\/[^"]+"><\/script>/,
  `<script src="https://cdn.tailwindcss.com/3.4.17"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { sans: ['IRANSansX', 'Tahoma', 'sans-serif'] },
          colors: {
            emerald: {
              200: '#c3d0bb',
              300: '#205638',
              400: '#205638',
              500: '#205638',
              950: '#173f2a',
            },
            teal: {
              300: '#205638',
              400: '#205638',
              500: '#205638',
            },
            slate: {
              950: '#f7f8f0',
              900: '#ffffff',
              800: '#eaf1dc',
              700: '#dee5d5',
              600: '#586b50',
              500: '#76836e',
              400: '#76836e',
              300: '#586b50',
              200: '#233c2d',
            },
          },
        },
      },
    };
  </script>`,
);

html = html.replace(
  /body \{\s*font-family:[^;]+;\s*background:[^;]+;\s*color:[^;]+;/,
  `body {
      font-family: 'IRANSansX', Tahoma, sans-serif;
      background: #f7f8f0;
      color: #233c2d;`,
);

html = html.replace(
  /\.slogan-highlight \{\s*color: #34d399;[^}]+\}/,
  `.slogan-highlight {
      color: #205638;
      text-shadow: none;
      animation: none;
    }`,
);

html = html.replace(
  /@keyframes highlightColorPulse[\s\S]*?\}/,
  '',
);

html = html.replace(
  /body class="selection:bg-emerald-500 selection:text-slate-950"/,
  'body class="selection:bg-[#205638] selection:text-white"',
);

writeFileSync(resolve(onboardingDir, 'index.html'), html, 'utf8');
console.log('Built', resolve(onboardingDir, 'index.html'));
