export interface SchemaOption {
  code: string;
  label: string;
  retired?: boolean;
}

export interface SchemaQuestion {
  id: string;
  title: string;
  kind: 'text' | 'number' | 'single' | 'multiple';
  options?: SchemaOption[];
  required?: boolean;
}

const KINDS = new Set(['text', 'number', 'single', 'multiple']);

function optionCodes(question: SchemaQuestion): string[] {
  return (question.options ?? []).map((option) => option.code);
}

/** Built-in questions and their codes stay. Labels may change. Custom ids are `custom_*`. */
export function compatibilityErrors(next: SchemaQuestion[], builtin: SchemaQuestion[]): string[] {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  for (const question of next) {
    if (!question.id || seenIds.has(question.id)) errors.push(`reused question ${question.id || '(empty)'}`);
    seenIds.add(question.id);
    if (!KINDS.has(question.kind)) errors.push(`unknown kind ${question.id}`);
    if (!question.title?.trim()) errors.push(`missing title ${question.id}`);
    const codes = new Set<string>();
    for (const option of question.options ?? []) {
      if (!option.code || codes.has(option.code)) errors.push(`reused option ${question.id}.${option.code || '(empty)'}`);
      codes.add(option.code);
      if (!option.label?.trim()) errors.push(`missing label ${question.id}.${option.code}`);
    }
  }
  const builtinIds = new Set(builtin.map((question) => question.id));
  for (const built of builtin) {
    const found = next.find((question) => question.id === built.id);
    if (!found) {
      errors.push(`deleted built-in question ${built.id}`);
      continue;
    }
    if (found.kind !== built.kind) errors.push(`changed kind ${built.id}`);
    for (const code of optionCodes(built)) {
      if (!optionCodes(found).includes(code)) errors.push(`deleted built-in option ${built.id}.${code}`);
    }
  }
  for (const question of next) {
    if (builtinIds.has(question.id)) continue;
    if (!/^custom_[a-z0-9_]+$/.test(question.id)) errors.push(`invalid custom question ${question.id}`);
  }
  return errors;
}
