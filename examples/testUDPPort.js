/**
 * Test UDP port 2222 - typically used for implicit messaging (I/O connections)
 * Note: Explicit messaging (SendRRData) is always TCP, but let's test if CODESYS
 * responds differently or has UDP-based explicit messaging
 */

import { Socket } from 'net';
import { createSocket } from 'dgram';
import { 
  buildRegisterSession,
  buildEIPHeader,
  buildSendRRData,
  parseEIPHeader,
  EIP_COMMANDS,
  CIP_SERVICES,
  buildMessageRouterPath,
  toUInt16LE
} from '../index.js';

const PLC_IP = '10.88.48.100';
const EXPLICIT_PORT = 44818; // Standard explicit messaging port (TCP)
const IMPLICIT_PORT = 2222;   // Standard implicit messaging port (UDP)

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

async function testUDPPort() {
  console.log('=== Testing UDP Port 2222 ===\n');
  console.log(`PLC: ${PLC_IP}`);
  console.log(`Testing: UDP port ${IMPLICIT_PORT} (implicit messaging port)\n`);

  // Test 1: Try UDP for explicit messaging (unusual but worth testing)
  console.log('--- Test 1: SendRRData over UDP (unusual) ---');
  
  return new Promise((resolve) => {
    const udpSocket = createSocket('udp4');
    let receivedResponse = false;
    
    udpSocket.on('message', (msg, rinfo) => {
      receivedResponse = true;
      console.log(`✓ Received UDP response from ${rinfo.address}:${rinfo.port}`);
      console.log(`Response length: ${msg.length} bytes`);
      console.log(hexDumpBuffer(msg.slice(0, 64), 'UDP Response'));
      
      if (msg.length >= 24) {
        try {
          const header = parseEIPHeader(msg);
          console.log('\nEIP Header:');
          console.log(`  Command: 0x${header.command.toString(16)}`);
          console.log(`  Length: ${header.length}`);
          console.log(`  Session Handle: ${header.sessionHandle}`);
          console.log(`  Status: 0x${header.status.toString(16)}`);
          
          if (header.status === 0) {
            console.log('\n✓ SUCCESS! UDP explicit messaging works!');
          } else {
            console.log(`\n✗ Status error: 0x${header.status.toString(16)}`);
          }
        } catch (error) {
          console.log('Could not parse response:', error.message);
        }
      }
      
      udpSocket.close();
      resolve();
    });
    
    udpSocket.on('error', (error) => {
      console.log(`✗ UDP error: ${error.message}`);
      udpSocket.close();
      resolve();
    });
    
    // Try to send a minimal SendRRData request over UDP
    // Note: This is unusual - explicit messaging is typically TCP only
    const msgRouterPath = buildMessageRouterPath();
    const paddedPath = msgRouterPath.length % 2 === 0 ? msgRouterPath : Buffer.concat([msgRouterPath, Buffer.from([0])]);
    const pathSize = paddedPath.length / 2;
    
    const cipPacket = Buffer.concat([
      Buffer.from([CIP_SERVICES.GET_ATTRIBUTE_ALL]),
      Buffer.from([pathSize]),
      paddedPath
    ]);
    
    const interfaceHandle = Buffer.alloc(4);
    interfaceHandle.writeUInt16LE(0, 0);
    interfaceHandle.writeUInt16LE(0, 2);
    
    const rrData = Buffer.concat([
      interfaceHandle,
      toUInt16LE(cipPacket.length),
      cipPacket
    ]);
    
    // For UDP, we might need a session handle of 0 (no session registration)
    const senderContext = Buffer.alloc(8, 0);
    const header = buildEIPHeader(EIP_COMMANDS.SEND_RR_DATA, rrData.length, 0, 0, senderContext);
    const request = Buffer.concat([header, rrData]);
    
    console.log('Sending SendRRData request over UDP...');
    console.log(hexDumpBuffer(request.slice(0, 48), 'UDP Request'));
    
    udpSocket.send(request, IMPLICIT_PORT, PLC_IP, (err) => {
      if (err) {
        console.log(`✗ Send error: ${err.message}`);
        udpSocket.close();
        resolve();
      } else {
        console.log('Request sent, waiting for response...');
        // Set timeout
        setTimeout(() => {
          if (!receivedResponse) {
            console.log('✗ No response received (timeout)');
            console.log('UDP port 2222 does not respond to explicit messaging requests');
            udpSocket.close();
            resolve();
          }
        }, 3000);
      }
    });
  });
}

async function testTCPPort2222() {
  console.log('\n\n--- Test 2: TCP connection to port 2222 ---');
  console.log('Note: Port 2222 is typically UDP for implicit messaging');
  console.log('But let\'s test if CODESYS accepts TCP on this port\n');
  
  return new Promise((resolve) => {
    const socket = new Socket();
    let connected = false;
    let sessionRegistered = false;
    
    socket.setTimeout(3000);
    
    socket.on('connect', () => {
      connected = true;
      console.log('✓ TCP connection established to port 2222');
      
      // Try to register a session
      const registerRequest = buildRegisterSession();
      socket.write(registerRequest);
      console.log('Sent Register Session request...');
    });
    
    socket.on('data', (data) => {
      console.log(`Received ${data.length} bytes`);
      console.log(hexDumpBuffer(data.slice(0, 64), 'Response'));
      
      if (data.length >= 24) {
        const header = parseEIPHeader(data);
        console.log('\nEIP Header:');
        console.log(`  Command: 0x${header.command.toString(16)}`);
        console.log(`  Status: 0x${header.status.toString(16)}`);
        
        if (header.command === EIP_COMMANDS.REGISTER_SESSION) {
          if (header.status === 0) {
            sessionRegistered = true;
            console.log(`✓ Session registered! Handle: ${header.sessionHandle}`);
            
            // Try SendRRData
            const msgRouterPath = buildMessageRouterPath();
            const paddedPath = msgRouterPath.length % 2 === 0 ? msgRouterPath : Buffer.concat([msgRouterPath, Buffer.from([0])]);
            const pathSize = paddedPath.length / 2;
            
            const cipPacket = Buffer.concat([
              Buffer.from([CIP_SERVICES.GET_ATTRIBUTE_ALL]),
              Buffer.from([pathSize]),
              paddedPath
            ]);
            
            const interfaceHandle = Buffer.alloc(4);
            interfaceHandle.writeUInt16LE(0, 0);
            interfaceHandle.writeUInt16LE(0, 2);
            
            const rrData = Buffer.concat([
              interfaceHandle,
              toUInt16LE(cipPacket.length),
              cipPacket
            ]);
            
            const senderContext = Buffer.alloc(8, 0);
            const sendRRDataRequest = buildSendRRData(header.sessionHandle, CIP_SERVICES.GET_ATTRIBUTE_ALL, msgRouterPath, Buffer.alloc(0), senderContext);
            
            console.log('\nTrying SendRRData on port 2222...');
            socket.write(sendRRDataRequest);
          } else {
            console.log(`✗ Session registration failed: 0x${header.status.toString(16)}`);
          }
        } else if (header.command === EIP_COMMANDS.SEND_RR_DATA) {
          if (header.status === 0) {
            console.log('\n✓ SUCCESS! SendRRData works on TCP port 2222!');
          } else {
            console.log(`\n✗ SendRRData failed: 0x${header.status.toString(16)}`);
          }
          socket.destroy();
        }
      }
    });
    
    socket.on('timeout', () => {
      console.log('✗ Connection timeout');
      socket.destroy();
    });
    
    socket.on('error', (error) => {
      console.log(`✗ Connection error: ${error.message}`);
      socket.destroy();
    });
    
    socket.on('close', () => {
      console.log('\nConnection closed');
      resolve();
    });
    
    console.log('Attempting TCP connection to port 2222...');
    socket.connect(IMPLICIT_PORT, PLC_IP, () => {
      // Connection initiated
    });
  });
}

async function runTests() {
  try {
    await testUDPPort();
    await testTCPPort2222();
    
    console.log('\n\n=== Summary ===');
    console.log('Port 2222 is typically used for:');
    console.log('- UDP: Implicit messaging (I/O connections)');
    console.log('- Requires Forward_Open command to establish connection');
    console.log('- Cyclic data exchange, not request/response');
    console.log('\nExplicit messaging (SendRRData) is typically:');
    console.log('- TCP port 44818');
    console.log('- Request/response pattern');
    console.log('- No connection setup required (uses session)');
    console.log('\nIf port 2222 works, it might indicate:');
    console.log('1. CODESYS uses non-standard port for explicit messaging');
    console.log('2. CODESYS supports both TCP and UDP for explicit messaging');
    console.log('3. Implicit messaging might be the only option');
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error(error.stack);
  }
}

runTests().catch(console.error);

