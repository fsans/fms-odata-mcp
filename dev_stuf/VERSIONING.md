# Versioning Strategy

## Version Number Format

`MAJOR.MINOR.PATCH[-BETA]`

## Versioning Rules

### Development Versions (Uneven Numbers)
- **Uneven PATCH numbers** (1, 3, 5, 7, 9...): Development and testing versions
- Suffix with `-BETA` until feature complete and tested
- Example: `0.0.1-BETA`, `0.0.3-BETA`, `0.0.5-BETA`

### Release Versions (Even Numbers)
- **Even PATCH numbers** (0, 2, 4, 6, 8...): Stable, tested, production-ready versions
- No suffix on release versions
- Example: `0.0.2`, `0.0.4`, `0.1.0`, `1.0.0`

## Version Progression

### Beta Development Phase (v0.0.x-BETA)
```
v0.0.1-BETA → Initial OData client layer
v0.0.3-BETA → Tools implementation
v0.0.5-BETA → CLI implementation
v0.0.7-BETA → Testing phase
v0.0.9-BETA → Final beta before first release
```

### First Stable Release
```
v0.1.0 → First stable release (even minor number)
```

### Subsequent Development
```
v0.1.1-BETA → Bug fixes and improvements
v0.1.3-BETA → New features
v0.1.5-BETA → Testing
v0.2.0 → Next stable release
```

## Current Version: v0.1.1 (First Stable Release)

### Completed Features
- ✅ Core infrastructure (config, transport, logger)
- ✅ OData Client Layer with HTTPS and self-signed certificate support
- ✅ Connection Manager with multi-connection support
- ✅ Response Parser
- ✅ 19 MCP Tools fully implemented
- ✅ Tool handlers integration
- ✅ Testing guide and Claude Desktop setup
- ✅ Connection tested and verified working
- ✅ Production ready

### Upcoming for v0.3.1
- CLI implementation
- Interactive setup wizard
- Configuration commands

### Previous Beta Versions
- v0.0.1-BETA → Initial OData client layer
- v0.0.3-BETA → Tools implementation

### Upcoming for v0.0.7-BETA
- Comprehensive testing
- Bug fixes

### Target for v0.1.0 (First Stable)
- All features implemented
- All tests passing
- Documentation complete
- Production ready

## Semantic Versioning Context

Once the project reaches stable status (v1.0.0):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)
- Continue using uneven numbers for development, even for releases
