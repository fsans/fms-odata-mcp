# Changelog

All notable changes to `filemaker-odata-mcp` are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.1] - 2026-05-25

Patch release on top of 0.3.0. Version bump and npm publish housekeeping.

### Changed

- Version bumped to 0.3.1 for npm release consistency

---

## [0.3.0] - 2026-05-25

Major stability and correctness release. All changes since 0.2.8 are included here.
FileMaker 2025 advanced OData features (aggregation, type casting, parametrization,
lambda operators) were originally targeted for this release but have been deferred
to v0.4.0 to keep this release focused on reliability.

### Added

- **`fm_odata_test_connection_detailed`** — new tool that surfaces the real underlying
  error (network, SSL, auth) when a connection attempt fails, replacing opaque failures
  ([#8](https://github.com/fsans/FMS-ODATA-MCP/issues/8))
- **Docker localhost warning** — server prints a clear warning at startup when
  `MCP_HOST=localhost` is detected inside a container, guiding users to use `0.0.0.0`
  ([#10](https://github.com/fsans/FMS-ODATA-MCP/issues/10))

### Fixed

- **OData URL construction** — fixed FileMaker-incompatible URL building that caused
  query failures on certain table/filter combinations
  ([#2](https://github.com/fsans/FMS-ODATA-MCP/pull/2))
- **OData response parser** — corrected response parsing bugs introduced by the above;
  regex metacharacters in table names are now properly escaped
  ([#11](https://github.com/fsans/FMS-ODATA-MCP/issues/11))
- **Tool routing** — tools are now dispatched by exact name-set lookup instead of
  fragile string-prefix matching, preventing mis-routing of similarly named tools
  ([#2](https://github.com/fsans/FMS-ODATA-MCP/issues/2))
- **JSON-RPC response correlation** — concurrent HTTP requests no longer receive each
  other's responses; responses are matched by request `id`
  ([#3](https://github.com/fsans/FMS-ODATA-MCP/issues/3))
- **CORS middleware ordering** — CORS headers are now registered before route handlers,
  fixing preflight (`OPTIONS`) request failures
  ([#6](https://github.com/fsans/FMS-ODATA-MCP/issues/6))
- **SIGTERM / graceful shutdown** — server now handles `SIGTERM` for clean Docker
  container stops; `dumb-init` no longer required to avoid zombie processes
  ([#20](https://github.com/fsans/FMS-ODATA-MCP/issues/20))
- **Failed inline connection cleanup** — a failed `fm_odata_connect` call no longer
  leaves a broken partial connection in state; the real error is reported
  ([#14](https://github.com/fsans/FMS-ODATA-MCP/issues/14))
- **`validateConfig` at startup** — configuration is now validated when the server
  starts, not lazily on first use; misconfigured environments fail fast with a clear
  message ([#15](https://github.com/fsans/FMS-ODATA-MCP/issues/15))
- **Centralised default ports** — default HTTP (3333) and HTTPS (3443) ports now live
  in a single shared constants file, eliminating drift between transport modules
  ([#12](https://github.com/fsans/FMS-ODATA-MCP/issues/12))
- **Runtime version** — server version is now read from `package.json` at runtime
  instead of being hardcoded, so it always matches the published package
  ([#9](https://github.com/fsans/FMS-ODATA-MCP/issues/9))

### Security

- **Password redaction in debug logs** — passwords are scrubbed from tool argument
  objects before they are written to debug output, preventing credential exposure in
  log files ([#22](https://github.com/fsans/FMS-ODATA-MCP/issues/22))

### Refactored

- **Config saved-file schema** — tightened validation schema for
  `~/.fms-odata-mcp/config.json`; added field trimming and a dedicated `verifySsl`
  helper to centralise SSL flag coercion
  ([#16](https://github.com/fsans/FMS-ODATA-MCP/issues/16),
  [#17](https://github.com/fsans/FMS-ODATA-MCP/issues/17),
  [#18](https://github.com/fsans/FMS-ODATA-MCP/issues/18))

### Tests

- Added unit tests for tool routing and config helpers; tightened mock typings
- Removed unused MCP schema imports from `tools/odata.ts`
- Removed unused `Express` import from `simple-http-transport.ts`

---

## [0.2.8] - 2026-03-26

### Changed

- Version bump to 0.2.8; documentation updates

---

## [0.2.7] - 2026-03-24

### Changed

- Documentation updates

---

## [0.2.6] - 2026-03-19

### Added

- Multi-platform Docker support (ARM64 / Apple M-series)

---

## [0.2.x] - 2026-03-19

Early patch releases (0.2.2 – 0.2.5) addressing Docker image naming, case sensitivity,
and initial ARM64 build pipeline issues.

---

## [0.2.0] - 2026-03-xx

### Added

- HTTP and HTTPS transport modes (`MCP_TRANSPORT=http|https`)
- Docker deployment with Docker Compose and health checks
- `filemaker-odata-mcp` CLI binary (installable via `npm install -g` or `npx`)

---

## [0.1.x] - 2026-xx-xx

### Added

- Initial release with 19 MCP tools over stdio transport
- OData 4.01 CRUD operations against FileMaker Server
- Saved and default connection management (`~/.fms-odata-mcp/config.json`)
- SSL support with optional certificate verification bypass
- `DEBUG=filemaker-odata-mcp:*` logging support
