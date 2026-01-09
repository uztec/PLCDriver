# OPC UA Driver for Node.js

A Node.js OPC UA client driver for communicating with CODESYS PLCs and other OPC UA-compatible industrial devices.

## Features

- ✅ Full OPC UA client implementation
- ✅ Tag read/write operations
- ✅ Recursive tag browsing and listing
- ✅ Multiple data type support
- ✅ CODESYS-specific path handling
- ✅ Event-driven architecture
- ✅ Promise-based API
- ✅ TypeScript-ready

## Installation

```bash
npm install
```

## Quick Start

```javascript
import OPCUADriver from './index.js';

async function main() {
  // Create driver instance
  const driver = new OPCUADriver('10.88.48.100', 4840);

  try {
    // Connect to PLC
    await driver.connect();
    console.log('Connected!');

    // Read a tag
    const value = await driver.readTag('INT1_RUN');
    console.log('Tag value:', value);

    // Write a tag
    await driver.writeTag('INT1_RUN', true);
    console.log('Tag written');

    // List all tags
    const tags = await driver.listAllTags();
    console.log(`Found ${tags.length} tags`);

    // Disconnect
    await driver.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
```

## API Reference

### OPCUADriver

Main driver class for OPC UA communication.

#### Constructor

```javascript
new OPCUADriver(host, port, options)
```

- `host` (string): PLC IP address
- `port` (number): OPC UA port number (default: 4840)
- `options` (object): Optional configuration
  - `securityMode` (MessageSecurityMode): Security mode (default: None)
  - `securityPolicy` (SecurityPolicy): Security policy (default: None)

#### Methods

##### `connect()`

Connect to the OPC UA server.

```javascript
await driver.connect();
```

##### `disconnect()`

Disconnect from the OPC UA server.

```javascript
await driver.disconnect();
```

##### `readTag(tagName)`

Read a tag value from the PLC.

- `tagName` (string): Tag name (e.g., "INT1_RUN") or full Node ID (e.g., "ns=4;s=|var|PLC500 Industrial.Application.GVL.INT1_RUN")

Returns: Promise resolving to the tag value

```javascript
// Read by tag name (driver will try common paths)
const value = await driver.readTag('INT1_RUN');

// Read by full Node ID
const value2 = await driver.readTag('ns=4;s=|var|PLC500 Industrial.Application.GVL.INT1_RUN');
```

##### `writeTag(tagName, value)`

Write a value to a tag.

- `tagName` (string): Tag name or full Node ID
- `value` (any): Value to write

Returns: Promise

```javascript
await driver.writeTag('INT1_RUN', true);
```

##### `listAllTags(startingNodeId, maxDepth, namespaceFilter)`

Recursively browse and list all tags (variables) from the OPC UA server.

- `startingNodeId` (string): Starting node ID (default: "RootFolder")
- `maxDepth` (number): Maximum browse depth (default: 10)
- `namespaceFilter` (string): Optional namespace filter (e.g., "ns=4")

Returns: Promise resolving to an array of tag objects

```javascript
// List all tags from namespace 4 (CODESYS)
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

##### `browseTags(startingPath)`

Browse available tags from a starting path (single level).

- `startingPath` (string): Starting browse path (default: "RootFolder")

Returns: Promise resolving to an array of nodes

```javascript
const nodes = await driver.browseTags("RootFolder");
```

##### `isConnected()`

Check if the driver is connected to the OPC UA server.

Returns: boolean

```javascript
if (driver.isConnected()) {
  // Do something
}
```

#### Events

The driver extends EventEmitter and emits the following events:

- `connected`: Emitted when connection is established
- `disconnected`: Emitted when connection is closed

```javascript
driver.on('connected', () => {
  console.log('Connected to OPC UA server');
});

driver.on('disconnected', () => {
  console.log('Disconnected from OPC UA server');
});
```

## CODESYS Tag Naming

CODESYS uses namespace 4 with the following format:
- `ns=4;s=|var|PLC500 Industrial.Application.GVL.INT1_RUN`
- `ns=4;s=|var|Application.GVL.INT1_RUN`
- `ns=4;s=|var|GVL.INT1_RUN`

The driver automatically tries these paths when you provide just the tag name.

## Examples

See the [`examples/`](examples/) directory for comprehensive examples.

### Available Examples

- **`listAllTags.js`** - List all available tags
  ```bash
  npm run listAllTags
  ```

- **`readBoolTagOPCUA.js`** - Read a tag example
  ```bash
  npm run readTag
  ```

## Configuration

### CODESYS PLC Configuration

To use OPC UA with CODESYS, you need to enable OPC UA features:

1. Open your CODESYS project in CODESYS IDE
2. Navigate to: **Tools → Symbol Configuration**
3. Enable **"Support OPC UA Features"**
4. Enable **"Expose Variables to OPC UA"**
5. Select which tags to expose (or expose all)
6. Save and download the configuration to the PLC
7. Restart the PLC if needed

For detailed configuration instructions, see [`CODESYS_OPCUA_CONFIGURATION.md`](CODESYS_OPCUA_CONFIGURATION.md).

## Protocol Details

OPC UA uses:
- TCP port 4840 (default) for OPC UA communication
- Secure and unsecured communication modes
- Standard OPC UA protocol stack

This implementation uses the `node-opcua` library for OPC UA client functionality.

## Error Handling

All methods return Promises that reject on error. Common errors:

- Connection errors: Network issues, PLC unreachable
- OPC UA errors: Invalid tag names, Node ID not found, access denied
- Timeout errors: Request timeout

```javascript
try {
  await driver.readTag('InvalidTag');
} catch (error) {
  if (error.message.includes('not found')) {
    console.error('Tag not found:', error);
  } else if (error.message.includes('timeout')) {
    console.error('Request timeout');
  } else {
    console.error('Connection error:', error);
  }
}
```

## Documentation

- [`OPCUA_USAGE.md`](OPCUA_USAGE.md) - Detailed usage guide
- [`OPCUA_SOLUTION.md`](OPCUA_SOLUTION.md) - OPC UA solution overview
- [`CODESYS_OPCUA_CONFIGURATION.md`](CODESYS_OPCUA_CONFIGURATION.md) - CODESYS configuration guide

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Disclaimer

This driver is provided as-is for industrial automation purposes. Always test thoroughly in a safe environment before using in production systems.
