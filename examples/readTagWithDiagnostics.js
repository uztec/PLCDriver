/**
 * Example: Read Tag with Diagnostics and Alternative Path Formats
 * 
 * This example tries different path formats if the default fails.
 * Some PLCs require different CIP path encoding.
 * 
 * Usage:
 *   node examples/readTagWithDiagnostics.js
 */

import EthernetIPDriver from '../index.js';

// PLC Configuration
const PLC_IP = '10.88.48.100'; // Replace with your PLC's IP address
const PLC_PORT = 44818;
const TAG_NAME = 'INT1_RUN'; // The BOOL tag to read

// Common tag name prefixes to try
const TAG_PREFIXES = [
  '', // No prefix (just the tag name)
  'Application.GVL.',
  'GVL.',
  'Application.',
  'Program:MainProgram.',
  'MainProgram.'
];

async function main() {
  console.log('=== Reading Tag with Diagnostics ===\n');
  console.log(`PLC: ${PLC_IP}:${PLC_PORT}`);
  console.log(`Tag: ${TAG_NAME}\n`);

  const driver = new EthernetIPDriver(PLC_IP, PLC_PORT, {
    timeout: 5000
  });

  try {
    // Connect to PLC
    console.log('Connecting to PLC...');
    await driver.connect();
    console.log('✓ Connected successfully!\n');

    // Try different tag name formats and path formats
    const pathFormats = ['default', 'symbolic', '16bit'];
    let success = false;
    let lastError = null;
    let successfulTagName = null;
    let successfulFormat = null;

    // Try each tag name prefix
    for (const prefix of TAG_PREFIXES) {
      const fullTagName = prefix + TAG_NAME;
      console.log(`\nTrying tag name: "${fullTagName}"`);
      
      // Try each path format for this tag name
      for (const format of pathFormats) {
        console.log(`  Path format: ${format}...`);
        try {
          const value = await driver.readTag(fullTagName, 1, format);
          console.log(`  ✓ Success!`);
          console.log(`    Tag: "${fullTagName}"`);
          console.log(`    Format: ${format}`);
          console.log(`    Value: ${value} (${value ? 'TRUE' : 'FALSE'})`);
          console.log(`    Type: ${typeof value} (BOOL)`);
          success = true;
          successfulTagName = fullTagName;
          successfulFormat = format;
          break;
        } catch (error) {
          console.log(`    ✗ Failed: ${error.message.split('\n')[0]}`);
          lastError = error;
          
          // Show detailed error if available
          if (error.statusCode !== undefined) {
            console.log(`      Status: ${error.statusHex || `0x${error.statusCode.toString(16)}`}`);
            if (error.statusMessage) {
              console.log(`      Message: ${error.statusMessage}`);
            }
          }
        }
      }
      
      if (success) {
        break;
      }
    }

    if (!success) {
      console.log('\n✗ All tag name formats and path formats failed');
      console.log('\nTried the following tag names:');
      TAG_PREFIXES.forEach(prefix => {
        console.log(`  - "${prefix}${TAG_NAME}"`);
      });
      console.log('\nPossible issues:');
      console.log('  1. Tag name might be incorrect');
      console.log('  2. Tag might not exist in the PLC');
      console.log('  3. Tag might require a different prefix (e.g., "Application.GVL.INT1_RUN")');
      console.log('  4. Tag might be in a different namespace or program');
      console.log('  5. Tag might require different path encoding');
      console.log('\nTry:');
      console.log('  - Verify the exact tag name in your PLC programming software');
      console.log('  - Check the tag\'s full path/scope in the PLC');
      console.log('  - Try listing tags to see available tag names');
      console.log('  - Check if tag is in GVL (Global Variable List)');
      
      if (lastError) {
        throw lastError;
      }
    } else {
      console.log(`\n✓ Success! Use tag name "${successfulTagName}" with format "${successfulFormat}"`);
    }

    // Disconnect
    console.log('\nDisconnecting...');
    await driver.disconnect();
    console.log('✓ Disconnected');
    console.log('\n=== Complete ===');

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    
    if (error.statusCode !== undefined) {
      console.error(`\n  Status Code: ${error.statusHex || `0x${error.statusCode.toString(16)}`}`);
      console.error(`  Status Message: ${error.statusMessage || 'Unknown'}`);
      
      if (error.suggestions && error.suggestions.length > 0) {
        console.error('\n  Suggestions:');
        error.suggestions.forEach((suggestion, index) => {
          console.error(`    ${index + 1}. ${suggestion}`);
        });
      }
    }
    
    // Try to disconnect if still connected
    if (driver.isConnected()) {
      try {
        await driver.disconnect();
      } catch (disconnectError) {
        // Ignore disconnect errors
      }
    }
    
    process.exit(1);
  }
}

main();

