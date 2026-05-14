export type ActorInput = {
  source?: 'openfootball';
  outputMode?: 'fixtures' | 'groups' | 'venues' | 'teams' | 'calendar' | 'all';
  timezone?: string;
  includeTbd?: boolean;
  emitChangeSummary?: boolean;
  maxItems?: number;
  group?: string;
  team?: string;
  city?: string;
  stage?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: 'matchNumber' | 'date';
};

export type RawOpenFootballMatch = {
  round?: string;
  date?: string;
  time?: string;
  team1?: string;
  team2?: string;
  group?: string;
  ground?: string;
  score?: { ft?: [number, number] };
};

export type RawOpenFootballWorldCup = {
  name: string;
  matches: RawOpenFootballMatch[];
};

export type FixtureRecord = {
  recordType: 'fixture';
  matchNumber: number;
  stage: string;
  group: string | null;
  date: string;
  time: string | null;
  timezone: string | null;
  isoUtc: string | null;
  localTime: string | null;
  teamA: string;
  teamB: string;
  city: string | null;
  stadium: string | null;
  source: string;
  sourceUrl: string;
  dataQuality: 'official' | 'public-domain-community';
  notes: string[];
};

export type CalendarRecord = {
  recordType: 'calendar';
  uid: string;
  title: string;
  description: string;
  startsAtUtc: string | null;
  startsAtLocal: string | null;
  location: string | null;
  sourceUrl: string;
};

export type GroupRecord = {
  recordType: 'group';
  group: string;
  teams: string[];
  fixtureCount: number;
};

export type VenueRecord = {
  recordType: 'venue';
  city: string;
  stadium: string | null;
  fixtureCount: number;
};

export type TeamRecord = {
  recordType: 'team';
  team: string;
  group: string | null;
  fixtureCount: number;
};
