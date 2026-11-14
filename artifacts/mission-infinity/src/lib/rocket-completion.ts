type Section = { id: string; categories: { id: string }[] };

/** Confirmed categories only; sections with more categories carry more weight. */
export const completionPercent = (done: number, total: number) => total > 0 ? Math.round(done / total * 100) : 0;

export function completionStats(sections: Section[], official: ReadonlyMap<string, string>) {
  const per = sections.map(s => {
    const done = s.categories.filter(c => official.has(c.id)).length;
    return { id: s.id, done, total: s.categories.length, pct: completionPercent(done, s.categories.length) };
  });
  const done = per.reduce((sum, s) => sum + s.done, 0);
  const total = per.reduce((sum, s) => sum + s.total, 0);
  return { per, done, total, pct: completionPercent(done, total) };
}
