# OPC UA Driver Usage Guide

## Quick Start

### List All Tags

```bash
npm run listAllTags
```

This will:
- Connect to the OPC UA server
- Browse all available tags recursively
- Display tags grouped by path
- Show values and data types when available

### Read a Tag

```bash
npm run readBoolOPCUA
```

Or use the driver programmatically:

```javascript
import OPCUADriver from './src/opcuaDriver.js';

const driver = new OPCUADriver('10.88.48.100', 4840);
await driver.connect();

// Read by tag name (driver will try common paths)
const value = await driver.readTag('INT1_RUN');

// Or read by full Node ID
const value2 = await driver.readTag('ns=4;s=|var|PLC500 Industrial.Application.GVL.INT1_RUN');

await driver.disconnect();
```

### Write a Tag

```javascript
await driver.writeTag('INT1_RUN', true);
```

### List All Tags Programmatically

```javascript
// List all tags from namespace 4
const tags = await driver.listAllTags("RootFolder", 10, "ns=4");

// List all tags from all namespaces
const allTags = await driver.listAllTags("RootFolder", 10);

// Each tag object contains:
// {
//   name: "INT1_RUN",
//   nodeId: "ns=4;s=|var|PLC500 Industrial.Application.GVL.INT1_RUN",
//   path: "Application.GVL.INT1_RUN",
//   value: true,
//   dataType: "Boolean"
// }
```

## CODESYS Tag Naming

CODESYS uses namespace 4 with the following format:
- `ns=4;s=|var|PLC500 Industrial.Application.GVL.INT1_RUN`
- `ns=4;s=|var|Application.GVL.INT1_RUN`
- `ns=4;s=|var|GVL.INT1_RUN`

The driver automatically tries these paths when you provide just the tag name.

## Available Scripts

- `npm run listAllTags` - List all available tags
- `npm run readBoolOPCUA` - Read INT1_RUN tag
- `npm run browseOPCUA` - Browse OPC UA server structure
- `npm run browseCODESYS` - Browse CODESYS-specific tags
- `npm run findINT1_RUN` - Find INT1_RUN using various methods

## Configuration

Make sure OPC UA features are enabled in CODESYS:
1. Tools → Symbol Configuration
2. Enable "Support OPC UA Features"
3. Enable "Expose Variables to OPC UA"
4. Save and download to PLC

