# Missing Dependencies for cloud-sql-optimizer.js

The `cloud-sql-optimizer.js` script requires the following dependencies to be added to `package.json`:

## Required Dependencies

### 1. PostgreSQL Client (pg)
- **Package**: `pg`
- **Version**: `^8.11.3`
- **Purpose**: Required by cloud-sql-optimizer.js for PostgreSQL database connections and operations
- **Install command**: `npm install pg`

### 2. WebSocket Library (ws)
- **Package**: `ws`
- **Version**: `^8.16.0`  
- **Purpose**: WebSocket support for real-time communication (referenced in various parts of the project)
- **Install command**: `npm install ws`

## Installation Instructions

To install both packages at once, run:

```bash
npm install pg@^8.11.3 ws@^8.16.0
```

This will automatically update the `package.json` file with the new dependencies.

## Manual package.json Update

If you prefer to manually update `package.json`, add these lines to the `dependencies` section (after "winston"):

```json
"dependencies": {
  "@anthropic-ai/sdk": "^0.32.1",
  "@modelcontextprotocol/sdk": "^1.0.4",
  "@nitric/sdk": "^1.4.2",
  "better-sqlite3": "^11.8.1",
  "cors": "^2.8.5",
  "dotenv": "^16.4.7",
  "express": "^4.21.2",
  "fs-extra": "^11.2.0",
  "zod": "^3.24.1",
  "compression": "^1.7.4",
  "helmet": "^8.0.0",
  "express-rate-limit": "^7.4.1",
  "lru-cache": "^11.0.2",
  "winston": "^3.17.0",
  "pg": "^8.11.3",
  "ws": "^8.16.0"
},
```

## Verification

After installation, verify the packages are installed:

```bash
npm list pg ws
```

## Notes

- The `cloud-sql-optimizer.js` script has been created in the `scripts/` directory
- It includes comprehensive SQL optimization, connection pooling, and performance monitoring features
- The script will not function properly until these dependencies are installed
