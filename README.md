# World Cup 2026 Fixtures & Schedule API Actor

Apify Actor for normalized FIFA World Cup 2026 schedule data: fixtures, groups, teams, venues, calendar-event rows, timezone conversion, filters, and schedule-change hashes.

## What it does

- Fetches public-domain World Cup 2026 JSON from [`openfootball/worldcup.json`](https://github.com/openfootball/worldcup.json).
- Normalizes each fixture into API-friendly records.
- Adds UTC kickoff (`isoUtc`) and viewer-local kickoff (`localTime`) using an IANA timezone input.
- Filters by group, team, city, stage, and date range.
- Emits derived datasets for groups, venues, teams, calendar events, and daily schedules.
- Writes `calendar-events.json`, `daily-schedule.json`, and importable `world-cup-2026-fixtures.ics` to key-value store.
- Caches the last successful OpenFootball source payload and falls back to it if a scheduled run hits a transient source/network failure.
- Stores a schedule hash in key-value store so scheduled runs can detect changes.
- Writes clean rows to the default Apify dataset for export as JSON, CSV, Excel, RSS, or API.

## Why this exists

Developers building apps, widgets, dashboards, newsletters, fantasy tools, sports-media workflows, betting/research notebooks, and calendar integrations need a simple export-first source for the 2026 World Cup schedule. Big sports APIs are overkill for schedule-only use cases; this Actor is the lightweight plug-in version.

## High-value use cases

- “Show me all Mexico / USA / Canada fixtures in my timezone.”
- “Export Group A matches to CSV.”
- “Generate calendar-event rows for every match.”
- “Monitor schedule changes once FIFA updates fixtures/team assignments.”
- “Power a static website or app with a clean World Cup fixture API.”

## Input

```json
{
  "source": "openfootball",
  "outputMode": "fixtures",
  "timezone": "Europe/Zagreb",
  "team": "Mexico",
  "city": "Mexico City",
  "fromDate": "2026-06-01",
  "toDate": "2026-07-31",
  "sortBy": "date",
  "includeTbd": true,
  "emitChangeSummary": true,
  "maxItems": 0
}
```

### Fields

- `source`: currently `openfootball`.
- `outputMode`: `fixtures`, `groups`, `venues`, `teams`, `calendar`, `dailySchedule`, or `all`.
- `timezone`: IANA timezone used for `localTime`, e.g. `UTC`, `Europe/Zagreb`, `America/New_York`.
- `group`: optional exact group filter, e.g. `Group A`.
- `team`: optional partial team filter, e.g. `Mexico`, `USA`, `Winner Group A`.
- `city`: optional partial host city filter, e.g. `Toronto`, `Atlanta`, `Mexico City`.
- `stage`: optional partial stage filter, e.g. `Matchday 1`, `Round of 32`, `Final`.
- `fromDate` / `toDate`: optional inclusive `YYYY-MM-DD` date range.
- `sortBy`: `matchNumber` or `date`.
- `includeTbd`: keep TBD/placeholders. Useful before final assignments are official.
- `emitIcsCalendar`: write an importable `.ics` calendar file to key-value store.
- `emitChangeSummary`: save `LAST_SCHEDULE_HASH` and `OUTPUT` in key-value store.
- `maxItems`: optional row cap for test runs. `0` means unlimited.

## Output example: fixture

```json
{
  "recordType": "fixture",
  "matchNumber": 1,
  "stage": "Matchday 1",
  "group": "Group A",
  "date": "2026-06-11",
  "time": "13:00",
  "timezone": "UTC-6",
  "isoUtc": "2026-06-11T19:00:00Z",
  "localTime": "2026-06-11T21:00:00+02:00",
  "teamA": "Mexico",
  "teamB": "South Africa",
  "city": "Mexico City",
  "stadium": null,
  "source": "openfootball/worldcup.json",
  "sourceUrl": "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json",
  "dataQuality": "public-domain-community",
  "notes": []
}
```

## Output example: calendar

```json
{
  "recordType": "calendar",
  "uid": "world-cup-2026-match-1@panthera.ai",
  "title": "Mexico vs South Africa",
  "description": "Matchday 1 | Group A | Match 1",
  "startsAtUtc": "2026-06-11T19:00:00Z",
  "startsAtLocal": "2026-06-11T21:00:00+02:00",
  "location": "Mexico City",
  "sourceUrl": "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json"
}
```

## Output example: daily schedule

```json
{
  "recordType": "dailySchedule",
  "date": "2026-06-11",
  "localDate": "2026-06-11",
  "matchCount": 1,
  "matches": [
    {
      "matchNumber": 1,
      "kickoffUtc": "2026-06-11T19:00:00Z",
      "kickoffLocal": "2026-06-11T21:00:00+02:00",
      "title": "Mexico vs South Africa",
      "group": "Group A",
      "stage": "Matchday 1",
      "city": "Mexico City"
    }
  ]
}
```

## Key-value store OUTPUT

Each run stores a compact summary in `OUTPUT`:

```json
{
  "actor": "world-cup-2026-fixtures-schedule-api",
  "fixtureCount": 104,
  "groupCount": 12,
  "venueCount": 16,
  "teamCount": 112,
  "calendarEventCount": 104,
  "dailyScheduleDayCount": 104,
  "icsCalendarKey": "world-cup-2026-fixtures.ics",
  "scheduleHash": "...",
  "previousScheduleHash": "...",
  "changedSincePreviousRun": false
}
```

## Data caveat

The MVP source is OpenFootball public-domain community JSON. That is perfect for a no-login Apify MVP, but fixture/team assignments can change as FIFA updates the tournament draw and qualification. The Actor keeps `sourceUrl`, `dataQuality`, and `notes` fields explicit so downstream users can validate provenance.

## Pricing suggestion

Start as pay-per-result:

- `$1.00 / 1,000 dataset rows` for fixtures/groups/venues/teams/calendar rows.
- Later add a higher-value scheduled monitor mode: `$0.25-$0.50/run` for change detection alerts.

## Local development

```bash
npm install
npm run build
npm test
APIFY_LOCAL_STORAGE_DIR=./storage npm start
```

Local input file:

```bash
mkdir -p storage/key_value_stores/default
cat > storage/key_value_stores/default/INPUT.json <<'JSON'
{
  "source": "openfootball",
  "outputMode": "fixtures",
  "timezone": "Europe/Zagreb",
  "team": "Mexico",
  "sortBy": "date",
  "includeTbd": true,
  "emitChangeSummary": true,
  "maxItems": 5
}
JSON
npm start
```
