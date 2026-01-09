/**
 * Debug Request - Show exact bytes being sent
 * 
 * This example shows the exact request bytes being sent to the PLC.
 * Use this to compare with a working EtherNet/IP client (like Wireshark capture).
 * 
 * Usage:
 *   node examples/debugRequest.js
 */

import { buildReadTagRequest, parseEIPHeader } from '../src/message.js';
import { buildPath, buildPathSymbolic, buildPath16Bit } from '../src/utils.js';
import { hexDump, analyzePath } from '../src/debugUtils.js';
import { fromUInt16LE } from '../src/utils.js';

const TAG_NAME = 'INT1_RUN';
const SESSION_HANDLE = 1234567890; // Example session handle

console.log('=== Debugging Read Tag Request ===\n');
console.log(`Tag: ${TAG_NAME}\n`);

// Test different tag name formats
const tagNames = [
  TAG_NAME,
  `Application.GVL.${TAG_NAME}`,
  `GVL.${TAG_NAME}`
];

// Test different path formats
const pathFormats = [
  { name: 'default', builder: buildPath },
  { name: 'symbolic', builder: buildPathSymbolic },
  { name: '16bit', builder: buildPath16Bit }
];

for (const tagName of tagNames) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Tag Name: "${tagName}"`);
  console.log('='.repeat(70));
  
  for (const format of pathFormats) {
    console.log(`\n--- Path Format: ${format.name} ---`);
    
    // Build path
    const cipPath = format.builder(tagName);
    const pathAnalysis = analyzePath(cipPath);
    
    console.log('CIP Path:');
    console.log(`  Length: ${cipPath.length} bytes`);
    console.log(`  Hex: ${cipPath.toString('hex').toUpperCase()}`);
    console.log('  Segments:');
    pathAnalysis.segments.forEach((seg, idx) => {
      console.log(`    ${idx + 1}. Type: ${seg.type}`);
      console.log(`       Format: ${seg.format}`);
      if (seg.name) {
        console.log(`       Name: "${seg.name}"`);
        console.log(`       Length: ${seg.length} bytes`);
      }
      console.log(`       Bytes: ${seg.bytes}`);
    });
    
    // Build full request
    const request = buildReadTagRequest(SESSION_HANDLE, tagName, 1, format.name);
    
    // Parse EIP header
    const header = parseEIPHeader(request);
    
    console.log('\nEtherNet/IP Header:');
    console.log(`  Command: 0x${header.command.toString(16).padStart(4, '0')}`);
    console.log(`  Length: ${header.length} bytes`);
    console.log(`  Session Handle: ${header.sessionHandle}`);
    console.log(`  Status: 0x${header.status.toString(16).padStart(8, '0')}`);
    
    // Parse CIP packet (starts at offset 24 + 6 = 30)
    const rrDataOffset = 24;
    const interfaceHandle = request.readUInt32LE(rrDataOffset);
    const cipLength = fromUInt16LE(request, rrDataOffset + 4);
    const cipPacket = request.slice(rrDataOffset + 6, rrDataOffset + 6 + cipLength);
    
    console.log('\nCIP Packet:');
    console.log(`  Interface Handle: ${interfaceHandle}`);
    console.log(`  CIP Length: ${cipLength} bytes`);
    console.log(`  Service: 0x${cipPacket[0].toString(16).padStart(2, '0')} (Read Tag)`);
    console.log(`  Path Size: ${cipPacket[1]} words (${cipPacket[1] * 2} bytes)`);
    console.log(`  Path: ${cipPacket.slice(2, 2 + cipPacket[1] * 2).toString('hex').toUpperCase()}`);
    console.log(`  Element Count: ${fromUInt16LE(cipPacket, 2 + cipPacket[1] * 2)}`);
    
    console.log('\nFull Request (hex):');
    console.log(hexDump(request, '  '));
    
    console.log('\nFull Request Structure:');
    console.log(`  [0-23]   EIP Header (24 bytes)`);
    console.log(`  [24-27]  Interface Handle (4 bytes): ${interfaceHandle}`);
    console.log(`  [28-29]  CIP Length (2 bytes): ${cipLength}`);
    console.log(`  [30]     CIP Service (1 byte): 0x${cipPacket[0].toString(16)}`);
    console.log(`  [31]     Path Size (1 byte): ${cipPacket[1]}`);
    console.log(`  [32-...] CIP Path (${cipPacket[1] * 2} bytes)`);
    console.log(`  [...-...] Element Count (2 bytes): 1`);
  }
}

console.log('\n\n=== Analysis ===');
console.log('Compare the hex output above with a working EtherNet/IP client.');
console.log('Key things to check:');
console.log('  1. Path encoding format (0x91 vs other formats)');
console.log('  2. Path size calculation (must be in 16-bit words)');
console.log('  3. Path padding (must be word-aligned)');
console.log('  4. Element count position and format');

