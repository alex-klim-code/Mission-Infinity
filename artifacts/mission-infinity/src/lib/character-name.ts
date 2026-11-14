/** Keep username validation aligned with the character API before submitting. */
export function nameError(name: string): string | null {
  const value = name.trim();
  if (value.length < 3) return 'Username needs at least 3 characters.';
  if (value.length > 24) return 'Username can be at most 24 characters.';
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._'’-]{2,23}$/u.test(value)) {
    return 'Start with a letter or number. Use letters, numbers, spaces, apostrophes, periods, underscores or hyphens.';
  }
  return null;
}
