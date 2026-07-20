# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2026-07-20

### Added

- AXI-compliant CLI contract: TOON as default structured stdout, JSON via `--json`
- Structured error output on stdout (exit codes: 0/1/2, stderr reserved for diagnostics)
- No-argument home view with credential readiness and configured providers
- Input validation before any dependency call (count, freshness, country, URL)
- `--full` flag to disable content truncation
- Truncation metadata with `--full` hint on truncated output
- Secret redaction in error messages (bearer tokens, API keys, auth headers)
- Typed domain errors (UsageError, MissingCredentialError, OperationalError)
- `--country` flag validation (ISO 3166-1 alpha-2)
- Provider `totalCount` support (Brave, SerpAPI-based providers)
- Root `--help` with exit code summary, output format docs, and examples
- Subcommand `--help` with 3 runnable examples each
- `SearchPage` type wrapping results + totalCount

### Changed

- Default output format changed from human-readable prose to TOON (breaking)
- Errors now structured on stdout instead of prose on stderr (breaking)
- Exit codes: 0=success, 1=operational, 2=usage (was always 1; breaking)
- No-argument invocation returns compact state instead of help (breaking)
- Errors from providers now translate to domain error codes
- `getKey` throws MissingCredentialError instead of calling `process.exit(1)`
- Empty search returns structured envelope instead of stderr message
- Search providers return `SearchPage` instead of bare `SearchResult[]`

## [2.1.0] - 2026-05-27

### Added

- Include `skills/` directory in the npm package so consumers can copy the skill file from the installed package

## [2.0.0] - 2026-05-27

### Changed

- Default search provider switched from Tavily to Brave
- Rewrite skill as a reference for the CLI (no prescribed workflows)
- Replaced `serpapi` provider and `--engine` flag with individual `google`, `scholar`, `youtube`, `amazon` providers

### Fixed

- `extract` command crashing with "document is not defined" in Node.js
- fixed `--country` flag for all providers

### Removed

- `answer` command (direct answers with citations)
- `similar` command (find related pages via Exa)
- `code` command (find code examples via Exa)

## [1.0.0] - 2026-03-04

Initial release.
