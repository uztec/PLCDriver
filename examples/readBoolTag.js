/**
 * Example: Connect to PLC and read a BOOL tag
 * 
 * This example demonstrates how to:
 * - Connect to a PLC
 * - Read a BOOL tag named "INT1_RUN"
 * - Handle errors gracefully
 * 
 * Usage:
 *   node examples/readBoolTag.js
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

// Path formats to try (including withRouter for PLCs that require Message Router path prefix)
const PATH_FORMATS = ['default', 'symbolic', '16bit', 'standard', 'withRouter', 'withRouterCompact'];

async function main() {
  console.log('=== Reading BOOL Tag from PLC ===\n');
  console.log(`PLC: ${PLC_IP}:${PLC_PORT}`);
  console.log(`Tag: ${TAG_NAME}\n`);

  // Create driver instance
  const driver = new EthernetIPDriver(PLC_IP, PLC_PORT, {
    timeout: 5000
  });

  try {
    // Connect to PLC
    console.log('Connecting to PLC...');
    await driver.connect();
    console.log('✓ Connected successfully!\n');

    // Read the BOOL tag
    // Try different tag name formats and path formats
    console.log(`Reading tag "${TAG_NAME}"...`);
    let value = null;
    let successfulTagName = null;
    let pathFormat = 'default';
    let found = false;
    
    // Try different tag name prefixes
    for (const prefix of TAG_PREFIXES) {
      const fullTagName = prefix + TAG_NAME;
      console.log(`\n  Trying tag name: "${fullTagName}"`);
      
      // Try different path formats for each tag name
      for (const format of PATH_FORMATS) {
        try {
          value = await driver.readTag(fullTagName, 1, format);
          successfulTagName = fullTagName;
          pathFormat = format;
          found = true;
          console.log(`    ✓ Success with format "${format}"!`);
          break;
        } catch (error) {
          // Continue to next format
          if (format === 'default') {
            const shortError = error.message.split('\n')[0];
            console.log(`    ✗ ${format} format failed: ${shortError.substring(0, 60)}...`);
          }
        }
      }
      
      if (found) {
        break;
      }
    }
    
    if (!found) {
      console.log('\n  ✗ All tag name formats and path formats failed');
      console.log('\n  Tried the following tag names:');
      TAG_PREFIXES.forEach(prefix => {
        console.log(`    - "${prefix}${TAG_NAME}"`);
      });
      throw new Error(`Could not read tag "${TAG_NAME}" with any format`);
    }
    
    console.log(`\n✓ Success! Tag: "${successfulTagName}" (format: ${pathFormat})`);
    console.log(`  Tag value: ${value}`);
    console.log(`  Type: ${typeof value} (BOOL)`);
    console.log(`  Value: ${value ? 'TRUE' : 'FALSE'}`);
    
    // You can also check the value
    if (value === true) {
      console.log('\n  → INT1_RUN is ON');
    } else {
      console.log('\n  → INT1_RUN is OFF');
    }
    
    console.log(`\n  Note: Use tag name "${successfulTagName}" for future reads`);

    // Disconnect
    console.log('\nDisconnecting...');
    await driver.disconnect();
    console.log('✓ Disconnected');
    
    console.log('\n=== Complete ===');

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    
    // Show detailed error information if available
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
    
    // Provide helpful error messages
    if (error.message.includes('Not connected')) {
      console.error('\n  Connection failed. Check:');
      console.error('    - PLC IP address is correct');
      console.error('    - PLC is powered on');
      console.error('    - Network connectivity');
      console.error('    - Firewall settings (port 44818)');
    } else if (error.message.includes('CIP error')) {
      console.error('\n  Tag error. Check:');
      console.error(`    - Tag "${TAG_NAME}" exists in the PLC`);
      console.error('    - Tag name is correct (case-sensitive)');
      console.error('    - You have read permissions for the tag');
    } else if (error.message.includes('timeout')) {
      console.error('\n  Request timeout. Check:');
      console.error('    - Network connectivity');
      console.error('    - PLC is responding');
      console.error('    - Try increasing timeout');
    } else if (error.message.includes('Invalid parameter') || error.statusCode === 0x03) {
      console.error('\n  Invalid parameter error (0x03). This usually means:');
      console.error('    - Protocol version mismatch');
      console.error('    - PLC requires different Register Session format');
      console.error('    - Some PLCs need protocol version 2 instead of 1');
      console.error('\n  Try:');
      console.error('    - Check PLC documentation for supported protocol version');
      console.error('    - Contact PLC manufacturer for EtherNet/IP configuration');
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

