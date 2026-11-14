import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';
import { ApplicationError } from '../../src/common/application-error.js';
import { classifyProblem } from '../../src/common/problem.js';

const root = fileURLToPath(new URL('../../..', import.meta.url));

function dependencies(file: string, visited = new Set<string>()): Set<string> {
  if (visited.has(file)) return visited;
  visited.add(file);
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  function visit(node: ts.Node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const name = node.moduleSpecifier.text;
      assert.ok(!/^(?:@nestjs\/|pg$|pg-boss$)/.test(name), `${file} depends on ${name}`);
      if (name.startsWith('.')) {
        const target = path.resolve(path.dirname(file), name.replace(/\.js$/, '.ts'));
        assert.ok(!/[\\/](?:infrastructure|adapters|database|config|metrics)[\\/]/.test(target), `${file} depends on outer module ${target}`);
        dependencies(target, visited);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return visited;
}

test('plan and transfer business rules have no transitive dependency on Nest, SQL drivers or infrastructure', () => {
  for (const entry of [
    'backend/src/plans/application/plan-use-cases.ts',
    'backend/src/plans/domain/draft.ts',
    'backend/src/onboarding/application/onboarding-transfers.ts',
  ]) dependencies(path.join(root, entry));
});

test('React onboarding domain stays independent of browser storage and UI stores', () => {
  const domain = path.join(root, 'frontend/src/features/onboarding/domain');
  for (const file of readdirSync(domain).filter(file => file.endsWith('.ts'))) {
    const source = readFileSync(path.join(domain, file), 'utf8');
    assert.doesNotMatch(source, /\b(?:sessionStorage|localStorage|window|document)\b/);
    assert.doesNotMatch(source, /from\s+['"][^'"]*(?:application|infrastructure|presentation|zustand|react)[^'"]*['"]/);
  }
});

test('the HTTP adapter keeps the public status and Persian message for an application failure', () => {
  assert.deepEqual(classifyProblem(new ApplicationError(409, 'lock_conflict', 'نسخه تغییر کرده است')), {
    status: 409, code: 'lock_conflict', messageFa: 'نسخه تغییر کرده است', retryable: false,
  });
});
