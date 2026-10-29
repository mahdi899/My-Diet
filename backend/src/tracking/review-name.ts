/** A public review shows the first name and the first letter of the last name. */
export function publicReviewerName(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter((part) => part.length > 0);
  const first = parts[0];
  if (!first) return '';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  if (!last) return first;
  const initial = [...last][0] ?? '';
  return `${first} ${initial}.`;
}
