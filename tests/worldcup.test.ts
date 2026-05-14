import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGroups, buildTeams, buildVenues, normalizeDateTime, normalizeOpenFootball, scheduleHash } from '../src/worldcup.js';
import type { RawOpenFootballWorldCup } from '../src/types.js';

test('normalizes UTC offset kickoff to UTC and viewer timezone', () => {
  const value = normalizeDateTime('2026-06-11', '13:00 UTC-6', 'Europe/Zagreb');
  assert.equal(value.isoUtc, '2026-06-11T19:00:00Z');
  assert.match(value.localTime ?? '', /^2026-06-11T21:00:00/);
  assert.equal(value.zone, 'UTC-6');
});

test('builds fixture, group, venue, team records and stable hash', () => {
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
  assert.equal(scheduleHash(fixtures).length, 64);
});
