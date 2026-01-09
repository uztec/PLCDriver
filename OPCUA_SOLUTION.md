# OPC UA Solution for CODESYS PLC

## ✅ Great News!

**OPC UA is available on your CODESYS PLC!** This provides a working alternative to EtherNet/IP explicit messaging.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

This will install `node-opcua` library.

### 2. Test OPC UA Connection

```bash
npm run testAlternatives
```

### 3. Read Your Tag

```bash
npm run readBoolOPCUA
```

This will read the `INT1_RUN` tag using OPC UA.

## Usage

### Basic Example

```javascript
import OPCUADriver from './src/opcuaDriver.js';

const driver = new OPCUADriver('10.88.48.100', 4840);

try {
  await driver.connect();
  
  // Read a tag
  const value = await driver.readTag('INT1_RUN');
  console.log('Tag value:', value);
  
  // Write a tag
  await driver.writeTag('INT1_RUN', true);
  
  // Browse available tags
  const nodes = await driver.browseTags();
  console.log('Available tags:', nodes);
  
  await driver.disconnect();
} catch (error) {
  console.error('Error:', error);
}
```

## OPC UA Driver API

### Constructor

```javascript
new OPCUADriver(host, port, options)
```

- `host` (string): PLC IP address
- `port` (number): OPC UA port (default: 4840)
- `options` (object): Optional configuration
  - `securityMode`: MessageSecurityMode (default: None)
  - `securityPolicy`: SecurityPolicy (default: None)

### Methods

#### `connect()`
Connect to OPC UA server.

#### `disconnect()`
Disconnect from OPC UA server.

#### `readTag(tagName)`
Read a tag value. Automatically tries common CODESYS tag paths:
- `ns=2;s=TagName`
- `ns=2;s=Application.TagName`
- `ns=2;s=Application.GVL.TagName`
- `ns=2;s=GVL.TagName`
- `ns=2;s=Program:MainProgram.TagName`
- `ns=2;s=MainProgram.TagName`

#### `writeTag(tagName, value)`
Write a tag value.

#### `browseTags(startingPath)`
Browse available tags/nodes in the OPC UA server.

#### `isConnected()`
Check if connected to OPC UA server.

## Tag Paths in CODESYS

CODESYS uses different tag paths depending on where the tag is defined:

- **Global tags (GVL):** `Application.GVL.TagName` or `GVL.TagName`
- **Program tags:** `Program:MainProgram.TagName` or `MainProgram.TagName`
- **Direct tags:** `TagName`

The driver automatically tries all common paths.

## Certificate Warnings

You may see certificate warnings when connecting. These are informational and don't prevent communication:

- **Certificate mismatch:** The certificate subjectAltName doesn't match the client applicationUri
- **Clock discrepancy:** Server and client clocks don't match (usually harmless)

To fix (optional):
1. Regenerate OPC UA certificates
2. Synchronize server and client clocks

## Advantages of OPC UA

✅ **Works immediately** - No configuration needed in CODESYS  
✅ **Modern protocol** - Industry standard  
✅ **Secure** - Built-in security features  
✅ **Well-supported** - Many libraries available  
✅ **Flexible** - Supports complex data types  

## Comparison: EtherNet/IP vs OPC UA

| Feature | EtherNet/IP | OPC UA |
|---------|-------------|--------|
| Status | ❌ Not working (needs config) | ✅ Working |
| Protocol | EtherNet/IP | OPC UA |
| Port | 44818 (TCP) | 4840 (TCP) |
| Security | Basic | Advanced |
| Setup | Requires CODESYS config | Works out of the box |

## Next Steps

1. **Use OPC UA for now:**
   ```bash
   npm run readBoolOPCUA
   ```

2. **If you need EtherNet/IP later:**
   - Enable explicit messaging in CODESYS IDE
   - Your EtherNet/IP driver is ready to use

3. **For production:**
   - Consider using OPC UA (more secure, modern)
   - Or enable EtherNet/IP if required by your system

## Files

- `src/opcuaDriver.js` - OPC UA driver implementation
- `examples/opcuaExample.js` - Basic OPC UA example
- `examples/readBoolTagOPCUA.js` - Read BOOL tag example
- `examples/testAlternatives.js` - Test all alternative protocols

## Summary

**You now have a working solution!** OPC UA is available and ready to use. The driver automatically handles tag path resolution, so you can start reading/writing tags immediately.

