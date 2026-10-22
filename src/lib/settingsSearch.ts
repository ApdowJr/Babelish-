/**
 * Settings search — pure, so the filtering rules can be tested without
 * mounting the screen.
 *
 * Real settings screens are searchable, and a search box that only matches
 * exact words is worse than none: this matches the label, the hint under it
 * and a small keyword list ("dark", "notification", "delete"), in any case,
 * and keeps a whole group when its title matches.
 */

export type SettingsSearchRow = {
  label: string;
  hint?: string;
  /** Extra words a learner might type ("reminder", "haptics", "data"). */
  keywords?: string;
};

export type SettingsSearchGroup<Row extends SettingsSearchRow> = {
  title: string;
  rows: Row[];
};

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function rowMatches(row: SettingsSearchRow, needle: string): boolean {
  return [row.label, row.hint ?? '', row.keywords ?? ''].some((value) =>
    value.toLowerCase().includes(needle)
  );
}

/**
 * Returns only the groups and rows that match. An empty query returns the
 * input untouched (same references), so the screen does not re-render noise.
 */
export function filterSettings<Group extends SettingsSearchGroup<Row>, Row extends SettingsSearchRow>(
  groups: Group[],
  query: string
): Group[] {
  const needle = normalizeQuery(query);
  if (!needle) return groups;

  const out: Group[] = [];
  for (const group of groups) {
    if (group.title.toLowerCase().includes(needle)) {
      out.push(group);
      continue;
    }
    const rows = group.rows.filter((row) => rowMatches(row, needle));
    if (rows.length > 0) out.push({ ...group, rows });
  }
  return out;
}
