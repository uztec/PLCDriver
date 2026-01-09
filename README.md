# EtherNet/IP Driver for Node.js

A Node.js implementation of the EtherNet/IP protocol for communicating with Programmable Logic Controllers (PLCs) and other industrial devices.

## Features

- ✅ Full EtherNet/IP protocol implementation
- ✅ CIP (Common Industrial Protocol) layer support
- ✅ Tag read/write operations
- ✅ Multiple data type support (BOOL, INT, DINT, REAL, STRING, etc.)
- ✅ Array read/write support
- ✅ **Network discovery** - Find PLCs on your network
- ✅ **PLC Simulator** - Test without physical hardware
- ✅ **Comprehensive test suite** - Automated tests with simulator
- ✅ Event-driven architecture
- ✅ Promise-based API
- ✅ TypeScript-ready

## Installation

```bash
npm install
```

## Testing

Run the comprehensive test suite (uses built-in simulator, no hardware needed):

```bash
npm test
```

The test suite automatically:
- Starts the PLC simulator
- Runs 25+ test cases covering all features
- Stops the simulator
- Reports results

See [`test/README.md`](test/README.md) for details.

## Quick Start

```javascript
import EthernetIPDriver from './index.js';

async function main() {
  // Create driver instance
  const driver = new EthernetIPDriver('192.168.1.100', 44818);

  try {
    // Connect to PLC
    await driver.connect();
    console.log('Connected!');

    // Read a tag
    const value = await driver.readTag('MyTag');
    console.log('Tag value:', value);

    // Write a tag
    await driver.writeTag('MyTag', 42);
    console.log('Tag written');

    // Disconnect
    await driver.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
```

## API Reference

### EthernetIPDriver

Main driver class for EtherNet/IP communication.

#### Constructor

```javascript
new EthernetIPDriver(host, port, options)
```

- `host` (string): PLC IP address
- `port` (number): Port number (default: 44818)
- `options` (object): Optional configuration
  - `timeout` (number): Request timeout in milliseconds (default: 5000)

#### Methods

##### `connect()`

Connect to the PLC and register a session.

```javascript
await driver.connect();
```

##### `disconnect()`

Disconnect from the PLC and unregister the session.

```javascript
await driver.disconnect();
```

##### `readTag(tagName, elementCount)`

Read a tag value from the PLC.

- `tagName` (string): Tag name (e.g., "MyTag" or "Program:MainProgram.MyTag")
- `elementCount` (number): Number of elements to read for arrays (default: 1)

Returns: Promise resolving to the tag value(s)

```javascript
// Read single value
const value = await driver.readTag('MyTag');

// Read array (10 elements)
const array = await driver.readTag('MyArrayTag', 10);
```

##### `writeTag(tagName, value, dataType, elementCount)`

Write a value to a tag.

- `tagName` (string): Tag name
- `value` (any): Value to write
- `dataType` (number): CIP data type (optional, auto-detected if not provided)
- `elementCount` (number): Number of elements for arrays (default: 1)

Returns: Promise

```javascript
// Write with auto-detected type
await driver.writeTag('MyTag', 42);

// Write with explicit type
await driver.writeTag('MyTag', 3.14, CIP_DATA_TYPES.REAL);
```

##### `readTags(tagNames)`

Read multiple tags at once.

- `tagNames` (Array<string>): Array of tag names

Returns: Promise resolving to an object with tag names as keys

```javascript
const tags = await driver.readTags(['Tag1', 'Tag2', 'Tag3']);
// Returns: { Tag1: value1, Tag2: value2, Tag3: value3 }
```

##### `listTags(maxTags, detailed)`

List all tags available in the PLC.

- `maxTags` (number): Maximum number of tags to retrieve (default: 1000)
- `detailed` (boolean): Get detailed information for each tag (default: false)

Returns: Promise resolving to an array of tag objects

```javascript
// List all tags (simple)
const tags = await driver.listTags(100);
tags.forEach(tag => {
  console.log(tag.name);
});

// List tags with detailed information
const detailedTags = await driver.listTags(50, true);
detailedTags.forEach(tag => {
  console.log(`${tag.name}: type=0x${tag.dataType.toString(16)}, elements=${tag.elementCount}`);
});
```

**Note:** Tag browsing requires the PLC to support the CIP Find_Next service. Not all PLCs support this feature.

##### `browseTags(maxTags)`

Browse tags (alias for `listTags(maxTags, false)`).

- `maxTags` (number): Maximum number of tags to retrieve (default: 1000)

Returns: Promise resolving to an array of tag objects

```javascript
const tags = await driver.browseTags(100);
```

##### `getTagInfo(tagName)`

Get detailed information about a specific tag.

- `tagName` (string): Tag name

Returns: Promise resolving to tag information object

```javascript
const tagInfo = await driver.getTagInfo('MyTag');
console.log(`Type: 0x${tagInfo.dataType.toString(16)}`);
console.log(`Elements: ${tagInfo.elementCount}`);
console.log(`Is Array: ${tagInfo.isArray}`);
```

##### `isConnected()`

Check if the driver is connected to the PLC.

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
- `error`: Emitted when an error occurs

```javascript
driver.on('connected', () => {
  console.log('Connected to PLC');
});

driver.on('error', (error) => {
  console.error('Error:', error);
});
```

## Supported Data Types

The driver supports the following CIP data types:

- `BOOL` (0xC1): Boolean
- `SINT` (0xC2): Signed 8-bit integer
- `INT` (0xC3): Signed 16-bit integer
- `DINT` (0xC4): Signed 32-bit integer
- `USINT` (0xC6): Unsigned 8-bit integer
- `UINT` (0xC7): Unsigned 16-bit integer
- `UDINT` (0xC8): Unsigned 32-bit integer
- `REAL` (0xCA): 32-bit floating point
- `LREAL` (0xCB): 64-bit floating point
- `STRING` (0xDA): String

You can import data type constants:

```javascript
import { CIP_DATA_TYPES } from './index.js';

await driver.writeTag('MyTag', 123, CIP_DATA_TYPES.DINT);
```

## Network Discovery

The driver includes network discovery functionality to find PLCs on your network using the EtherNet/IP List Identity service.

**Note:** Some PLCs don't support List Identity discovery, but you can still connect to them directly. Use `testConnection()` to verify connectivity.

### Discover All PLCs

```javascript
import { discoverPLCs } from './index.js';

// Discover all PLCs on the network (broadcast)
const devices = await discoverPLCs(3000); // 3 second timeout

devices.forEach(device => {
  console.log(`Found: ${device.productName} at ${device.ipAddress}`);
  console.log(`  Vendor ID: ${device.vendorId}`);
  console.log(`  Product Code: ${device.productCode}`);
  console.log(`  Serial Number: ${device.serialNumber}`);
});
```

### Discover Specific PLC

```javascript
import { discoverPLC } from './index.js';

// Discover a specific PLC by IP address
const device = await discoverPLC('192.168.1.100', 2000);

if (device) {
  console.log(`Found: ${device.productName}`);
} else {
  console.log('PLC not found');
}
```

### Continuous Discovery

```javascript
import { PLCDiscovery } from './index.js';

const discovery = new PLCDiscovery();

discovery.on('device', (device) => {
  console.log(`New device: ${device.productName} at ${device.ipAddress}`);
});

discovery.on('deviceUpdate', (device) => {
  console.log(`Device updated: ${device.productName}`);
});

discovery.on('error', (error) => {
  console.error('Discovery error:', error);
});

// Start discovery (checks every 2 seconds)
discovery.start(2000);

// Later, stop discovery
discovery.stop();

// Get all discovered devices
const devices = discovery.getDevices();
```

### Discovery Response Structure

Each discovered device contains:

- `ipAddress` (string): IP address of the device
- `port` (number): Port number
- `productName` (string): Product name
- `vendorId` (number): Vendor ID
- `deviceType` (number): Device type code
- `productCode` (number): Product code
- `revision` (object): `{ major, minor }` - Revision information
- `status` (number): Device status
- `serialNumber` (number): Serial number
- `state` (number): Device state

## Examples

See the [`examples/`](examples/) directory for comprehensive examples and documentation.

### Available Examples

- **`basic.js`** - Basic read/write operations
  ```bash
  npm run example
  ```

- **`advanced.js`** - Advanced usage with events and different data types
  ```bash
  node examples/advanced.js
  ```

- **`discovery.js`** - Network discovery examples
  ```bash
  npm run discovery
  ```

- **`listTags.js`** - Tag browsing and listing examples
  ```bash
  npm run listTags
  ```

- **`complete.js`** - Complete workflow combining all features
  ```bash
  npm run complete
  ```

For detailed information about each example, see [`examples/README.md`](examples/README.md).

## Connection Testing

If discovery doesn't work (some PLCs don't support List Identity), you can still test connectivity:

```javascript
import { testConnection, verifyPLC } from './index.js';

// Simple connection test
const result = await testConnection('10.88.48.100', 44818);
if (result.reachable && result.sessionSupported) {
  console.log('PLC is reachable and supports EtherNet/IP!');
  // You can connect directly even if discovery failed
}

// Comprehensive verification (includes discovery + connection test)
const verification = await verifyPLC('10.88.48.100');
console.log(verification.recommended); // 'use_direct_connection' if TCP works but discovery doesn't
```

Run the connection test example:
```bash
npm run testConnection
# or
node examples/testConnection.js
```

## Protocol Details

EtherNet/IP uses:
- TCP port 44818 for explicit messaging (tag read/write)
- UDP port 2222 for implicit messaging (I/O data)
- CIP (Common Industrial Protocol) for the application layer

This implementation currently supports explicit messaging only.

## Error Handling

All methods return Promises that reject on error. Common errors:

- Connection errors: Network issues, PLC unreachable
- CIP errors: Invalid tag names, data type mismatches, access denied
- Timeout errors: Request timeout (default: 5 seconds)

```javascript
try {
  await driver.readTag('InvalidTag');
} catch (error) {
  if (error.message.includes('CIP error')) {
    console.error('Tag error:', error);
  } else if (error.message.includes('timeout')) {
    console.error('Request timeout');
  } else {
    console.error('Connection error:', error);
  }
}
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Disclaimer

This driver is provided as-is for industrial automation purposes. Always test thoroughly in a safe environment before using in production systems.

