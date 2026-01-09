/**
 * Deep diagnostic to compare working Register Session with failing SendRRData
 * This will help identify structural differences
 */

import { 
  EthernetIPDriver,
  buildRegisterSession,
  buildEIPHeader,
  EIP_COMMANDS,
  CIP_SERVICES,
  buildPath,
  buildMessageRouterPath,
  toUInt16LE,
  toUInt32LE
} from '../index.js';

const PLC_IP = '10.88.48.100';
const PLC_PORT = 44818;
const TAG_NAME = 'INT1_RUN';

function hexDumpBuffer(buffer, label = 'Buffer') {
  const lines = [];
  for (let i = 0; i < buffer.length; i += 16) {
    const chunk = buffer.slice(i, i + 16);
    const hex = Array.from(chunk)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
    const ascii = Array.from(chunk)
      .map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.')
      .join('');
    lines.push(`${i.toString(16).padStart(4, '0')}: ${hex.padEnd(48)} ${ascii}`);
  }
  return `${label} (${buffer.length} bytes):\n${lines.join('\n')}`;
}

async function deepDiagnostic() {
  console.log('=== Deep Diagnostic: Register Session vs SendRRData ===\n');
  console.log(`PLC: ${PLC_IP}:${PLC_PORT}\n`);

  const driver = new EthernetIPDriver(PLC_IP, PLC_PORT);

  try {
    console.log('Step 1: Analyzing Register Session (WORKING)...');
    const regSession = buildRegisterSession(1, 0);
    console.log(hexDumpBuffer(regSession, 'Register Session Request'));
    console.log('\nStructure:');
    console.log('  [0-1]   Command: 0x0065 (Register Session)');
    console.log('  [2-3]   Length: 4');
    console.log('  [4-7]   Session Handle: 0 (new session)');
    console.log('  [8-11]  Status: 0');
    console.log('  [12-19] Sender Context: (8 bytes)');
    console.log('  [20-23] Options: 0');
    console.log('  [24-27] Protocol Version: 1');
    console.log('  [28-29] Options Flags: 0');

    console.log('\n\nStep 2: Connecting to PLC...');
    await driver.connect();
    console.log('✓ Connected! Session Handle:', driver.getSessionHandle());
    
    console.log('\n\nStep 3: Analyzing SendRRData (FAILING)...');
    
    // Build a minimal SendRRData request manually to see exact structure
    const sessionHandle = driver.getSessionHandle();
    
    // Test 1: Minimal path - just Message Router
    console.log('\n--- Test 1: Minimal Message Router path only ---');
    const msgRouterPath = buildMessageRouterPath(); // 20 02 24 00
    console.log('Message Router Path:', msgRouterPath.toString('hex'));
    
    // Build SendRRData manually
    const interfaceHandle = Buffer.alloc(4);
    interfaceHandle.writeUInt16LE(0, 0); // Handle
    interfaceHandle.writeUInt16LE(0, 2); // Timeout
    
    const cipPath = msgRouterPath;
    const paddedPath = cipPath.length % 2 === 0 ? cipPath : Buffer.concat([cipPath, Buffer.from([0])]);
    const pathSize = paddedPath.length / 2;
    
    const cipService = CIP_SERVICES.READ_TAG;
    const cipData = toUInt16LE(1); // Element count = 1
    
    const cipPacket = Buffer.concat([
      Buffer.from([cipService]),
      Buffer.from([pathSize]),
      paddedPath,
      cipData
    ]);
    
    const rrData = Buffer.concat([
      interfaceHandle,
      toUInt16LE(cipPacket.length),
      cipPacket
    ]);
    
    const senderContext = Buffer.alloc(8, 0); // All zeros
    const header = buildEIPHeader(EIP_COMMANDS.SEND_RR_DATA, rrData.length, sessionHandle, 0, senderContext);
    const sendRRDataRequest = Buffer.concat([header, rrData]);
    
    console.log(hexDumpBuffer(sendRRDataRequest, 'SendRRData Request'));
    console.log('\nStructure:');
    console.log('  [0-1]   Command: 0x006F (SendRRData)');
    console.log(`  [2-3]   Length: ${rrData.length}`);
    console.log(`  [4-7]   Session Handle: ${sessionHandle}`);
    console.log('  [8-11]  Status: 0');
    console.log('  [12-19] Sender Context: (8 bytes, all zeros)');
    console.log('  [20-23] Options: 0');
    console.log('  [24-27] Interface Handle: 0x00000000');
    console.log(`  [28-29] CIP Length: ${cipPacket.length}`);
    console.log(`  [30]    CIP Service: 0x${cipService.toString(16)} (Read Tag)`);
    console.log(`  [31]    Path Size: ${pathSize} words`);
    console.log(`  [32-...] CIP Path: ${paddedPath.toString('hex')}`);
    console.log(`  [...-...] Element Count: 1`);
    
    // Test 2: Try with tag path but no Message Router
    console.log('\n\n--- Test 2: Tag path without Message Router ---');
    const tagPath = buildPath(TAG_NAME, false, false);
    console.log('Tag Path:', tagPath.toString('hex'));
    
    const paddedTagPath = tagPath.length % 2 === 0 ? tagPath : Buffer.concat([tagPath, Buffer.from([0])]);
    const tagPathSize = paddedTagPath.length / 2;
    
    const tagCipPacket = Buffer.concat([
      Buffer.from([cipService]),
      Buffer.from([tagPathSize]),
      paddedTagPath,
      cipData
    ]);
    
    const tagRrData = Buffer.concat([
      interfaceHandle,
      toUInt16LE(tagCipPacket.length),
      tagCipPacket
    ]);
    
    const tagHeader = buildEIPHeader(EIP_COMMANDS.SEND_RR_DATA, tagRrData.length, sessionHandle, 0, senderContext);
    const tagRequest = Buffer.concat([tagHeader, tagRrData]);
    
    console.log(hexDumpBuffer(tagRequest, 'SendRRData Request (Tag Only)'));
    
    // Test 3: Compare sender context
    console.log('\n\n--- Test 3: Comparing Sender Context ---');
    const regSessionContext = regSession.slice(12, 20);
    console.log('Register Session Sender Context:', regSessionContext.toString('hex'));
    console.log('SendRRData Sender Context (zeros):', senderContext.toString('hex'));
    
    // Test 4: Try with matching sender context from Register Session
    console.log('\n\n--- Test 4: SendRRData with Register Session sender context ---');
    const matchingContextRequest = Buffer.concat([
      buildEIPHeader(EIP_COMMANDS.SEND_RR_DATA, rrData.length, sessionHandle, 0, regSessionContext),
      rrData
    ]);
    console.log(hexDumpBuffer(matchingContextRequest, 'SendRRData with Matching Context'));
    
    // Test 5: Try with different options field
    console.log('\n\n--- Test 5: SendRRData with different options ---');
    const headerWithOptions = Buffer.alloc(24);
    toUInt16LE(EIP_COMMANDS.SEND_RR_DATA).copy(headerWithOptions, 0);
    toUInt16LE(rrData.length).copy(headerWithOptions, 2);
    toUInt32LE(sessionHandle).copy(headerWithOptions, 4);
    toUInt32LE(0).copy(headerWithOptions, 8);
    senderContext.copy(headerWithOptions, 12);
    toUInt32LE(0).copy(headerWithOptions, 20); // Options = 0
    const optionsRequest = Buffer.concat([headerWithOptions, rrData]);
    console.log(hexDumpBuffer(optionsRequest, 'SendRRData with Options=0'));
    
    // Test 6: Try Get_Attribute_All on Message Router itself (minimal CIP request)
    console.log('\n\n--- Test 6: Get_Attribute_All on Message Router (minimal CIP) ---');
    const msgRouterOnlyPath = buildMessageRouterPath(); // 20 02 24 00
    const paddedMRPath = msgRouterOnlyPath.length % 2 === 0 ? msgRouterOnlyPath : Buffer.concat([msgRouterOnlyPath, Buffer.from([0])]);
    const mrPathSize = paddedMRPath.length / 2;
    
    const mrCipPacket = Buffer.concat([
      Buffer.from([CIP_SERVICES.GET_ATTRIBUTE_ALL]),
      Buffer.from([mrPathSize]),
      paddedMRPath
      // No CIP data for Get_Attribute_All
    ]);
    
    const mrRrData = Buffer.concat([
      interfaceHandle,
      toUInt16LE(mrCipPacket.length),
      mrCipPacket
    ]);
    
    const mrHeader = buildEIPHeader(EIP_COMMANDS.SEND_RR_DATA, mrRrData.length, sessionHandle, 0, senderContext);
    const mrRequest = Buffer.concat([mrHeader, mrRrData]);
    
    console.log(hexDumpBuffer(mrRequest, 'SendRRData Request (Get_Attribute_All on Message Router)'));
    console.log('\nTrying to send this request...');
    try {
      const mrResponse = await driver.connection.sendRequest(mrRequest);
      console.log('✓ SUCCESS! Get_Attribute_All on Message Router worked!');
      console.log('Response length:', mrResponse.length);
      console.log('This means explicit messaging CAN work, but something about tag reads is wrong.');
    } catch (error) {
      console.log('✗ FAILED:', error.message);
      console.log('Even Get_Attribute_All on Message Router fails with 0x03.');
      console.log('This confirms the issue is in the SendRRData structure itself.');
    }
    
    // Test 7: Try Identity object through Message Router
    console.log('\n\n--- Test 7: Identity object path through Message Router ---');
    const identityPath = Buffer.alloc(4);
    identityPath[0] = 0x20; // 8-bit logical, class
    identityPath[1] = 0x01; // Class 1 (Identity)
    identityPath[2] = 0x24; // 8-bit logical, instance
    identityPath[3] = 1; // Instance 1
    
    // Route through Message Router: Message Router path + Identity path
    const routedIdentityPath = Buffer.concat([msgRouterOnlyPath, identityPath]);
    const paddedRoutedPath = routedIdentityPath.length % 2 === 0 ? routedIdentityPath : Buffer.concat([routedIdentityPath, Buffer.from([0])]);
    const routedPathSize = paddedRoutedPath.length / 2;
    
    const routedCipPacket = Buffer.concat([
      Buffer.from([CIP_SERVICES.GET_ATTRIBUTE_ALL]),
      Buffer.from([routedPathSize]),
      paddedRoutedPath
    ]);
    
    const routedRrData = Buffer.concat([
      interfaceHandle,
      toUInt16LE(routedCipPacket.length),
      routedCipPacket
    ]);
    
    const routedHeader = buildEIPHeader(EIP_COMMANDS.SEND_RR_DATA, routedRrData.length, sessionHandle, 0, senderContext);
    const routedRequest = Buffer.concat([routedHeader, routedRrData]);
    
    console.log(hexDumpBuffer(routedRequest, 'SendRRData Request (Identity through Message Router)'));
    console.log('\nTrying to send this request...');
    try {
      const routedResponse = await driver.connection.sendRequest(routedRequest);
      console.log('✓ SUCCESS! Identity through Message Router worked!');
      console.log('Response length:', routedResponse.length);
    } catch (error) {
      console.log('✗ FAILED:', error.message);
    }
    
    console.log('\n\n=== Summary ===');
    console.log('All requests above have the same structure but different variations.');
    console.log('The 0x03 error suggests the PLC is rejecting the SendRRData structure itself.');
    console.log('\nPossible issues:');
    console.log('1. CODESYS may require a specific sender context format');
    console.log('2. CODESYS may require non-zero options field');
    console.log('3. CODESYS may require a different interface handle format');
    console.log('4. CODESYS may require explicit messaging to be enabled in PLC configuration');
    console.log('5. The CIP path structure may need to be different for CODESYS');
    console.log('6. CODESYS may have a bug or limitation with SendRRData');
    console.log('\nNext steps:');
    console.log('- Capture a working request from another tool (Wireshark)');
    console.log('- Compare byte-by-byte with our requests');
    console.log('- Check CODESYS documentation for EtherNet/IP explicit messaging requirements');
    console.log('- Verify PLC configuration allows explicit messaging');
    
  } catch (error) {
    console.error(`✗ Error: ${error.message}`);
    console.error(error.stack);
  } finally {
    await driver.disconnect();
    console.log('\n=== Complete ===');
  }
}

deepDiagnostic().catch(console.error);

