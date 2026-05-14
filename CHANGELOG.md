# Changelog

All notable changes to this project will be documented in this file.

The format follows Keep a Changelog and the project uses Semantic Versioning.

## [1.1.0] - 2026-05-14

### Added

- real ESLint and Prettier tooling
- browser-level Playwright regression tests
- optional storage mode scaffolding with SQLite support kept disabled by default
- a development-only debug panel for active rooms and reconnect state
- a mobile observer mode for following a room on smaller screens
- deployment examples for Docker, Railway, Render, Fly.io, and self-hosted VPS setups

### Changed

- surfaced the app version in the interface
- expanded project checks to include linting, formatting, multiplayer tests, and browser E2E coverage
- documented release and deployment workflows

## [1.0.0] - 2026-05-14

### Added

- hardened multiplayer runtime with host permissions, reconnect handling, health checks, and privacy-focused defaults
