# CODESYS EtherNet/IP Adapter Configuration Guide

## Device Information

- **Name:** EtherNet/IP Adapter
- **Vendor:** CODESYS
- **Version:** 4.8.0.0
- **Configuration Version:** 3.5.15.0
- **Type:** 120 (0x0078)
- **ID:** 0000 1016

## Important Notes

According to the EDS file and EtherNet/IP specification, this adapter **supports explicit messaging** (Class 3) and includes:
- Identity Object (Class 0x01)
- Message Router Object (Class 0x02)
- Assembly Object (Class 0x04)
- Connection Manager Object (Class 0x06)
- TCP/IP Interface Object (Class 0xF5)
- EtherNet Link Object (Class 0xF6)

However, **explicit messaging may need to be enabled** in the CODESYS configuration.

## Configuration Steps

### Step 1: Check Device Configuration in CODESYS IDE

1. Open your CODESYS project
2. Navigate to **Device** → **Device Configuration**
3. Select the **EtherNet/IP Adapter** device
4. Open the **Properties** or **Settings** tab
5. Look for the following options:

   - ✅ **"Enable Explicit Messaging"** or **"Explicit Messaging Enabled"**
   - ✅ **"SendRRData Support"** or **"Explicit Messaging Support"**
   - ✅ **"Class 3 Messaging"** or **"Explicit Messaging (Class 3)"**
   - ✅ **"Security Settings"** or **"Access Control"**

### Step 2: Check Communication Settings

1. In the device properties, look for **"Communication"** or **"Network"** section
2. Verify:
   - Port 44818 is enabled for explicit messaging
   - No firewall rules blocking the port
   - IP address restrictions are not blocking your client

### Step 3: Check Runtime Settings

1. In CODESYS IDE, go to **Online** → **Login** (or **Communication Settings**)
2. Check **Runtime Settings** or **Communication Settings**
3. Look for EtherNet/IP specific options:
   - Explicit messaging timeout
   - Maximum connections
   - Security settings

### Step 4: Check Additional EDS Files

The following EDS files were mentioned in your device information:
- `CODESYS_EtherNetIP_Adapter_Chassis.eds`
- `CODESYS_EtherNetIP_Adapter_CommunicationModule.eds`
- `EtherNetIPAdapterStrings.xml`

These files may contain:
- Configuration parameters
- Required settings
- Limitations or known issues

**Action:** Please share these EDS files if possible, as they may contain important configuration information.

### Step 5: Check Version-Specific Requirements

- **Adapter Version:** 4.8.0.0
- **Configuration Version:** 3.5.15.0

Check:
- CODESYS release notes for version 4.8.0.0
- Known issues with explicit messaging in this version
- Any firmware updates available

## Common Configuration Locations

### In CODESYS IDE Device Tree:

```
Device
└── EtherNet/IP Adapter
    ├── Properties
    │   ├── General
    │   ├── Communication
    │   ├── Security
    │   └── Advanced
    └── Online Settings
```

### Settings to Look For:

1. **Explicit Messaging:**
   - Enable/Disable toggle
   - Timeout settings
   - Maximum connections

2. **Security:**
   - Access control lists (ACLs)
   - IP address restrictions
   - Authentication requirements

3. **Communication:**
   - Port configuration
   - Protocol settings
   - Connection limits

## Testing After Configuration

After enabling explicit messaging, test with:

```bash
npm run checkConfig
```

This will:
- Connect to the PLC
- Test a minimal explicit messaging request
- Verify if explicit messaging is now working

## Alternative: Implicit Messaging

If explicit messaging cannot be enabled, you can use **implicit messaging (I/O connections)**:

- Uses UDP port 2222
- Requires `Forward_Open` command to establish connection
- Cyclic data exchange (not request/response)
- Different implementation approach

**Note:** Implicit messaging requires a different driver implementation using `Forward_Open` commands.

## Troubleshooting

### If Explicit Messaging Still Doesn't Work:

1. **Check CODESYS Logs:**
   - View runtime logs for error messages
   - Check for security violations
   - Look for connection rejections

2. **Verify Network:**
   - Ensure no firewall blocking port 44818
   - Check network connectivity
   - Verify IP address is correct

3. **Check Firmware:**
   - Update to latest firmware if available
   - Check for known bugs in version 4.8.0.0

4. **Contact CODESYS Support:**
   - Provide device version (4.8.0.0)
   - Describe the issue (all SendRRData requests fail with 0x03)
   - Share EDS files if possible

## Expected Behavior After Configuration

Once explicit messaging is enabled, you should be able to:

- ✅ Read tags using `Read Tag` service (0x4C)
- ✅ Write tags using `Write Tag` service (0x4D)
- ✅ Get device information using `Get_Attribute_All` (0x01)
- ✅ Browse tags using `Find_Next` service (0x11)

All of these use the `SendRRData` command, which currently fails with error 0x03.

## Next Steps

1. **Check CODESYS IDE configuration** using the steps above
2. **Share the additional EDS files** if available:
   - `CODESYS_EtherNetIP_Adapter_Chassis.eds`
   - `CODESYS_EtherNetIP_Adapter_CommunicationModule.eds`
   - `EtherNetIPAdapterStrings.xml`
3. **Run the configuration check:**
   ```bash
   npm run checkConfig
   ```
4. **Test again** after enabling explicit messaging

## References

- CODESYS EtherNet/IP Adapter Documentation
- EtherNet/IP Specification Volume 1 (Common Industrial Protocol)
- EDS File: `other-files/EtherNet_IP Adapter.eds`

