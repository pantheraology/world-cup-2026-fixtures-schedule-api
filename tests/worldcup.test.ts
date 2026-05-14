import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarToIcs } from '../src/ics.js';
import { buildCalendar, buildDailySchedule, buildGroups, buildTeams, buildVenues, filterFixtures, markFixturesAsCached, normalizeDateTime, normalizeOpenFootball, scheduleHash } from '../src/worldcup.js';
import type { RawOpenFootballWorldCup } from '../src/types.js';

test('normalizes UTC offset kickoff to UTC and viewer timezone', () => {
  const value = normalizeDateTime('2026-06-11', '13:00 UTC-6', 'Europe/Zagreb');
  assert.equal(value.isoUtc, '2026-06-11T19:00:00Z');
  assert.match(value.localTime ?? '', /^2026-06-11T21:00:00/);
  assert.equal(value.zone, 'UTC-6');
});

test('builds fixture, group, venue, team, calendar records and stable hash', () => {
  const raw: RawOpenFootballWorldCup = {
    name: 'World Cup 2026',
    matches: [
      { round: 'Matchday 1', date: '2026-06-11', time: '13:00 UTC-6', team1: 'Mexico', team2: 'TBD', group: 'Group A', ground: 'Mexico City' },
      { round: 'Matchday 1', date: '2026-06-12', time: '20:00 UTC-5', team1: 'Canada', team2: 'Belgium', group: 'Group B', ground: 'Toronto' }
    ]
  };

  const fixtures = normalizeOpenFootball(raw, 'UTC');
  assert.equal(fixtures.length, 2);
  assert.equal(fixtures[0].teamA, 'Mexico');
  assert.equal(fixtures[0].notes.includes('Team assignment is not final / placeholder at source.'), true);
  assert.equal(buildGroups(fixtures).length, 2);
  assert.equal(buildVenues(fixtures).length, 2);
  assert.equal(buildTeams(fixtures).some((team) => team.team === 'Belgium'), true);
  assert.equal(buildCalendar(fixtures)[0].uid, 'world-cup-2026-match-1@panthera.ai');
  assert.equal(buildDailySchedule(fixtures)[0].recordType, 'dailySchedule');
  assert.equal(buildDailySchedule(fixtures)[0].matchCount, 1);
  assert.equal(markFixturesAsCached(fixtures, 'network down')[0].dataQuality, 'cached-public-domain-community');
  assert.match(markFixturesAsCached(fixtures, 'network down')[0].notes.at(-1) ?? '', /network down/);
  assert.equal(filterFixtures(fixtures, { team: 'mex', city: 'mexico', sortBy: 'date' }).length, 1);
  assert.equal(filterFixtures(fixtures, { group: 'Group B' })[0].teamA, 'Canada');
  assert.equal(scheduleHash(fixtures).length, 64);
});

test('renders valid enough iCalendar content', () => {
  const calendar = [{
    recordType: 'calendar' as const,
    uid: 'world-cup-2026-match-1@panthera.ai',
    title: 'Mexico vs South Africa',
    description: 'Matchday 1 | Group A | Match 1',
    startsAtUtc: '2026-06-11T19:00:00Z',
    startsAtLocal: '2026-06-11T21:00:00+02:00',
    location: 'Mexico City',
    sourceUrl: 'https://example.com/source'
  }];
  const ics = calendarToIcs(calendar, new Date('2026-01-01T00:00:00Z'));
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /BEGIN:VEVENT/);
  assert.match(ics, /DTSTART:20260611T190000Z/);
  assert.match(ics, /SUMMARY:Mexico vs South Africa/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
});
