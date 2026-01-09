# CODESYS OPC UA Configuration Guide

## Current Status

✅ **OPC UA Server:** Running and accessible  
⚠️ **OPC UA Features:** Not fully enabled  
❌ **Tags Exposed:** Tags are not exposed to OPC UA yet

## Configuration Message

The OPC UA server shows:
> "Please activate 'Support OPC UA Features' within the symbolconfiguration editor"

This means tags need to be explicitly enabled for OPC UA access.

## Steps to Enable OPC UA Features

### Method 1: Symbol Configuration Editor

1. **Open CODESYS IDE**
2. **Navigate to:** `Device` → `Device Configuration`
3. **Select your device:** `PLC500 Industrial` (or your device name)
4. **Open Properties/Settings**
5. **Look for:**
   - "OPC UA" section
   - "Symbol Configuration" section
   - "Variable Access" section
6. **Enable:**
   - ✅ "Support OPC UA Features"
   - ✅ "Expose Variables to OPC UA"
   - ✅ "Enable OPC UA Variable Access"
7. **Save the configuration**
8. **Download to PLC** (if needed)
9. **Restart PLC** (if required)

### Method 2: OPC UA Server Configuration

1. **In CODESYS IDE:**
   - Device → OPC UA Server
   - Or: Online → Communication Settings → OPC UA

2. **Enable:**
   - OPC UA Server
   - Variable Access
   - Symbol Access

3. **Configure:**
   - Which variables to expose
   - Access permissions
   - Namespace settings

### Method 3: Symbol Configuration Editor (Detailed)

1. **In CODESYS IDE:**
   - Tools → Symbol Configuration
   - Or: Device → Symbol Configuration

2. **Enable:**
   - "Support OPC UA Features"
   - "Expose to OPC UA"
   - For each variable/tag you want to access

3. **Select variables:**
   - Choose which tags to expose
   - Set access permissions (read/write)

## After Enabling

Once OPC UA features are enabled:

1. **Tags will be exposed** in namespace 4 (CODESYSSPV3/3S/IecVarAccess)
2. **Node ID format** will be: `ns=4;s=|var|...` or similar
3. **You can browse** tags using the browser scripts
4. **You can read/write** tags using the OPC UA driver

## Testing After Configuration

Run the find script:
```bash
node examples/findINT1_RUN.js
```

Or browse tags:
```bash
npm run browseCODESYS
```

## Alternative: Use EtherNet/IP

If OPC UA cannot be enabled, you can use EtherNet/IP:

1. **Enable EtherNet/IP explicit messaging** in CODESYS
2. **Use the EtherNet/IP driver** (already implemented)
3. **The driver is ready** - just needs explicit messaging enabled

## Troubleshooting

### Tags Still Not Visible

1. **Check Symbol Configuration:**
   - Verify "Support OPC UA Features" is enabled
   - Verify tags are selected for OPC UA exposure

2. **Check OPC UA Server:**
   - Verify OPC UA Server is running
   - Check server status in CODESYS IDE

3. **Check Namespace:**
   - Tags should appear in namespace 4
   - Browse from `ns=4;s=|plc|PLC500 Industrial`

4. **Restart PLC:**
   - Some changes require PLC restart
   - Download configuration again

### Still Having Issues?

1. **Check CODESYS Documentation:**
   - OPC UA configuration guide
   - Symbol Configuration editor guide

2. **Check PLC Firmware:**
   - Ensure firmware supports OPC UA
   - Update if needed

3. **Contact CODESYS Support:**
   - Provide device version
   - Describe the issue
   - Ask about OPC UA configuration

## Summary

- ✅ OPC UA server is running
- ⚠️ OPC UA features need to be enabled in CODESYS
- 📝 Follow the steps above to enable tag access
- 🔄 After enabling, tags will be accessible via OPC UA

