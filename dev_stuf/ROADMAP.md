# FileMaker OData MCP - Roadmap & Future Enhancements

## Version History
- **v0.1.0** - Initial release: Basic OData 4.01 implementation (stdio transport)
- **v0.1.2** - Bug fixes and stability improvements
- **v0.2.0** - HTTP/HTTPS transport, Docker deployment, CLI binary (`filemaker-odata-mcp`)
- **v0.2.6** - 19 MCP tools, enhanced connection management (saved/default connections), NPM package published as `filemaker-odata-mcp`
- **v0.3.0** - Stability & correctness release: bug fixes, security hardening, test coverage, Dify support
- **v0.3.1** - Patch release on top of 0.3.0
- **v0.4.0** - **In Progress**: FileMaker 2025 advanced OData features (aggregation, type casting, parameterization)

---

## Completed in v0.2.x

### What Was Delivered

- **HTTP/HTTPS Transport** - Standalone server mode (`MCP_TRANSPORT=http|https`) on port 3333
- **Docker Deployment** - Full Docker and Docker Compose support with health checks
- **CLI Binary** - `filemaker-odata-mcp` command, installable via `npm install -g filemaker-odata-mcp` or `npx`
- **19 MCP Tools** - Complete set covering Discovery, Queries, CRUD, Connection, and Configuration
- **Saved Connections** - `fm_odata_config_add_connection`, `fm_odata_config_remove_connection`, `fm_odata_config_get_connection`, `fm_odata_config_set_default_connection`, `fm_odata_config_list_connections`
- **Enhanced Error Handling** - Structured error formatting via `ODataParser.formatError()`
- **Debug Logging** - `DEBUG=filemaker-odata-mcp:*` support

---

## Completed in v0.3.x

### What Was Delivered

- **`fm_odata_test_connection_detailed`** - New tool surfacing the underlying error when a connection fails (replaces silent 401/network failures)
- **SIGTERM handling** - Graceful Docker shutdown via `process.on('SIGTERM')` — no more forceful container kills
- **Docker localhost warning** - Server warns at startup when `MCP_HOST=localhost` is detected inside a container
- **CORS fix** - CORS middleware now registered before routes, fixing preflight failures
- **JSON-RPC response correlation** - Concurrent HTTP requests no longer receive mismatched responses
- **Tool routing fix** - Tools dispatched by exact name set instead of fragile string-prefix matching
- **Security: password redaction** - Passwords are scrubbed from debug log output before writing
- **Config hardening** - `validateConfig()` now invoked at startup; `verifySsl` helper centralises SSL flag parsing; saved-file schema tightened
- **OData URL & parser fixes** - FileMaker-incompatible URL construction corrected; regex metacharacters in table names escaped
- **Version from package.json** - Server version read at runtime instead of being hardcoded
- **Dify / Streamable HTTP support** - JSON-RPC notifications (no `id`) return HTTP 204 immediately, preventing client stalls
- **Test coverage** - Tool-routing and config-helpers unit tests added

---

## ✅ Completed in v0.4.0

### FileMaker 2025 Advanced OData Features

FileMaker Server 2025 introduced significant enhancements to its OData 4.01 implementation.
These features were deferred from v0.3.0 to keep that release focused on stability.
All three expression-builder tools are **connection-free** — they produce query strings
locally, ready to pass into `fm_odata_query_records` or other existing tools.

#### 1. Aggregation Support ($apply)

**Status**: ✅ Done (branch: `feat/fm2025-odata-features`)
**FileMaker Version**: 2025+
**Tool**: `fm_odata_aggregate`

**Description**: Server-side aggregation via OData `$apply`. Groups records by one or
more fields and computes sum, average, min, max, countdistinct, or count — no need to
fetch all records client-side.

**Implemented**:
- `aggregate()` — sum, average, min, max, countdistinct, count ($count)
- `groupby()` — group by one or more fields
- `filter()` — pre-filter transformation before aggregation
- Combined pipeline: `filter(…)/groupby((…),aggregate(…))`
- `ODataParser.buildApplyExpression()` static helper
- `ODataClient.aggregateRecords()` method
- 9 unit tests

**Example**:
```
// Sum sales by region, active records only
fm_odata_aggregate: table=Sales, method=sum, alias=TotalSales, field=Amount,
  groupBy=["Region"], filter="Status eq 'Active'"
// → $apply=filter(Status eq 'Active')/groupby((Region),aggregate(Amount with sum as TotalSales))
```

---

#### 2. Type Casting Support

**Status**: ✅ Done (branch: `feat/fm2025-odata-features`)
**FileMaker Version**: 21.1+
**Tool**: `fm_odata_cast` (connection-free)

**Description**: Server-side type coercion via OData property path segments
(`Field/Edm.Type`). Used in `$select` or `$filter` expressions. Avoids client-side
type conversion.

**Implemented**:
- Property path casting: `Field/Edm.Type` syntax
- Supported types: `String`, `Int32`, `Int64`, `Decimal`, `Double`, `Boolean`,
  `Date`, `TimeOfDay`, `DateTimeOffset`
- `select` context: joins multiple casts with commas for `$select`
- `filter` context: returns individual cast paths to embed in `$filter`
- `ODataParser.buildCastExpression()` static helper
- 6 unit tests + 3 routing tests

**Example**:
```
// Return StartDate as a number for arithmetic
fm_odata_cast: fields=[{field:"StartDate", type:"Int64"}], context="select"
// → $select=StartDate/Edm.Int64
```

---

#### 3. Query Parameterization

**Status**: ✅ Done (branch: `feat/fm2025-odata-features`)
**FileMaker Version**: 21.1+
**Tool**: `fm_odata_build_filter` (connection-free)

**Description**: Parameterized `$filter` expressions using OData `@alias` syntax.
Improves readability and allows reuse of filter templates with different values.
FileMaker supports `@alias` in `$filter` only.

**Implemented**:
- `resolved` mode (default): substitutes alias values into the template, returns a
  plain filter string ready for `fm_odata_query_records`
- `raw` mode: returns `{ filter, params, queryString }` for manual URL construction
- Auto-quoting of string values; numbers/booleans/null passed through as-is
- Internal single-quote escaping (`O'Brien` → `O''Brien`)
- Longest-alias-first substitution to prevent partial replacements
- `@`-prefix validation on alias keys
- `ODataParser.buildParameterizedFilter()` and `formatParamValue()` helpers
- 10 unit tests + 3 routing tests

**Example**:
```
// Reusable filter template
fm_odata_build_filter: template="Title eq @title and Age gt @minAge",
  params={"@title":"Wizard of Oz","@minAge":18}
// resolved → filter: "Title eq 'Wizard of Oz' and Age gt 18"
```

---

#### 4. Lambda Operators (any / all)

**Status**: ⛔ Not implemented — **unsupported by FileMaker Server OData**
**FileMaker Version**: N/A

Lambda operators `any` and `all` are explicitly listed as unsupported in the official
Claris OData documentation (`odata-unsupported-features.html`, current as of 2026).

**Alternative**: Use `$expand` with nested `$filter` options for filtering on related
navigation properties, e.g.:
```
$expand=Orders($filter=Status eq 'Active')
```

This feature will not be implemented until Claris adds server-side support.

---

### 5. Server Version Detection

**Status**: 📋 Planned  
**Priority**: Critical (for feature gating)  
**Estimated Effort**: 1-2 days

**Description**: Automatically detect FileMaker Server version to enable/disable features based on compatibility.

**Implementation Tasks**:
- [ ] Add version detection method to `ODataClient`
- [ ] Parse version from service document or metadata
- [ ] Store version info in connection metadata
- [ ] Create feature compatibility matrix
- [ ] Add version-based feature gating
- [ ] Display version warnings for unsupported features
- [ ] Add `fm_odata_get_server_version` tool

**Version Compatibility Matrix**:
```
FileMaker Server 19+:
  ✅ Basic OData 4.01 (current implementation)
  ✅ CRUD operations
  ✅ Standard query options ($filter, $select, $orderby, etc.)

FileMaker Server 21.1+:
  ✅ All v19+ features
  ✅ Type casting (Field/Edm.Type) → fm_odata_cast
  ✅ Parameterization (@alias syntax) → fm_odata_build_filter

FileMaker Server 2023:
  ✅ All 21.1+ features
  ✅ Enhanced metadata
  ✅ Improved error messages

FileMaker Server 2025:
  ✅ All 2023 features
  ✅ Aggregation ($apply) → fm_odata_aggregate
  ❌ Lambda operators any/all — unsupported by FileMaker OData (all versions)
```

---

## 🔧 Technical Improvements

### 6. Enhanced Error Handling

**Status**: 📋 Planned  
**Priority**: High  
**Estimated Effort**: 2-3 days

**Implementation Tasks**:
- [ ] Detailed error messages with context
- [ ] Error recovery strategies
- [ ] Connection retry logic
- [ ] Better timeout handling
- [ ] User-friendly error formatting

---

### 7. Performance Optimization

**Status**: 📋 Planned  
**Priority**: Medium  
**Estimated Effort**: 3-4 days

**Implementation Tasks**:
- [ ] Query result caching
- [ ] Connection pooling
- [ ] Batch operation optimization
- [ ] Metadata caching
- [ ] Request compression

---

### 8. Enhanced Testing

**Status**: 🔄 In Progress  
**Priority**: High  
**Estimated Effort**: Ongoing

**Implementation Tasks**:
- [ ] Integration tests with live FileMaker Server
- [ ] End-to-end tests for all tools
- [ ] Performance benchmarks
- [ ] Increase coverage to 90%+
- [ ] Add test fixtures for complex scenarios

---

## 📚 Documentation Enhancements

### 9. Advanced Query Examples

**Status**: 📋 Planned  
**Priority**: Medium  
**Estimated Effort**: 2 days

**Implementation Tasks**:
- [ ] Comprehensive filter expression cookbook
- [x] Aggregation use case examples (covered in tool description and CHANGELOG)
- [ ] Complex query patterns
- [ ] Performance tuning guide
- [ ] Common pitfalls and solutions

---

### 10. Video Tutorials & Guides

**Status**: 📋 Planned  
**Priority**: Low  
**Estimated Effort**: 1 week

**Content to Create**:
- [ ] Quick start video (5 min)
- [ ] Claude Desktop setup walkthrough
- [ ] Common query patterns tutorial
- [ ] Troubleshooting guide
- [ ] Best practices webinar

---

## 🎯 Future Considerations

### Potential Features (Not Committed)

1. **REST API Wrapper**
   - Simplified REST endpoints
   - Custom query language
   - Easier for non-OData users

2. **Data Transformation Tools**
   - Built-in data mapping
   - Field transformation functions
   - Custom computed fields

3. **Real-time Updates**
   - WebSocket support for live data
   - Change notifications
   - Subscription mechanism

4. **Multi-Database Support**
   - Connect to multiple FileMaker databases
   - Cross-database queries
   - Data federation

5. **Advanced Security**
   - OAuth 2.0 support
   - Token-based authentication
   - Role-based access control

---

## 📅 Release Timeline

### v0.2.6 (Released) - Foundation
- 19 MCP tools
- HTTP/HTTPS transport
- Docker deployment
- CLI binary via NPM
- Saved/default connection management

### v0.3.0 (Released) - Stability & Correctness
- `fm_odata_test_connection_detailed` tool
- SIGTERM / graceful Docker shutdown
- CORS, JSON-RPC correlation, tool routing fixes
- Security: password redaction in debug logs
- Config hardening and startup validation
- OData URL and parser bug fixes
- Dify / Streamable HTTP support

### v0.3.1 (Released)
- Patch release on top of v0.3.0

### v0.4.0 (In Progress) - FileMaker 2025 Support
- `fm_odata_aggregate` — server-side aggregation via `$apply` (FM 2025+)
- `fm_odata_cast` — type coercion via `Field/Edm.Type` paths (FM 21.1+)
- `fm_odata_build_filter` — parameterized `$filter` via `@alias` (FM 21.1+)
- Lambda operators `any`/`all` — **not implemented** (unsupported by FileMaker OData)
- Tool count: 19 → 22

### v0.5.0 - Advanced Features
- Performance optimizations (caching, connection pooling)
- Enhanced testing (90%+ coverage)
- Comprehensive documentation

### v1.0.0 - Production Ready
- All FileMaker 2025 features complete
- 90%+ test coverage
- Complete documentation
- Performance benchmarks
- Production-grade stability

---

## 🤝 Contributing

Want to help implement these features? See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

**Priority Areas for Contributors**:
1. FileMaker 2025 feature implementation
2. Integration testing with live servers
3. Documentation and examples
4. Performance optimization

---

## 📞 Feedback

Have suggestions for the roadmap? 
- Open a [GitHub Issue](https://github.com/fsans/FMS-ODATA-MCP/issues)
- Start a [Discussion](https://github.com/fsans/FMS-ODATA-MCP/discussions)
- Submit a Pull Request

---

**Last Updated**: May 2026 (v0.4.0 features added)  
**Maintainer**: Francesc Sans <fsans@ntwk.es>
