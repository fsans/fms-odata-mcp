# FileMaker Server OData MCP Server - Project Structure

## Directory Structure

```
FMS-ODATA-MCP/
├── src/
│   ├── index.ts                      # Main entry point, server initialization
│   ├── server.ts                     # FileMakerODataServer class
│   ├── config/
│   │   ├── config.ts                 # Configuration management
│   │   └── constants.ts              # Constants and enums
│   ├── connection/
│   │   ├── ConnectionManager.ts      # Connection pool and lifecycle
│   │   ├── AuthManager.ts            # Authentication handling
│   │   └── RetryHandler.ts           # Retry logic for failed requests
│   ├── odata/
│   │   ├── ODataClient.ts            # Main OData client
│   │   ├── ODataQueryBuilder.ts      # URL construction
│   │   ├── ODataResponseParser.ts    # Response parsing
│   │   └── ODataErrorHandler.ts      # Error handling
│   ├── handlers/
│   │   ├── tools/
│   │   │   ├── listDatabases.ts      # List databases tool
│   │   │   ├── getMetadata.ts        # Get metadata tool
│   │   │   ├── queryRecords.ts       # Query records tool
│   │   │   ├── getRecord.ts          # Get record tool
│   │   │   ├── createRecord.ts       # Create record tool
│   │   │   ├── updateRecord.ts       # Update record tool
│   │   │   ├── deleteRecord.ts       # Delete record tool
│   │   │   └── executeBatch.ts       # Batch operations tool
│   │   └── resources/
│   │       ├── serviceDocument.ts    # Service document resource
│   │       ├── metadata.ts           # Metadata resource
│   │       └── tableData.ts          # Table data resource
│   ├── types/
│   │   ├── odata.ts                  # OData-specific types
│   │   ├── filemaker.ts              # FileMaker-specific types
│   │   └── mcp.ts                    # MCP-specific types
│   └── utils/
│       ├── logger.ts                 # Logging utility
│       ├── validation.ts             # Input validation
│       └── cache.ts                  # Caching utility
├── tests/
│   ├── unit/
│   │   ├── odata/
│   │   │   ├── ODataClient.test.ts
│   │   │   ├── ODataQueryBuilder.test.ts
│   │   │   └── ODataResponseParser.test.ts
│   │   ├── handlers/
│   │   │   ├── tools/
│   │   │   │   └── queryRecords.test.ts
│   │   │   └── resources/
│   │   │       └── metadata.test.ts
│   │   └── utils/
│   │       └── validation.test.ts
│   ├── integration/
│   │   ├── connection.test.ts
│   │   ├── tools.test.ts
│   │   └── resources.test.ts
│   └── fixtures/
│       ├── mock-responses.json       # Mock FileMaker responses
│       └── test-data.json            # Test data
├── docs/
│   ├── API.md                        # API documentation
│   ├── EXAMPLES.md                   # Usage examples
│   └── TROUBLESHOOTING.md            # Common issues and solutions
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── package.json
├── tsconfig.json
├── README.md                         # Project overview
├── ARCHITECTURE.md                   # Architecture documentation
├── PROJECT_STRUCTURE.md              # This file
└── CHANGELOG.md                      # Version history

```

## File Descriptions

### Core Files

#### `src/index.ts`
Main entry point that:
- Initializes the MCP server
- Sets up transport (stdio)
- Handles process lifecycle
- Error handling and shutdown

```typescript
#!/usr/bin/env node
import { FileMakerODataServer } from './server.js';

const server = new FileMakerODataServer();
server.run().catch(console.error);
```

#### `src/server.ts`
Main server class that:
- Extends MCP SDK Server
- Registers tool handlers
- Registers resource handlers
- Manages server lifecycle

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export class FileMakerODataServer {
  private server: Server;
  private connectionManager: ConnectionManager;
  private odataClient: ODataClient;
  
  constructor() {
    // Initialize server with capabilities
    // Set up handlers
  }
  
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
```

### Configuration

#### `src/config/config.ts`
Configuration management:
- Read environment variables
- Validate configuration
- Provide defaults
- Export config object

```typescript
export interface ServerConfig {
  filemakerServerUrl: string;
  username: string;
  password: string;
  defaultDatabase?: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  cacheMetadataSeconds: number;
}

export function loadConfig(): ServerConfig {
  // Load and validate configuration
}
```

#### `src/config/constants.ts`
Application constants:
- OData version
- Default timeouts
- Error codes
- HTTP status codes

```typescript
export const ODATA_VERSION = '4.01';
export const DEFAULT_TIMEOUT = 30000;
export const BASE_PATH = '/fmi/odata/v4';
```

### Connection Management

#### `src/connection/ConnectionManager.ts`
Manages HTTP connections:
- Connection pooling
- Lifecycle management
- Health checks

```typescript
export class ConnectionManager {
  private config: ServerConfig;
  private httpAgent: Agent;
  
  constructor(config: ServerConfig) {
    // Initialize connection pool
  }
  
  getClient(): ODataClient {
    // Return configured OData client
  }
}
```

#### `src/connection/AuthManager.ts`
Authentication handling:
- Basic Auth implementation
- Token management (future)
- Credential validation

```typescript
export class AuthManager {
  private username: string;
  private password: string;
  
  getAuthHeader(): string {
    // Return Basic Auth header
  }
  
  validateCredentials(): Promise<boolean> {
    // Test authentication
  }
}
```

#### `src/connection/RetryHandler.ts`
Retry logic:
- Exponential backoff
- Max retry configuration
- Error categorization

```typescript
export class RetryHandler {
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number
  ): Promise<T> {
    // Implement retry logic
  }
}
```

### OData Client Layer

#### `src/odata/ODataClient.ts`
Main OData client:
- HTTP request execution
- Response handling
- Error transformation

```typescript
export class ODataClient {
  constructor(
    private config: ServerConfig,
    private authManager: AuthManager
  ) {}
  
  async get(url: string): Promise<any> {
    // Execute GET request
  }
  
  async post(url: string, data: any): Promise<any> {
    // Execute POST request
  }
  
  async patch(url: string, data: any): Promise<any> {
    // Execute PATCH request
  }
  
  async delete(url: string): Promise<void> {
    // Execute DELETE request
  }
}
```

#### `src/odata/ODataQueryBuilder.ts`
URL construction:
- Build OData URLs
- Add query parameters
- Encode special characters

```typescript
export class ODataQueryBuilder {
  buildUrl(options: QueryOptions): string {
    // Construct OData URL with query parameters
  }
  
  buildFilterExpression(filter: string): string {
    // Build $filter expression
  }
}
```

#### `src/odata/ODataResponseParser.ts`
Response parsing:
- Parse JSON responses
- Extract metadata
- Format for MCP

```typescript
export class ODataResponseParser {
  parseQueryResponse(response: any): any {
    // Parse and format query results
  }
  
  parseMetadata(xml: string): any {
    // Parse EDMX metadata
  }
}
```

#### `src/odata/ODataErrorHandler.ts`
Error handling:
- Parse OData errors
- Transform to MCP errors
- Add context

```typescript
export class ODataErrorHandler {
  handleError(error: any): McpError {
    // Transform errors
  }
}
```

### Tool Handlers

#### `src/handlers/tools/queryRecords.ts`
Query records tool implementation:

```typescript
export async function handleQueryRecords(
  args: QueryRecordsArgs,
  client: ODataClient
): Promise<ToolResponse> {
  // Validate input
  // Build query
  // Execute request
  // Format response
}
```

Similar structure for other tool handlers:
- `listDatabases.ts`
- `getMetadata.ts`
- `getRecord.ts`
- `createRecord.ts`
- `updateRecord.ts`
- `deleteRecord.ts`
- `executeBatch.ts`

### Resource Handlers

#### `src/handlers/resources/metadata.ts`
Metadata resource implementation:

```typescript
export async function handleMetadataResource(
  uri: string,
  client: ODataClient
): Promise<ResourceResponse> {
  // Parse URI
  // Fetch metadata
  // Cache if appropriate
  // Format response
}
```

Similar structure for other resource handlers:
- `serviceDocument.ts`
- `tableData.ts`

### Types

#### `src/types/odata.ts`
OData-specific types:

```typescript
export interface ODataQueryOptions {
  filter?: string;
  select?: string;
  orderby?: string;
  top?: number;
  skip?: number;
  expand?: string;
  count?: boolean;
}

export interface ODataResponse {
  '@odata.context': string;
  '@odata.count'?: number;
  value: any[];
}
```

#### `src/types/filemaker.ts`
FileMaker-specific types:

```typescript
export interface FileMakerRecord {
  recordId: string;
  fieldData: Record<string, any>;
  portalData?: Record<string, any[]>;
}
```

#### `src/types/mcp.ts`
MCP-specific types:

```typescript
export interface ToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}
```

### Utilities

#### `src/utils/logger.ts`
Logging utility:

```typescript
export class Logger {
  info(message: string, ...args: any[]): void {}
  error(message: string, error: Error): void {}
  debug(message: string, ...args: any[]): void {}
}
```

#### `src/utils/validation.ts`
Input validation:

```typescript
export function validateDatabaseName(name: string): boolean {}
export function validateTableName(name: string): boolean {}
export function validateRecordId(id: string): boolean {}
export function validateFilterExpression(filter: string): boolean {}
```

#### `src/utils/cache.ts`
Caching utility:

```typescript
export class Cache {
  set(key: string, value: any, ttlSeconds: number): void {}
  get(key: string): any | null {}
  clear(): void {}
}
```

## Configuration Files

### `package.json`
```json
{
  "name": "fms-odata-mcp",
  "version": "1.0.0",
  "description": "MCP server for FileMaker Server OData API",
  "type": "module",
  "main": "build/index.js",
  "bin": {
    "fms-odata-mcp": "./build/index.js"
  },
  "scripts": {
    "build": "tsc && chmod +x build/index.js",
    "dev": "tsc --watch",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write \"src/**/*.ts\""
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0",
    "jest": "^29.0.0",
    "prettier": "^3.0.0",
    "typescript": "^5.3.0"
  }
}
```

### `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "build", "tests"]
}
```

### `.gitignore`
```
# Dependencies
node_modules/

# Build output
build/
dist/

# Environment variables
.env
.env.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Testing
coverage/
.nyc_output/

# Misc
*.bak
*.tmp
```

## Development Workflow

### 1. Initial Setup
```bash
# Create project directory
cd /Users/fsans/Documents/Cline/MCP
npx @modelcontextprotocol/create-server FMS-ODATA-MCP
cd FMS-ODATA-MCP

# Install dependencies
npm install axios
npm install --save-dev @types/node jest
```

### 2. Development
```bash
# Watch mode for development
npm run dev

# In another terminal, build
npm run build
```

### 3. Testing
```bash
# Run tests
npm test

# Watch mode
npm test:watch
```

### 4. Linting and Formatting
```bash
# Lint code
npm run lint

# Format code
npm run format
```

### 5. Building
```bash
# Build for production
npm run build
```

## File Naming Conventions

- **PascalCase**: Class files (e.g., `ODataClient.ts`)
- **camelCase**: Function files (e.g., `queryRecords.ts`)
- **kebab-case**: Configuration files (e.g., `.eslintrc.json`)
- **UPPERCASE**: Documentation files (e.g., `README.md`)

## Code Organization Principles

1. **Separation of Concerns**: Each file has a single, clear responsibility
2. **Modularity**: Components are independent and reusable
3. **Type Safety**: Strong typing throughout the codebase
4. **Error Handling**: Consistent error handling patterns
5. **Testing**: Each module has corresponding tests
6. **Documentation**: Clear inline comments and external documentation

## Import/Export Patterns

```typescript
// Use named exports for utilities and handlers
export function validateInput(input: string): boolean {}

// Use default exports for classes
export default class ODataClient {}

// Group related exports
export {
  ODataClient,
  ODataQueryBuilder,
  ODataResponseParser
} from './odata/index.js';
```

## Next Steps

1. Create the directory structure
2. Initialize npm project
3. Set up TypeScript configuration
4. Create core files with basic structure
5. Implement one tool as a proof of concept
6. Add tests
7. Iterate and expand functionality
