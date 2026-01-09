/**
 * Test different SendRRData structure variations
 * According to EtherNet/IP spec, SendRRData may have:
 * - Option 1: Interface Handle (4 bytes) + Timeout (2 bytes) = 6 bytes
 * - Option 2: Interface Handle (4 bytes) where timeout is part of it = 4 bytes
 * Let's test both
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

async function testSendRRDataStructures() {
  console.log('=== Testing Different SendRRData Structures ===\n');
  console.log(`PLC: ${PLC_IP}:${PLC_PORT}\n`);

  const driver = new EthernetIPDriver(PLC_IP, PLC_PORT);

  try {
    console.log('Connecting to PLC...');
    await driver.connect();
    console.log('✓ Connected! Session Handle:', driver.getSessionHandle());
    
    const sessionHandle = driver.getSessionHandle();
    const senderContext = Buffer.alloc(8, 0);
    
    // Minimal CIP request: Get_Attribute_All on Message Router
    const msgRouterPath = buildMessageRouterPath(); // 20 02 24 00
    const paddedPath = msgRouterPath.length % 2 === 0 ? msgRouterPath : Buffer.concat([msgRouterPath, Buffer.from([0])]);
    const pathSize = paddedPath.length / 2;
    
    const cipService = CIP_SERVICES.GET_ATTRIBUTE_ALL;
    const cipPacket = Buffer.concat([
      Buffer.from([cipService]),
      Buffer.from([pathSize]),
      paddedPath
    ]);
    
    const tests = [
      {
        name: 'Structure 1: Interface Handle (4 bytes) + Timeout (2 bytes) = 6 bytes total',
        buildRRData: () => {
          const interfaceHandle = Buffer.alloc(4);
          interfaceHandle.writeUInt32LE(0, 0); // Interface handle = 0
          
          const timeout = toUInt16LE(0); // Timeout = 0
          
          return Buffer.concat([
            interfaceHandle,
            timeout,
            toUInt16LE(cipPacket.length),
            cipPacket
          ]);
        }
      },
      {
        name: 'Structure 2: Interface Handle (4 bytes, two 16-bit values: handle=0, timeout=0)',
        buildRRData: () => {
          const interfaceHandle = Buffer.alloc(4);
          interfaceHandle.writeUInt16LE(0, 0); // Handle
          interfaceHandle.writeUInt16LE(0, 2); // Timeout
          
          return Buffer.concat([
            interfaceHandle,
            toUInt16LE(cipPacket.length),
            cipPacket
          ]);
        }
      },
      {
        name: 'Structure 3: Interface Handle (4 bytes, single 32-bit value = 0)',
        buildRRData: () => {
          const interfaceHandle = Buffer.alloc(4);
          interfaceHandle.writeUInt32LE(0, 0);
          
          return Buffer.concat([
            interfaceHandle,
            toUInt16LE(cipPacket.length),
            cipPacket
          ]);
        }
      },
      {
        name: 'Structure 4: Interface Handle (4 bytes) + Timeout (2 bytes) with timeout=5000ms',
        buildRRData: () => {
          const interfaceHandle = Buffer.alloc(4);
          interfaceHandle.writeUInt32LE(0, 0);
          
          const timeout = toUInt16LE(5000); // 5 seconds
          
          return Buffer.concat([
            interfaceHandle,
            timeout,
            toUInt16LE(cipPacket.length),
            cipPacket
          ]);
        }
      },
      {
        name: 'Structure 5: Interface Handle (2 bytes) + Timeout (2 bytes) = 4 bytes total',
        buildRRData: () => {
          const interfaceHandle = Buffer.alloc(2);
          interfaceHandle.writeUInt16LE(0, 0); // Handle
          
          const timeout = toUInt16LE(0); // Timeout
          
          return Buffer.concat([
            interfaceHandle,
            timeout,
            toUInt16LE(cipPacket.length),
            cipPacket
          ]);
        }
      }
    ];
    
    for (const test of tests) {
      console.log(`\n--- ${test.name} ---`);
      
      const rrData = test.buildRRData();
      const header = buildEIPHeader(EIP_COMMANDS.SEND_RR_DATA, rrData.length, sessionHandle, 0, senderContext);
      const request = Buffer.concat([header, rrData]);
      
      console.log(hexDumpBuffer(request, 'Request'));
      console.log(`\nRRData length: ${rrData.length} bytes`);
      console.log(`Total request length: ${request.length} bytes`);
      
      try {
        const response = await driver.connection.sendRequest(request);
        console.log('✓ SUCCESS! This structure works!');
        console.log('Response length:', response.length);
        console.log('Response (first 64 bytes):');
        console.log(hexDumpBuffer(response.slice(0, 64), 'Response'));
        console.log('\n🎉 FOUND WORKING STRUCTURE!');
        return; // Stop on first success
      } catch (error) {
        console.log(`✗ FAILED: ${error.message}`);
        if (error.statusCode) {
          console.log(`  Status: 0x${error.statusHex}`);
        }
      }
    }
    
    console.log('\n\n✗ All structure variations failed');
    console.log('\nThis suggests the issue may be:');
    console.log('1. CODESYS requires explicit messaging to be enabled in PLC configuration');
    console.log('2. CODESYS has a bug or limitation with SendRRData');
    console.log('3. The PLC firmware version has specific requirements');
    console.log('4. We need to capture a working request from another tool for comparison');
    
  } catch (error) {
    console.error(`✗ Error: ${error.message}`);
    console.error(error.stack);
  } finally {
    await driver.disconnect();
    console.log('\n=== Complete ===');
  }
}

testSendRRDataStructures().catch(console.error);

