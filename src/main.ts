import { Actor, log } from 'apify';
import { calendarToIcs } from './ics.js';
import { buildCalendar, buildDailySchedule, buildGroups, buildTeams, buildVenues, fetchOpenFootballWorldCup, filterFixtures, markFixturesAsCached, normalizeOpenFootball, scheduleHash } from './worldcup.js';
import type { ActorInput, RawOpenFootballWorldCup } from './types.js';

await Actor.init();

try {
  const input = (await Actor.getInput<ActorInput>()) ?? {};
  const source = input.source ?? 'openfootball';
  const outputMode = input.outputMode ?? 'fixtures';
  const timezone = input.timezone ?? 'UTC';
  const includeTbd = input.includeTbd ?? true;
  const emitChangeSummary = input.emitChangeSummary ?? true;
  const emitIcsCalendar = input.emitIcsCalendar ?? true;
  const maxItems = Math.max(0, input.maxItems ?? 0);
  const sortBy = input.sortBy ?? 'matchNumber';

  if (source !== 'openfootball') {
    throw new Error(`Unsupported source '${source}'. Current MVP supports 'openfootball'.`);
  }

  log.info('Fetching World Cup 2026 public schedule data', {
    source,
    outputMode,
    timezone,
    filters: {
      group: input.group,
      team: input.team,
      city: input.city,
      stage: input.stage,
      fromDate: input.fromDate,
      toDate: input.toDate,
      includeTbd,
      sortBy
    }
  });

  const kv = await Actor.openKeyValueStore();
  let raw: RawOpenFootballWorldCup;
  let sourceWasCached = false;
  let sourceError: string | null = null;

  try {
    raw = await fetchOpenFootballWorldCup();
    await kv.setValue('RAW_OPENFOOTBALL_CACHE', raw);
  } catch (error) {
    sourceError = error instanceof Error ? error.message : String(error);
    const cached = await kv.getValue<RawOpenFootballWorldCup>('RAW_OPENFOOTBALL_CACHE');
    if (!cached) throw error;
    raw = cached;
    sourceWasCached = true;
    log.warning('Live source fetch failed; using cached OpenFootball payload', { sourceError });
  }

  let fixtures = normalizeOpenFootball(raw, timezone);
  if (sourceWasCached) fixtures = markFixturesAsCached(fixtures, sourceError ?? 'unknown error');

  if (!includeTbd) {
    fixtures = fixtures.filter((fixture) => !fixture.notes.some((note) => note.includes('placeholder')));
  }

  fixtures = filterFixtures(fixtures, {
    group: input.group,
    team: input.team,
    city: input.city,
    stage: input.stage,
    fromDate: input.fromDate,
    toDate: input.toDate,
    sortBy
  });

  const groups = buildGroups(fixtures);
  const venues = buildVenues(fixtures);
  const teams = buildTeams(fixtures);
  const calendar = buildCalendar(fixtures);
  const dailySchedule = buildDailySchedule(fixtures);
  const currentHash = scheduleHash(fixtures);

  const previousHash = await kv.getValue<string>('LAST_SCHEDULE_HASH');
  const summary = {
    actor: 'world-cup-2026-fixtures-schedule-api',
    source,
    sourceName: raw.name,
    sourceWasCached,
    sourceError,
    fetchedAt: new Date().toISOString(),
    fixtureCount: fixtures.length,
    groupCount: groups.length,
    venueCount: venues.length,
    teamCount: teams.length,
    calendarEventCount: calendar.length,
    dailyScheduleDayCount: dailySchedule.length,
    icsCalendarKey: emitIcsCalendar ? 'world-cup-2026-fixtures.ics' : null,
    timezone,
    outputMode,
    filters: {
      group: input.group ?? null,
      team: input.team ?? null,
      city: input.city ?? null,
      stage: input.stage ?? null,
      fromDate: input.fromDate ?? null,
      toDate: input.toDate ?? null,
      includeTbd,
      sortBy
    },
    scheduleHash: currentHash,
    previousScheduleHash: previousHash ?? null,
    changedSincePreviousRun: previousHash ? previousHash !== currentHash : null,
    dataQuality: sourceWasCached ? 'cached-public-domain-community' : 'public-domain-community',
    caveat: 'MVP uses OpenFootball public-domain community JSON. Use sourceUrl and notes fields when final draw/team assignments change.'
  };

  await kv.setValue('OUTPUT', summary);
  await kv.setValue('calendar-events.json', calendar);
  await kv.setValue('daily-schedule.json', dailySchedule);
  if (emitIcsCalendar) {
    await kv.setValue('world-cup-2026-fixtures.ics', calendarToIcs(calendar), { contentType: 'text/calendar; charset=utf-8' });
  }
  if (emitChangeSummary) {
    await kv.setValue('LAST_SCHEDULE_HASH', currentHash);
  }

  let records: unknown[];
  if (outputMode === 'fixtures') records = fixtures;
  else if (outputMode === 'groups') records = groups;
  else if (outputMode === 'venues') records = venues;
  else if (outputMode === 'teams') records = teams;
  else if (outputMode === 'calendar') records = calendar;
  else if (outputMode === 'dailySchedule') records = dailySchedule;
  else records = [summary, ...fixtures, ...calendar, ...dailySchedule, ...groups, ...venues, ...teams];

  if (maxItems > 0) records = records.slice(0, maxItems);

  await Actor.pushData(records);
  log.info('World Cup 2026 dataset written', summary);
} finally {
  await Actor.exit();
}
