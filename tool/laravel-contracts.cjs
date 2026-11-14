/* Snapshot the actual Nest decorators; no endpoints are inferred from documentation. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../backend/node_modules/typescript');
const root = path.resolve(__dirname, '..');
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
const target = path.join(root, 'backend-laravel/contracts/nest-routes.json');
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8') !== output) throw new Error('Nest contract inventory is stale. Run node tool/laravel-contracts.cjs');
} else {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output);
}
console.log(`${routes.length} Nest HTTP contracts ${process.argv.includes('--check') ? 'verified' : 'recorded'}.`);
