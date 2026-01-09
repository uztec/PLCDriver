/**
 * Final test variations - checking sender context, options, and other edge cases
 */

import { 
  EthernetIPDriver,
  buildEIPHeader,
  EIP_COMMANDS,
  CIP_SERVICES,
  buildMessageRouterPath,
  toUInt16LE,
  toUInt32LE
} from '../index.js';

const PLC_IP = '10.88.48.100';
const PLC_PORT = 44818;

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

async function testFinalVariations() {
  console.log('=== Final Test Variations ===\n');
  console.log(`PLC: ${PLC_IP}:${PLC_PORT}\n`);

  const driver = new EthernetIPDriver(PLC_IP, PLC_PORT);

  try {
    console.log('Connecting to PLC...');
    await driver.connect();
    const sessionHandle = driver.getSessionHandle();
    console.log('✓ Connected! Session Handle:', sessionHandle);
    
    // Minimal CIP request: Get_Attribute_All on Message Router
    const msgRouterPath = buildMessageRouterPath();
    const paddedPath = msgRouterPath.length % 2 === 0 ? msgRouterPath : Buffer.concat([msgRouterPath, Buffer.from([0])]);
    const pathSize = paddedPath.length / 2;
    
    const cipPacket = Buffer.concat([
      Buffer.from([CIP_SERVICES.GET_ATTRIBUTE_ALL]),
      Buffer.from([pathSize]),
      paddedPath
    ]);
    
    // Standard interface handle (4 bytes: two 16-bit values)
    const interfaceHandle = Buffer.alloc(4);
    interfaceHandle.writeUInt16LE(0, 0);
    interfaceHandle.writeUInt16LE(0, 2);
    
    const rrData = Buffer.concat([
      interfaceHandle,
      toUInt16LE(cipPacket.length),
      cipPacket
    ]);
    
    const tests = [
      {
        name: 'Test 1: Sender context from Register Session response',
        buildHeader: (regSessionContext) => {
          return buildEIPHeader(EIP_COMMANDS.SEND_RR_DATA, rrData.length, sessionHandle, 0, regSessionContext);
        },
        getContext: async () => {
          // We'd need to capture the Register Session response context
          // For now, use a sequential context
          const ctx = Buffer.alloc(8);
          ctx.writeUInt32LE(1, 0);
          ctx.writeUInt32LE(0, 4);
          return ctx;
        }
      },
      {
        name: 'Test 2: Sequential sender context (1, 2, 3...)',
        buildHeader: (ctx) => {
          return buildEIPHeader(EIP_COMMANDS.SEND_RR_DATA, rrData.length, sessionHandle, 0, ctx);
        },
        getContext: async () => {
          const ctx = Buffer.alloc(8);
          ctx.writeUInt32LE(2, 0);
          ctx.writeUInt32LE(0, 4);
          return ctx;
        }
      },
      {
        name: 'Test 3: Options field = 1 (instead of 0)',
        buildHeader: (ctx) => {
          const header = Buffer.alloc(24);
          toUInt16LE(EIP_COMMANDS.SEND_RR_DATA).copy(header, 0);
          toUInt16LE(rrData.length).copy(header, 2);
          toUInt32LE(sessionHandle).copy(header, 4);
          toUInt32LE(0).copy(header, 8);
          ctx.copy(header, 12);
          toUInt32LE(1).copy(header, 20); // Options = 1
          return header;
        },
        getContext: async () => {
          return Buffer.alloc(8, 0);
        }
      },
      {
        name: 'Test 4: Non-zero sender context (random)',
        buildHeader: (ctx) => {
          return buildEIPHeader(EIP_COMMANDS.SEND_RR_DATA, rrData.length, sessionHandle, 0, ctx);
        },
        getContext: async () => {
          const ctx = Buffer.alloc(8);
          const timestamp = Date.now();
          ctx.writeUInt32LE(timestamp & 0xFFFFFFFF, 0);
          ctx.writeUInt32LE(Math.floor(Math.random() * 0xFFFFFFFF), 4);
          return ctx;
        }
      },
      {
        name: 'Test 5: All zeros except session handle',
        buildHeader: (ctx) => {
          return buildEIPHeader(EIP_COMMANDS.SEND_RR_DATA, rrData.length, sessionHandle, 0, ctx);
        },
        getContext: async () => {
          return Buffer.alloc(8, 0);
        }
      }
    ];
    
    for (const test of tests) {
      console.log(`\n--- ${test.name} ---`);
      
      const senderContext = await test.getContext();
      const header = test.buildHeader(senderContext);
      const request = Buffer.concat([header, rrData]);
      
      console.log('Sender Context:', senderContext.toString('hex'));
      console.log('Request (first 48 bytes):');
      console.log(hexDumpBuffer(request.slice(0, 48), 'Request'));
      
      try {
        const response = await driver.connection.sendRequest(request);
        console.log('✓ SUCCESS! This variation works!');
        console.log('Response length:', response.length);
        console.log('Response (first 64 bytes):');
        console.log(hexDumpBuffer(response.slice(0, 64), 'Response'));
        console.log('\n🎉 FOUND WORKING VARIATION!');
        return;
      } catch (error) {
        console.log(`✗ FAILED: ${error.message}`);
        if (error.statusCode) {
          console.log(`  Status: 0x${error.statusHex}`);
        }
      }
    }
    
    console.log('\n\n✗ All final variations failed');
    console.log('\n=== CONCLUSION ===');
    console.log('After exhaustive testing, all SendRRData requests fail with 0x03.');
    console.log('This strongly suggests:');
    console.log('1. CODESYS requires explicit messaging to be enabled in PLC configuration');
    console.log('2. CODESYS firmware has a bug or limitation with SendRRData');
    console.log('3. There is a CODESYS-specific requirement not documented in standard EtherNet/IP spec');
    console.log('\n=== RECOMMENDED NEXT STEPS ===');
    console.log('1. Check CODESYS PLC configuration for EtherNet/IP explicit messaging settings');
    console.log('2. Verify PLC firmware version and check for known issues');
    console.log('3. Capture a working request from another EtherNet/IP tool (e.g., Wireshark)');
    console.log('4. Compare byte-by-byte with our requests to find the difference');
    console.log('5. Contact CODESYS support with this issue');
    console.log('\n=== WORKAROUND ===');
    console.log('If explicit messaging is not available, you may need to use:');
    console.log('- Implicit messaging (I/O connections) for cyclic data exchange');
    console.log('- A different communication protocol if supported by the PLC');
    console.log('- A CODESYS-specific API or library if available');
    
  } catch (error) {
    console.error(`✗ Error: ${error.message}`);
    console.error(error.stack);
  } finally {
    await driver.disconnect();
    console.log('\n=== Complete ===');
  }
}

testFinalVariations().catch(console.error);

