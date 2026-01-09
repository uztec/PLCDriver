# EtherNet/IP Driver Examples

This directory contains example scripts demonstrating how to use the EtherNet/IP driver.

## 🧪 Testing with the PLC Simulator

**No physical PLC needed!** The driver includes a built-in PLC simulator for testing.

### Quick Start with Simulator

1. **Start the simulator** (in one terminal):
   ```bash
   npm run simulator
   ```

2. **Run tests** (in another terminal):
   ```bash
   node examples/testWithSimulator.js
   ```

3. **Or use any example** - just update the PLC IP to `127.0.0.1`:
   ```javascript
   const PLC_IP = '127.0.0.1'; // Simulator runs on localhost
   ```

The simulator supports:
- ✅ Tag read/write operations
- ✅ Multiple data types (BOOL, INT, DINT, REAL, STRING, arrays)
- ✅ Network discovery (List Identity)
- ✅ Session management
- ✅ In-memory tag database

See `simulator.js` and `testWithSimulator.js` for more details.

## Examples

### 1. `basic.js` - Basic Operations
Simple example showing basic connect, read, and write operations.

**Usage:**
```bash
npm run example
# or
node examples/basic.js
```

**What it demonstrates:**
- Connecting to a PLC
- Reading a tag value
- Writing a tag value
- Reading multiple tags
- Disconnecting

**Before running:** Update the PLC IP address in the script (default: `192.168.1.100`)

---

### 2. `advanced.js` - Advanced Features
Example showing advanced features including events and different data types.

**Usage:**
```bash
node examples/advanced.js
```

**What it demonstrates:**
- Event handling (connected, disconnected, error)
- Reading different data types (BOOL, INT, REAL, STRING)
- Writing with explicit data types
- Reading arrays
- Using CIP data type constants

**Before running:** Update the PLC IP address and tag names in the script

---

### 3. `discovery.js` - Network Discovery
Example showing how to discover PLCs on your network.

**Usage:**
```bash
npm run discovery
# or
node examples/discovery.js
```

**What it demonstrates:**
- Discovering all PLCs on the network (broadcast)
- Discovering a specific PLC by IP address
- Continuous discovery with events
- Accessing device information (product name, vendor ID, serial number, etc.)

**Note:** This uses UDP broadcast and may require appropriate network permissions.

---

### 4. `listTags.js` - Tag Browsing
Example showing how to list and browse tags in a PLC.

**Usage:**
```bash
npm run listTags
# or
node examples/listTags.js
```

**What it demonstrates:**
- Listing all tags in the PLC
- Getting detailed tag information
- Browsing tags
- Getting information about a specific tag

**Note:** Tag browsing requires PLC support for the CIP Find_Next service. Not all PLCs support this feature.

**Before running:** Update the PLC IP address in the script

---

### 5. `complete.js` - Complete Workflow
Comprehensive example combining all features.

**Usage:**
```bash
node examples/complete.js
```

**What it demonstrates:**
- Complete workflow from discovery to tag operations
- Error handling
- Best practices
- Combining multiple features

---

### 6. `simulator.js` - PLC Simulator
Start a simulated PLC for testing.

**Usage:**
```bash
npm run simulator
# or
node examples/simulator.js
```

**What it demonstrates:**
- Running a simulated PLC server
- Tag management
- Event handling
- Custom tag configuration

**Note:** Keep this running while testing the driver. Press Ctrl+C to stop.

---

### 7. `testWithSimulator.js` - Test with Simulator
Example showing how to test the driver with the simulator.

**Usage:**
```bash
# Terminal 1: Start simulator
npm run simulator

# Terminal 2: Run test
node examples/testWithSimulator.js
```

**What it demonstrates:**
- Connecting to the simulator
- Reading/writing tags
- Testing different data types
- Array operations

---

### 8. `readBoolTag.js` - Read BOOL Tag
Simple example to connect and read a specific BOOL tag.

**Usage:**
```bash
npm run readBool
# or
node examples/readBoolTag.js
```

**What it demonstrates:**
- Connecting to a PLC
- Reading a BOOL tag (INT1_RUN)
- Error handling
- Simple value checking

**Before running:** Update the PLC IP address and tag name in the script.

---

### 9. `testConnection.js` - Connection Testing
Test if a PLC is reachable even if discovery doesn't work.

**Usage:**
```bash
npm run testConnection
# or
node examples/testConnection.js
```

**What it demonstrates:**
- Testing TCP connectivity
- Verifying EtherNet/IP support
- Handling PLCs that don't support discovery

---

## Configuration

Before running any example, make sure to:

1. **Update the PLC IP address** in the script to match your PLC's IP address
2. **Update tag names** to match tags that exist in your PLC
3. **Ensure network connectivity** to the PLC
4. **Check firewall settings** - EtherNet/IP uses TCP port 44818 for explicit messaging

## Common Issues

### Connection Timeout
- Verify the PLC IP address is correct
- Check network connectivity (ping the PLC)
- Ensure the PLC is powered on and running
- Check firewall settings

### Tag Not Found
- Verify the tag name is correct (case-sensitive)
- Check if the tag exists in the PLC program
- Ensure you have read/write permissions for the tag

### Discovery Not Working
- Ensure UDP port 2222 is not blocked
- Try using a specific IP address instead of broadcast
- Some networks may not allow UDP broadcasts

### Tag Browsing Not Working
- Not all PLCs support tag browsing via Find_Next service
- This is normal for some PLC manufacturers
- You can still read/write tags if you know their names

## Debugging

Enable debug logging to see detailed information:

```bash
DEBUG=ethernetip:* node examples/basic.js
```

This will show:
- Connection events
- Message sending/receiving
- Protocol details
- Error information

## Next Steps

After running the examples:

1. Modify the examples to match your PLC configuration
2. Integrate the driver into your own application
3. Check the main README.md for complete API documentation
4. Explore the source code in the `src/` directory for advanced usage

## Support

For issues or questions:
- Check the main README.md for API documentation
- Review the source code comments
- Ensure your PLC supports EtherNet/IP protocol

