/**
 * Weekly leaderboard — the data layer behind /api/league.
 *
 * Same constraints as `admin.ts`: zero imports (loadable directly by node
 * strip-types from the e2e runner), callers pass a query function, and the
 * API is privacy-first — rank/count only, never another learner's identity.
 */

export type QueryResult = { rows: Record<string, unknown>[] };
export type QueryFn = (text: string, params?: unknown[]) => Promise<QueryResult>;

export const WEEK_PATTERN = /^\d{4}-W\d{2}$/;

export const SCHEMA_SQL = `
create table if not exists public.weekly_xp (
  user_id    text not null,
  week       text not null,
  xp         integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, week)
);
create index if not exists weekly_xp_week_idx on public.weekly_xp (week, xp desc);
`;

export const SQL = {
  /**
   * Absolute-value upsert: the client reports its weekly total (single source
   * of truth = on-device XP), and `greatest` makes retries idempotent —
   * re-posting an older number never rolls the leaderboard back.
   */
  claim: `
    insert into public.weekly_xp (user_id, week, xp)
    values ($1, $2, $3)
    on conflict (user_id, week)
      do update set xp = greatest(public.weekly_xp.xp, excluded.xp),
                    updated_at = now()
    returning xp`,
  leaderboard: `
    with ranked as (
      select user_id, xp,
             rank() over (order by xp desc, user_id) as rank
        from public.weekly_xp
       where week = $1
    )
    select
      (select count(*)::int from ranked)                              as total,
      (select rank::int  from ranked where user_id = $2)              as my_rank,
      (select xp::int    from ranked where user_id = $2)              as my_xp`,
} as const;

export async function ensureSchema(q: QueryFn): Promise<void> {
  await q(SCHEMA_SQL);
}

export async function claimWeeklyXp(
  q: QueryFn,
  userId: string,
  week: string,
  xp: number
): Promise<{ xp: number }> {
  const { rows } = await q(SQL.claim, [userId, week, xp]);
  return { xp: Number(rows[0]?.xp ?? 0) };
}

export type Leaderboard = {
  total: number;
  /** null = no XP logged for this user this week (never fake a rank). */
  rank: number | null;
  xp: number;
};

export async function fetchLeaderboard(
  q: QueryFn,
  week: string,
  userId: string
): Promise<Leaderboard> {
  const { rows } = await q(SQL.leaderboard, [week, userId]);
  const row = rows[0] ?? {};
  return {
    total: Number(row.total ?? 0),
    rank: row.my_rank == null ? null : Number(row.my_rank),
    xp: Number(row.my_xp ?? 0),
  };
}
