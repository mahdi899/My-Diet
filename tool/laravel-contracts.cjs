/* Snapshot the actual Nest decorators; no endpoints are inferred from documentation.
 * --check validates the frozen files only and does not read backend/.
 * --against-source (and a bare run) still need the Nest tree. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'backend-laravel/contracts/nest-routes.json');
const snapshotDirectory = path.join(root, 'backend-laravel/contracts/postgres-source');
const manifest = JSON.parse(fs.readFileSync(path.join(snapshotDirectory, 'manifest.json'), 'utf8'));

function snapshotHashes() {
  const names = Object.keys(manifest).sort();
  for (const name of names) {
    const file = path.join(snapshotDirectory, name);
    if (!fs.existsSync(file)) throw new Error('PostgreSQL source snapshot is missing: ' + name);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (hash !== manifest[name]) throw new Error('PostgreSQL source snapshot mismatch: ' + name);
  }
  return names.length;
}

if (process.argv.includes('--check') && !process.argv.includes('--against-source')) {
  const saved = JSON.parse(fs.readFileSync(target, 'utf8'));
  if (!Array.isArray(saved.routes) || saved.routes.length < 271) throw new Error('frozen Nest contract snapshot is incomplete');
  for (const route of saved.routes) {
    for (const field of ['method', 'path', 'public', 'roles', 'defaultStatus', 'module', 'source', 'handler']) {
      if (route[field] === undefined) throw new Error('frozen route is missing ' + field);
    }
  }
  const snapshots = snapshotHashes();
  console.log(`${saved.routes.length} frozen Nest HTTP contracts verified without reading backend/.`);
  console.log(`${snapshots} PostgreSQL source snapshots verified from the frozen copies.`);
  process.exit(0);
}

const ts = require('../backend/node_modules/typescript');
const methods = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete', 'Head', 'Options', 'All']);
function decorators(node) {
  return (ts.getDecorators(node) || []).map(d => {
    const e = d.expression;
    if (!ts.isCallExpression(e) || !ts.isIdentifier(e.expression)) throw new Error(`Unsupported decorator: ${d.getText()}`);
    return { name: e.expression.text, args: e.arguments };
  });
}
function literal(node) {
  if (!node) return '';
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  throw new Error(`Non-literal route metadata: ${node.getText()}`);
}
function paths(node) {
  return node && ts.isArrayLiteralExpression(node) ? node.elements.map(literal) : [literal(node)];
}
const routes = [];
function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { visit(file); continue; }
    if (!file.endsWith('.ts')) continue;
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const controller of source.statements.filter(ts.isClassDeclaration)) {
      const cd = decorators(controller);
      const prefix = cd.find(d => d.name === 'Controller');
      if (!prefix) continue;
      for (const member of controller.members.filter(ts.isMethodDeclaration)) {
        const md = decorators(member);
        for (const method of md.filter(d => methods.has(d.name))) {
          for (const base of paths(prefix.args[0])) for (const suffix of paths(method.args[0])) {
          const url = '/' + [base, suffix].filter(Boolean).join('/').replace(/^\/+|\/+$/g, '');
          routes.push({
            method: method.name.toUpperCase(), path: url,
            public: !url.startsWith('/v1') || [...md, ...cd].some(d => d.name === 'Public'),
            roles: (md.find(d => d.name === 'Roles') || cd.find(d => d.name === 'Roles'))?.args.map(literal) || [],
            defaultStatus: Number(literal(md.find(d => d.name === 'HttpCode')?.args[0]) || (method.name === 'Post' ? 201 : 200)),
            module: path.relative(path.join(root, 'backend/src'), file).split(path.sep)[0],
            source: path.relative(root, file).replaceAll('\\', '/'),
            handler: `${controller.name.text}.${member.name.getText(source)}`,
          });
          }
        }
      }
    }
  }
}
visit(path.join(root, 'backend/src'));
routes.sort((a, b) => a.path.localeCompare(b.path, 'en') || a.method.localeCompare(b.method, 'en'));
const output = JSON.stringify({ schemaVersion: 1, routes }, null, 2) + '\n';
if (process.argv.includes('--against-source')) {
  if (fs.readFileSync(target, 'utf8') !== output) throw new Error('Nest contract inventory is stale. Run node tool/laravel-contracts.cjs');
} else {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output);
}
console.log(`${routes.length} Nest HTTP contracts ${process.argv.includes('--against-source') ? 'verified against source' : 'recorded'}.`);
const sourceDirectory = path.join(root, 'backend/migrations');
const sqlFiles = fs.readdirSync(sourceDirectory).filter(f => f.endsWith('.sql')).sort();
if (JSON.stringify(sqlFiles) !== JSON.stringify(Object.keys(manifest).sort())) throw new Error('PostgreSQL migration inventory is stale.');
for (const name of sqlFiles) {
  for (const directory of [sourceDirectory, snapshotDirectory]) {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, name))).digest('hex');
    if (hash !== manifest[name]) throw new Error('PostgreSQL source snapshot mismatch: ' + name);
  }
}
console.log(`${sqlFiles.length} PostgreSQL source snapshots verified (reference only; not executed on MySQL).`);
