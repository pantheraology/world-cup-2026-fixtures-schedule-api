import { createHash } from 'node:crypto';
import { DateTime, FixedOffsetZone } from 'luxon';
import type { CalendarRecord, FixtureRecord, GroupRecord, RawOpenFootballMatch, RawOpenFootballWorldCup, TeamRecord, VenueRecord } from './types.js';

export const OPENFOOTBALL_2026_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

const TBD_PATTERNS = [/^tbd$/i, /^to be decided$/i, /^winner /i, /^runner-up /i, /^third place /i, /^group [a-z] (winner|runner-up|third)/i];

export function isTbdTeam(team: string): boolean {
  return TBD_PATTERNS.some((pattern) => pattern.test(team.trim()));
}

export async function fetchOpenFootballWorldCup(url = OPENFOOTBALL_2026_URL): Promise<RawOpenFootballWorldCup> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Apify World Cup 2026 Fixtures Actor (+https://apify.com/)'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch OpenFootball data: HTTP ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as RawOpenFootballWorldCup;
  if (!data || !Array.isArray(data.matches)) {
    throw new Error('OpenFootball response did not contain a matches array');
  }
  return data;
}

export function normalizeOpenFootball(data: RawOpenFootballWorldCup, viewerTimezone: string): FixtureRecord[] {
  return data.matches.map((match, index) => normalizeMatch(match, index + 1, viewerTimezone));
}

function normalizeMatch(match: RawOpenFootballMatch, matchNumber: number, viewerTimezone: string): FixtureRecord {
  const { clock, zone, isoUtc, localTime, notes: timeNotes } = normalizeDateTime(match.date, match.time, viewerTimezone);
  const city = match.ground?.trim() || null;
  const teamA = normalizeTeam(match.team1);
  const teamB = normalizeTeam(match.team2);
  const notes = [...timeNotes];

  if (isTbdTeam(teamA) || isTbdTeam(teamB)) {
    notes.push('Team assignment is not final / placeholder at source.');
  }

  return {
    recordType: 'fixture',
    matchNumber,
    stage: match.round?.trim() || 'Unknown stage',
    group: match.group?.trim() || null,
    date: match.date || '',
    time: clock,
    timezone: zone,
    isoUtc,
    localTime,
    teamA,
    teamB,
    city,
    stadium: null,
    source: 'openfootball/worldcup.json',
    sourceUrl: OPENFOOTBALL_2026_URL,
    dataQuality: 'public-domain-community',
    notes
  };
}

function normalizeTeam(team: string | undefined): string {
  const value = team?.trim();
  return value && value.length > 0 ? value : 'TBD';
}

export function normalizeDateTime(date: string | undefined, time: string | undefined, viewerTimezone: string): {
  clock: string | null;
  zone: string | null;
  isoUtc: string | null;
  localTime: string | null;
  notes: string[];
} {
  const notes: string[] = [];
  if (!date) {
    return { clock: null, zone: null, isoUtc: null, localTime: null, notes: ['Missing date at source.'] };
  }

  if (!time) {
    return { clock: null, zone: null, isoUtc: null, localTime: null, notes: ['Missing kickoff time at source.'] };
  }

  const match = time.trim().match(/^(\d{1,2}:\d{2})\s+UTC([+-]\d{1,2})(?::?(\d{2}))?$/i);
  if (!match) {
    return { clock: time.trim(), zone: null, isoUtc: null, localTime: null, notes: [`Unsupported time format: ${time}`] };
  }

  const [, clock, hourText, minuteText] = match;
  const offsetHours = Number(hourText);
  const offsetMinutes = offsetHours * 60 + (offsetHours < 0 ? -Number(minuteText ?? 0) : Number(minuteText ?? 0));
  const sourceZone = FixedOffsetZone.instance(offsetMinutes);
  const sourceDateTime = DateTime.fromISO(`${date}T${clock}:00`, { zone: sourceZone });

  if (!sourceDateTime.isValid) {
    return { clock, zone: `UTC${hourText}`, isoUtc: null, localTime: null, notes: [`Invalid source datetime: ${sourceDateTime.invalidExplanation ?? 'unknown reason'}`] };
  }

  const utc = sourceDateTime.toUTC();
  const local = utc.setZone(viewerTimezone);
  if (!local.isValid) {
    notes.push(`Invalid viewer timezone '${viewerTimezone}', localTime falls back to UTC.`);
  }

  return {
    clock,
    zone: `UTC${hourText}${minuteText ? `:${minuteText}` : ''}`,
    isoUtc: utc.toISO({ suppressMilliseconds: true }),
    localTime: (local.isValid ? local : utc).toISO({ suppressMilliseconds: true }),
    notes
  };
}

export function buildGroups(fixtures: FixtureRecord[]): GroupRecord[] {
  const groups = new Map<string, Set<string>>();
  const counts = new Map<string, number>();

  for (const fixture of fixtures) {
    if (!fixture.group) continue;
    if (!groups.has(fixture.group)) groups.set(fixture.group, new Set());
    groups.get(fixture.group)!.add(fixture.teamA);
    groups.get(fixture.group)!.add(fixture.teamB);
    counts.set(fixture.group, (counts.get(fixture.group) ?? 0) + 1);
  }

  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([group, teams]) => ({
    recordType: 'group',
    group,
    teams: [...teams].sort(),
    fixtureCount: counts.get(group) ?? 0
  }));
}

export function buildVenues(fixtures: FixtureRecord[]): VenueRecord[] {
  const counts = new Map<string, number>();
  for (const fixture of fixtures) {
    if (!fixture.city) continue;
    counts.set(fixture.city, (counts.get(fixture.city) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([city, fixtureCount]) => ({
    recordType: 'venue',
    city,
    stadium: null,
    fixtureCount
  }));
}

export function buildTeams(fixtures: FixtureRecord[]): TeamRecord[] {
  const teams = new Map<string, { group: string | null; fixtureCount: number }>();
  for (const fixture of fixtures) {
    for (const team of [fixture.teamA, fixture.teamB]) {
      const existing = teams.get(team);
      teams.set(team, {
        group: existing?.group ?? fixture.group,
        fixtureCount: (existing?.fixtureCount ?? 0) + 1
      });
    }
  }
  return [...teams.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([team, value]) => ({
    recordType: 'team',
    team,
    group: value.group,
    fixtureCount: value.fixtureCount
  }));
}

export function buildCalendar(fixtures: FixtureRecord[]): CalendarRecord[] {
  return fixtures.map((fixture) => ({
    recordType: 'calendar',
    uid: `world-cup-2026-match-${fixture.matchNumber}@panthera.ai`,
    title: `${fixture.teamA} vs ${fixture.teamB}`,
    description: [fixture.stage, fixture.group, `Match ${fixture.matchNumber}`].filter(Boolean).join(' | '),
    startsAtUtc: fixture.isoUtc,
    startsAtLocal: fixture.localTime,
    location: fixture.city,
    sourceUrl: fixture.sourceUrl
  }));
}

export function filterFixtures(fixtures: FixtureRecord[], filters: {
  group?: string;
  team?: string;
  city?: string;
  stage?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: 'matchNumber' | 'date';
}): FixtureRecord[] {
  const needle = (value?: string) => value?.trim().toLowerCase();
  const group = needle(filters.group);
  const team = needle(filters.team);
  const city = needle(filters.city);
  const stage = needle(filters.stage);

  const filtered = fixtures.filter((fixture) => {
    if (group && fixture.group?.toLowerCase() !== group) return false;
    if (team && ![fixture.teamA, fixture.teamB].some((candidate) => candidate.toLowerCase().includes(team))) return false;
    if (city && !fixture.city?.toLowerCase().includes(city)) return false;
    if (stage && !fixture.stage.toLowerCase().includes(stage)) return false;
    if (filters.fromDate && fixture.date < filters.fromDate) return false;
    if (filters.toDate && fixture.date > filters.toDate) return false;
    return true;
  });

  if (filters.sortBy === 'date') {
    filtered.sort((a, b) => (a.isoUtc ?? a.date).localeCompare(b.isoUtc ?? b.date) || a.matchNumber - b.matchNumber);
  } else {
    filtered.sort((a, b) => a.matchNumber - b.matchNumber);
  }

  return filtered;
}

export function scheduleHash(fixtures: FixtureRecord[]): string {
  const canonical = fixtures.map((fixture) => ({
    n: fixture.matchNumber,
    stage: fixture.stage,
    group: fixture.group,
    isoUtc: fixture.isoUtc,
    a: fixture.teamA,
    b: fixture.teamB,
    city: fixture.city
  }));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
