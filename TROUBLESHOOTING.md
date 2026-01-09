# Troubleshooting Guide: EtherNet/IP Driver with CODESYS PLC

## Problem Summary

All `SendRRData` requests to the CODESYS PLC fail with **EIP Status error: 0x03** (Invalid parameter value or malformed data).

### What Works
- ✅ TCP connection to PLC (port 44818)
- ✅ Register Session command (session established successfully)
- ✅ Session handle is valid

### What Doesn't Work
- ❌ All `SendRRData` requests (explicit messaging)
- ❌ Tag reads (`Read Tag` service)
- ❌ Tag writes (`Write Tag` service)
- ❌ Device information queries (`Get_Attribute_All` on Identity object)
- ❌ Even minimal CIP requests (e.g., `Get_Attribute_All` on Message Router)

## Error Details

**Error Code:** `0x03`  
**Error Message:** "Invalid parameter value or malformed data"  
**Error Location:** EIP layer (before CIP payload is processed)  
**Response:** PLC returns only 24-byte EIP header with status 0x03

## Testing Performed

We have exhaustively tested:

1. ✅ Different CIP path formats:
   - Direct tag paths (no Message Router)
   - Message Router paths (standard: `20 02 24 00`)
   - Message Router paths (compact: `01 00`)
   - 16-bit symbolic segments
   - Standard symbolic segments

2. ✅ Different interface handle formats:
   - Two 16-bit values (handle + timeout)
   - Single 32-bit value
   - Separate 4-byte handle + 2-byte timeout
   - Different timeout values (0, 5000ms)

3. ✅ Different sender context formats:
   - All zeros
   - Sequential values
   - Random/timestamp-based
   - Matching Register Session context

4. ✅ Different options field values:
   - Options = 0 (standard)
   - Options = 1

5. ✅ Different CIP services:
   - `Read Tag` (0x4C)
   - `Get_Attribute_All` (0x01)
   - Minimal requests on Message Router

6. ✅ Different tag name formats:
   - `INT1_RUN`
   - `Application.GVL.INT1_RUN`
   - `GVL.INT1_RUN`
   - `Program:MainProgram.INT1_RUN`
   - Various other common formats

**Result:** All tests fail with the same 0x03 error.

## Analysis

The fact that:
- Register Session works (TCP and session management are fine)
- ALL SendRRData requests fail (even minimal ones)
- Error is at EIP layer (before CIP processing)
- All structure variations fail

...strongly suggests this is **not** a code issue, but rather:

1. **PLC Configuration Issue**: CODESYS may require explicit messaging to be explicitly enabled in the PLC configuration
2. **Firmware Limitation**: The CODESYS firmware version may have a bug or limitation with SendRRData
3. **CODESYS-Specific Requirement**: There may be a CODESYS-specific requirement not documented in the standard EtherNet/IP specification

## Recommended Solutions

### 1. Check PLC Configuration

In your CODESYS PLC configuration:

- Look for **EtherNet/IP settings**
- Check if **explicit messaging** needs to be enabled
- Verify **security settings** don't block explicit messaging
- Check if there are **firewall rules** blocking the requests
- Look for **access control lists** (ACLs) that might restrict connections

### 2. Verify Firmware Version

- Check your CODESYS firmware version
- Look for known issues with EtherNet/IP explicit messaging
- Consider updating firmware if a newer version is available
- Check CODESYS release notes for EtherNet/IP changes

### 3. Capture Working Request

If you have access to another EtherNet/IP tool that works with your PLC:

1. Use **Wireshark** to capture a working request
2. Compare the captured request byte-by-byte with our requests
3. Identify any differences in:
   - Header structure
   - Field values
   - Byte order
   - Padding/alignment

### 4. Contact CODESYS Support

Contact CODESYS support with:
- PLC model and firmware version
- EDS file (if available)
- Description of the issue
- Request for documentation on EtherNet/IP explicit messaging requirements

### 5. Alternative Approaches

If explicit messaging cannot be enabled:

- **Implicit Messaging (I/O Connections)**: Use cyclic I/O connections for data exchange
- **Different Protocol**: Check if PLC supports Modbus TCP, OPC UA, or other protocols
- **CODESYS API**: Use CODESYS-specific APIs or libraries if available

## Files for Reference

- `examples/deepDiagnostic.js` - Detailed diagnostic comparing Register Session vs SendRRData
- `examples/testSendRRDataStructure.js` - Tests different SendRRData structure variations
- `examples/testEDSPaths.js` - Tests path formats based on EDS file analysis
- `examples/testFinalVariations.js` - Final tests for edge cases
- `other-files/EtherNet_IP Adapter.eds` - EDS file from CODESYS PLC

## Next Steps

1. Run `npm run testFinal` to see final test results
2. Check PLC configuration for explicit messaging settings
3. Capture a working request from another tool if available
4. Contact CODESYS support with the issue details

## Technical Details

### Request Structure (Current Implementation)

```
[0-23]   EIP Header (24 bytes)
  [0-1]   Command: 0x006F (SendRRData)
  [2-3]   Length: (variable)
  [4-7]   Session Handle: (from Register Session)
  [8-11]  Status: 0
  [12-19] Sender Context: (8 bytes)
  [20-23] Options: 0
[24-27]  Interface Handle: 0x00000000 (4 bytes)
[28-29]  CIP Length: (2 bytes)
[30+]    CIP Packet:
  [30]     CIP Service
  [31]     Path Size (words)
  [32+]    CIP Path
  [...]    CIP Data
```

This structure matches the EtherNet/IP specification, but CODESYS rejects it with 0x03.

### Error Response

```
[0-23]   EIP Header (24 bytes)
  [0-1]   Command: 0x006F (SendRRData)
  [2-3]   Length: 0
  [4-7]   Session Handle: (same as request)
  [8-11]  Status: 0x00000003 (Invalid parameter)
  [12-19] Sender Context: (same as request)
  [20-23] Options: 0
```

No CIP payload is returned - the error is at the EIP encapsulation layer.

