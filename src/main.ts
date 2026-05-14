import { Actor, log } from 'apify';
import { buildGroups, buildTeams, buildVenues, fetchOpenFootballWorldCup, normalizeOpenFootball, scheduleHash } from './worldcup.js';
import type { ActorInput } from './types.js';

await Actor.init();

try {
  const input = (await Actor.getInput<ActorInput>()) ?? {};
  const source = input.source ?? 'openfootball';
  const outputMode = input.outputMode ?? 'fixtures';
  const timezone = input.timezone ?? 'UTC';
  const includeTbd = input.includeTbd ?? true;
  const emitChangeSummary = input.emitChangeSummary ?? true;
  const maxItems = Math.max(0, input.maxItems ?? 0);

  if (source !== 'openfootball') {
    throw new Error(`Unsupported source '${source}'. Current MVP supports 'openfootball'.`);
  }

  log.info('Fetching World Cup 2026 public schedule data', { source, outputMode, timezone });
  const raw = await fetchOpenFootballWorldCup();
  let fixtures = normalizeOpenFootball(raw, timezone);

  if (!includeTbd) {
    fixtures = fixtures.filter((fixture) => !fixture.notes.some((note) => note.includes('placeholder')));
  }

  const groups = buildGroups(fixtures);
  const venues = buildVenues(fixtures);
  const teams = buildTeams(fixtures);
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
    timezone,
    scheduleHash: currentHash,
    previousScheduleHash: previousHash ?? null,
    changedSincePreviousRun: previousHash ? previousHash !== currentHash : null,
    dataQuality: 'public-domain-community',
    caveat: 'MVP uses OpenFootball public-domain community JSON. Use sourceUrl and notes fields when final draw/team assignments change.'
  };

  await kv.setValue('OUTPUT', summary);
  if (emitChangeSummary) {
    await kv.setValue('LAST_SCHEDULE_HASH', currentHash);
  }

  let records: unknown[];
  if (outputMode === 'fixtures') records = fixtures;
  else if (outputMode === 'groups') records = groups;
  else if (outputMode === 'venues') records = venues;
  else if (outputMode === 'teams') records = teams;
  else records = [summary, ...fixtures, ...groups, ...venues, ...teams];

  if (maxItems > 0) records = records.slice(0, maxItems);

  await Actor.pushData(records);
  log.info('World Cup 2026 dataset written', summary);
} finally {
  await Actor.exit();
}
