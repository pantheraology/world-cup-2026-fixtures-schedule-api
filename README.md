# World Cup 2026 Fixtures & Schedule API Actor

Apify Actor for normalized FIFA World Cup 2026 schedule data: fixtures, groups, teams, venues, timezone conversion, and schedule-change hashes.

## What it does

- Fetches public-domain World Cup 2026 JSON from [`openfootball/worldcup.json`](https://github.com/openfootball/worldcup.json).
- Normalizes each fixture into API-friendly records.
- Adds UTC kickoff (`isoUtc`) and viewer-local kickoff (`localTime`) using an IANA timezone input.
- Emits derived datasets for groups, venues, and teams.
- Stores a schedule hash in key-value store so scheduled runs can detect changes.
- Writes clean rows to the default Apify dataset for export as JSON, CSV, Excel, RSS, or API.

## Why this exists

Developers building apps, widgets, dashboards, newsletters, fantasy tools, sports-media workflows, and research notebooks need a simple export-first source for the 2026 World Cup schedule. Big sports APIs are overkill for schedule-only use cases; this Actor is the lightweight plug-in version.

## Input

```json
{
  "source": "openfootball",
  "outputMode": "fixtures",
  "timezone": "Europe/Zagreb",
  "includeTbd": true,
  "emitChangeSummary": true,
  "maxItems": 0
}
```

### Fields

- `source`: currently `openfootball`.
- `outputMode`: `fixtures`, `groups`, `venues`, `teams`, or `all`.
- `timezone`: IANA timezone used for `localTime`, e.g. `UTC`, `Europe/Zagreb`, `America/New_York`.
- `includeTbd`: keep TBD/placeholders. Useful before final assignments are official.
- `emitChangeSummary`: save `LAST_SCHEDULE_HASH` and `OUTPUT` in key-value store.
- `maxItems`: optional row cap for test runs. `0` means unlimited.

## Output example

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

## Key-value store OUTPUT

Each run stores a compact summary in `OUTPUT`:

```json
{
  "actor": "world-cup-2026-fixtures-schedule-api",
  "fixtureCount": 104,
  "groupCount": 12,
  "venueCount": 16,
  "teamCount": 48,
  "scheduleHash": "...",
  "previousScheduleHash": "...",
  "changedSincePreviousRun": false
}
```

## Data caveat

The MVP source is OpenFootball public-domain community JSON. That is perfect for a no-login Apify MVP, but fixture/team assignments can change as FIFA updates the tournament draw and qualification. The Actor keeps `sourceUrl`, `dataQuality`, and `notes` fields explicit so downstream users can validate provenance.

## Pricing suggestion

Start as pay-per-result:

- `$1.00 / 1,000 dataset rows` for fixtures/groups/venues/teams.
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
  "includeTbd": true,
  "emitChangeSummary": true,
  "maxItems": 5
}
JSON
npm start
```
