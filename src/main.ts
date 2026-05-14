import { Actor, log } from 'apify';
import { calendarToIcs } from './ics.js';
import { buildCalendar, buildGroups, buildTeams, buildVenues, fetchOpenFootballWorldCup, filterFixtures, normalizeOpenFootball, scheduleHash } from './worldcup.js';
import type { ActorInput } from './types.js';

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

  const raw = await fetchOpenFootballWorldCup();
  let fixtures = normalizeOpenFootball(raw, timezone);

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
  const currentHash = scheduleHash(fixtures);

  const kv = await Actor.openKeyValueStore();
  const previousHash = await kv.getValue<string>('LAST_SCHEDULE_HASH');
  const summary = {
    actor: 'world-cup-2026-fixtures-schedule-api',
    source,
    sourceName: raw.name,
    fetchedAt: new Date().toISOString(),
    fixtureCount: fixtures.length,
    groupCount: groups.length,
    venueCount: venues.length,
    teamCount: teams.length,
    calendarEventCount: calendar.length,
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
    dataQuality: 'public-domain-community',
    caveat: 'MVP uses OpenFootball public-domain community JSON. Use sourceUrl and notes fields when final draw/team assignments change.'
  };

  await kv.setValue('OUTPUT', summary);
  await kv.setValue('calendar-events.json', calendar);
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
  else records = [summary, ...fixtures, ...calendar, ...groups, ...venues, ...teams];

  if (maxItems > 0) records = records.slice(0, maxItems);

  await Actor.pushData(records);
  log.info('World Cup 2026 dataset written', summary);
} finally {
  await Actor.exit();
}
