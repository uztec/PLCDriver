/**
 * Example: Read Tag with Verbose Debugging
 * 
 * This example shows detailed debugging information to help diagnose issues.
 * 
 * Usage:
 *   DEBUG=ethernetip:* node examples/readTagVerbose.js
 */

import EthernetIPDriver from '../index.js';
import { hexDump, analyzePath } from '../src/debugUtils.js';
import { buildPath, buildPathSymbolic, buildPath16Bit } from '../src/utils.js';
import { buildReadTagRequest, parseEIPHeader } from '../src/message.js';
import { fromUInt16LE } from '../src/utils.js';

// PLC Configuration
const PLC_IP = '10.88.48.100';
const PLC_PORT = 44818;
const TAG_NAME = 'INT1_RUN';

// Common tag name prefixes to try
const TAG_PREFIXES = [
  '',
  'Application.GVL.',
  'GVL.',
  'Application.',
  'Program:MainProgram.',
  'MainProgram.'
];

async function main() {
  console.log('=== Reading Tag with Verbose Debugging ===\n');
  console.log(`PLC: ${PLC_IP}:${PLC_PORT}`);
  console.log(`Tag: ${TAG_NAME}\n`);

  const driver = new EthernetIPDriver(PLC_IP, PLC_PORT, {
    timeout: 5000
  });

  try {
    // Connect
    console.log('Connecting to PLC...');
    await driver.connect();
    console.log('✓ Connected!\n');
    console.log(`Session Handle: ${driver.getSessionHandle()}\n`);

    // Try different combinations
    for (const prefix of TAG_PREFIXES) {
      const fullTagName = prefix + TAG_NAME;
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Trying tag: "${fullTagName}"`);
      console.log('='.repeat(60));
      
      // Try different path formats
      const formats = [
        { name: 'default', builder: buildPath },
        { name: 'symbolic', builder: buildPathSymbolic },
        { name: '16bit', builder: buildPath16Bit }
      ];
      
      for (const format of formats) {
        console.log(`\n--- Path Format: ${format.name} ---`);
        
        try {
          // Build path
          const cipPath = format.builder(fullTagName);
          const pathAnalysis = analyzePath(cipPath);
          
          console.log('Path Analysis:');
          console.log(`  Length: ${pathAnalysis.length} bytes`);
          console.log(`  Hex: ${pathAnalysis.hex}`);
          console.log('  Segments:');
          pathAnalysis.segments.forEach((seg, idx) => {
            console.log(`    ${idx + 1}. ${seg.type}: "${seg.name || 'N/A'}" (${seg.length} bytes)`);
            console.log(`       Bytes: ${seg.bytes}`);
          });
          
          // Build request
          const request = buildReadTagRequest(
            driver.getSessionHandle(),
            fullTagName,
            1,
            format.name
          );
          
          console.log('\nRequest Details:');
          console.log(`  Total length: ${request.length} bytes`);
          console.log(`  First 64 bytes:`);
          console.log(hexDump(request.slice(0, 64), '  '));
          
          // Try to read
          console.log('\n  Attempting read...');
          const value = await driver.readTag(fullTagName, 1, format.name);
          
          console.log(`\n  ✓ SUCCESS!`);
          console.log(`    Tag: "${fullTagName}"`);
          console.log(`    Format: ${format.name}`);
          console.log(`    Value: ${value} (${typeof value})`);
          
          // Disconnect and exit on success
          await driver.disconnect();
          console.log('\n=== Success! ===');
          process.exit(0);
          
        } catch (error) {
          console.log(`  ✗ Failed: ${error.message}`);
          
          if (error.statusCode !== undefined) {
            console.log(`    Status: ${error.statusHex || `0x${error.statusCode.toString(16)}`}`);
            console.log(`    Message: ${error.statusMessage || 'Unknown'}`);
            
            // Show response data if available
            if (error.responseData) {
              console.log(`\n    Response from PLC (${error.responseData.length} bytes):`);
              const header = parseEIPHeader(error.responseData);
              console.log(`      Command: 0x${header.command.toString(16)}`);
              console.log(`      Status: 0x${header.status.toString(16)}`);
              console.log(`      Length: ${header.length}`);
              console.log(`      First 48 bytes:`);
              console.log(hexDump(error.responseData.slice(0, 48), '      '));
            }
            
            if (error.suggestions && error.suggestions.length > 0) {
              console.log(`\n    Suggestions:`);
              error.suggestions.forEach((s, i) => {
                console.log(`      ${i + 1}. ${s}`);
              });
            }
          }
        }
      }
    }
    
    console.log('\n✗ All attempts failed');
    console.log('\nTroubleshooting:');
    console.log('1. Verify the tag exists in your PLC programming software');
    console.log('2. Check the exact tag name and path in the PLC');
    console.log('3. Try listing tags to see available names');
    console.log('4. Check PLC documentation for EtherNet/IP tag naming');
    console.log('5. The tag might require a different path format');
    
    await driver.disconnect();
    
  } catch (error) {
    console.error('\n✗ Fatal error:', error.message);
    if (driver.isConnected()) {
      await driver.disconnect();
    }
    process.exit(1);
  }
}

main();

