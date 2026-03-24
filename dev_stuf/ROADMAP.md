# FileMaker OData MCP - Roadmap & Future Enhancements

## Version History
- **v0.1.0** - Initial release: Basic OData 4.01 implementation (stdio transport)
- **v0.1.2** - Bug fixes and stability improvements
- **v0.2.0** - HTTP/HTTPS transport, Docker deployment, CLI binary (`filemaker-odata-mcp`)
- **v0.2.6** - **Current**: 19 MCP tools, enhanced connection management (saved/default connections), NPM package published as `filemaker-odata-mcp`
- **Target**: v0.3.0 (FileMaker 2025 advanced OData features)

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

## 🚀 Upcoming Features (v0.3.0+)

### FileMaker 2025 Advanced OData Features

FileMaker Server 2025 introduced significant enhancements to its OData 4.01 implementation. These features will be added in future versions with automatic server version detection.

#### 1. Aggregation Support ($apply)

**Status**: 📋 Planned  
**FileMaker Version**: 2025+  
**Priority**: High  
**Estimated Effort**: 3-5 days

**Description**: Implement OData `$apply` query option for data aggregation and grouping.

**Features to Implement**:
- `aggregate()` - Sum, average, min, max, count operations
- `groupby()` - Group records by one or more fields
- `filter()` - Apply filters within aggregation
- Combined operations (e.g., group + aggregate + filter)

**Example Use Cases**:
```javascript
// Sum sales by region
$apply=groupby((Region), aggregate(Sales with sum as TotalSales))

// Average age by department
$apply=groupby((Department), aggregate(Age with average as AvgAge))

// Count records by category
$apply=groupby((Category), aggregate($count as Total))

// Complex: Filter, group, and aggregate
$apply=filter(Status eq 'Active')/groupby((Region), aggregate(Revenue with sum as Total))
```

**Implementation Tasks**:
- [ ] Add `$apply` parameter to `ODataQueryOptions`
- [ ] Implement aggregation query builder
- [ ] Add aggregation response parser
- [ ] Create dedicated `fm_odata_aggregate` tool
- [ ] Add unit tests for aggregation scenarios
- [ ] Document aggregation syntax and examples

---

#### 2. Type Casting Support

**Status**: 📋 Planned  
**FileMaker Version**: 2025+  
**Priority**: Medium  
**Estimated Effort**: 2-3 days

**Description**: Support OData `cast()` function for type conversions in queries.

**Features to Implement**:
- Cast between EDM types (String, Int32, Decimal, DateTime, etc.)
- Type coercion in filter expressions
- Validation of cast operations

**Example Use Cases**:
```javascript
// Cast number to string for comparison
$filter=cast(Age, 'Edm.String') eq '25'

// Cast string to number for arithmetic
$filter=cast(StringField, 'Edm.Int32') gt 100

// Cast date for comparison
$filter=cast(DateField, 'Edm.DateTimeOffset') ge 2024-01-01T00:00:00Z
```

**Implementation Tasks**:
- [ ] Add cast() function parser
- [ ] Implement type conversion logic
- [ ] Add EDM type definitions
- [ ] Validate cast operations
- [ ] Add unit tests for casting
- [ ] Document casting syntax and supported types

---

#### 3. Query Parametrization

**Status**: 📋 Planned  
**FileMaker Version**: 2025+  
**Priority**: Medium  
**Estimated Effort**: 2-3 days

**Description**: Support parameterized queries using `@parameter` syntax for reusable queries.

**Features to Implement**:
- Parameter definition syntax
- Parameter substitution in queries
- Type-safe parameter handling
- Multiple parameter support

**Example Use Cases**:
```javascript
// Simple parameter
?$filter=FirstName eq @name&@name='John'

// Multiple parameters
?$filter=Age gt @minAge and Age lt @maxAge&@minAge=18&@maxAge=65

// Date parameters
?$filter=CreatedDate ge @startDate&@startDate=2024-01-01T00:00:00Z

// Reusable query patterns
?$filter=Status eq @status and Region eq @region&@status='Active'&@region='Europe'
```

**Implementation Tasks**:
- [ ] Add parameter parsing to URL builder
- [ ] Implement parameter substitution
- [ ] Add parameter validation
- [ ] Support parameter types (string, number, date, boolean)
- [ ] Add unit tests for parametrization
- [ ] Document parameter syntax and examples

---

#### 4. Nested Queries (Lambda Operators)

**Status**: 📋 Planned  
**FileMaker Version**: 2025+  
**Priority**: Medium-High  
**Estimated Effort**: 4-6 days

**Description**: Support lambda operators for querying related records and collections.

**Features to Implement**:
- `any()` - Check if any item matches condition
- `all()` - Check if all items match condition
- Nested property access
- Multi-level navigation

**Example Use Cases**:
```javascript
// Any: Orders with any item over $100
$filter=OrderDetails/any(d: d/Price gt 100)

// All: Orders where all items are shipped
$filter=OrderDetails/all(d: d/Status eq 'Shipped')

// Nested: Customers with orders containing specific products
$filter=Orders/any(o: o/OrderDetails/any(d: d/ProductName eq 'Widget'))

// Combined: Active customers with recent high-value orders
$filter=Status eq 'Active' and Orders/any(o: o/Date ge 2024-01-01 and o/Total gt 1000)
```

**Implementation Tasks**:
- [ ] Implement lambda expression parser
- [ ] Add `any()` operator support
- [ ] Add `all()` operator support
- [ ] Support nested navigation paths
- [ ] Handle complex nested conditions
- [ ] Add unit tests for lambda operators
- [ ] Document nested query syntax

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

FileMaker Server 2023:
  ✅ All v19+ features
  ✅ Enhanced metadata
  ✅ Improved error messages

FileMaker Server 2025:
  ✅ All 2023 features
  ✅ Aggregation ($apply)
  ✅ Type casting (cast())
  ✅ Parametrization (@parameter)
  ✅ Nested queries (any/all)
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
- [ ] Aggregation use case examples
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

### v0.3.0 (Q2 2026) - FileMaker 2025 Support
- Server version detection
- Aggregation ($apply)
- Type casting
- Query parametrization
- Nested queries (lambda operators)

### v0.4.0 (Q3 2026) - Advanced Features
- Performance optimizations (caching, connection pooling)
- Enhanced testing (90%+ coverage)
- Comprehensive documentation

### v1.0.0 (Q4 2026) - Production Ready
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

**Last Updated**: March 2025  
**Maintainer**: Francesc Sans <fsans@ntwk.es>
