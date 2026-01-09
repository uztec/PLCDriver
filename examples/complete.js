/**
 * Complete Example - Full workflow combining all features
 * 
 * This example demonstrates:
 * - Network discovery
 * - Connecting to a discovered PLC
 * - Tag browsing
 * - Reading and writing tags
 * - Error handling
 * - Best practices
 */

import EthernetIPDriver, { discoverPLCs } from '../index.js';

// PLC Configuration
const PLC_IP = '192.168.1.100'; // Replace with your PLC's IP address
const PLC_PORT = 44818;

async function main() {
  console.log('=== EtherNet/IP Driver - Complete Example ===\n');

  // Step 1: Discover PLCs on the network
  console.log('Step 1: Discovering PLCs on network...');
  let targetIP = null;
  
  try {
    const devices = await discoverPLCs(3000);
    
    if (devices.length === 0) {
      console.log('No PLCs found via discovery.');
      console.log(`Using default IP: ${PLC_IP}`);
      console.log('(Update PLC_IP constant in the script if needed)\n');
      targetIP = PLC_IP; // Default fallback
    } else {
      console.log(`Found ${devices.length} device(s):\n`);
      devices.forEach((device, index) => {
        console.log(`${index + 1}. ${device.productName}`);
        console.log(`   IP: ${device.ipAddress}`);
        console.log(`   Vendor ID: ${device.vendorId}`);
        console.log(`   Serial: ${device.serialNumber}\n`);
      });
      
      // Use the first discovered device
      targetIP = devices[0].ipAddress;
      console.log(`Using first discovered device: ${targetIP}\n`);
    }
  } catch (error) {
    console.error('Discovery error:', error.message);
    console.log(`Using default IP: ${PLC_IP}\n`);
    targetIP = PLC_IP;
  }

  // Step 2: Create driver and connect
  console.log('Step 2: Connecting to PLC...');
  const driver = new EthernetIPDriver(targetIP, PLC_PORT, {
    timeout: 5000
  });

  // Set up event handlers
  driver.on('connected', () => {
    console.log('✓ Connected event received');
  });

  driver.on('disconnected', () => {
    console.log('✓ Disconnected event received');
  });

  driver.on('error', (error) => {
    console.error('✗ Driver error:', error.message);
  });

  try {
    await driver.connect();
    console.log('✓ Connected successfully!\n');

    // Step 3: Try to browse tags
    console.log('Step 3: Browsing tags...');
    try {
      const tags = await driver.listTags(20); // Get first 20 tags
      
      if (tags.length > 0) {
        console.log(`✓ Found ${tags.length} tag(s):\n`);
        tags.slice(0, 10).forEach((tag, index) => {
          console.log(`   ${index + 1}. ${tag.name}`);
        });
        if (tags.length > 10) {
          console.log(`   ... and ${tags.length - 10} more`);
        }
        console.log('');
      } else {
        console.log('⚠ No tags found (PLC may not support tag browsing)\n');
      }
    } catch (error) {
      console.log(`⚠ Tag browsing not supported: ${error.message}\n`);
      console.log('   (This is normal for some PLCs - you can still use tags if you know their names)\n');
    }

    // Step 4: Get tag information (if we found tags)
    console.log('Step 4: Getting tag information...');
    const testTagName = 'MyTag'; // Replace with an actual tag name from your PLC
    
    try {
      const tagInfo = await driver.getTagInfo(testTagName);
      console.log(`✓ Tag "${testTagName}" information:`);
      console.log(`   Data Type: 0x${tagInfo.dataType.toString(16)}`);
      console.log(`   Element Count: ${tagInfo.elementCount}`);
      console.log(`   Is Array: ${tagInfo.isArray ? 'Yes' : 'No'}\n`);
    } catch (error) {
      console.log(`⚠ Could not get info for tag "${testTagName}": ${error.message}`);
      console.log('   (This is expected if the tag does not exist)\n');
    }

    // Step 5: Read a tag
    console.log('Step 5: Reading tag...');
    try {
      // Try to read the test tag
      const value = await driver.readTag(testTagName);
      console.log(`✓ Tag "${testTagName}" value: ${value}\n`);
    } catch (error) {
      console.log(`⚠ Could not read tag "${testTagName}": ${error.message}`);
      console.log('   (Update the tag name in the script to match your PLC)\n');
    }

    // Step 6: Write a tag
    console.log('Step 6: Writing tag...');
    try {
      await driver.writeTag(testTagName, 42);
      console.log(`✓ Tag "${testTagName}" written successfully\n`);
      
      // Read it back to verify
      const newValue = await driver.readTag(testTagName);
      console.log(`✓ Verified: Tag value is now ${newValue}\n`);
    } catch (error) {
      console.log(`⚠ Could not write tag "${testTagName}": ${error.message}\n`);
    }

    // Step 7: Read multiple tags
    console.log('Step 7: Reading multiple tags...');
    const tagNames = [testTagName, 'Tag2', 'Tag3']; // Update with your tag names
    try {
      const tags = await driver.readTags(tagNames);
      console.log('✓ Multiple tags read:\n');
      Object.entries(tags).forEach(([name, value]) => {
        if (value.error) {
          console.log(`   ${name}: Error - ${value.error}`);
        } else {
          console.log(`   ${name}: ${value}`);
        }
      });
      console.log('');
    } catch (error) {
      console.log(`⚠ Error reading multiple tags: ${error.message}\n`);
    }

    // Step 8: Demonstrate different data types
    console.log('Step 8: Working with different data types...');
    const dataTypeExamples = [
      { name: 'BoolTag', value: true, type: 'BOOL' },
      { name: 'IntTag', value: 12345, type: 'DINT' },
      { name: 'RealTag', value: 3.14159, type: 'REAL' },
      { name: 'StringTag', value: 'Hello PLC', type: 'STRING' }
    ];

    for (const example of dataTypeExamples) {
      try {
        console.log(`   Testing ${example.type}...`);
        // Note: These tags probably don't exist, so we'll just show the attempt
        // await driver.writeTag(example.name, example.value);
        // const readValue = await driver.readTag(example.name);
        // console.log(`   ✓ ${example.type}: ${readValue}`);
        console.log(`   (Skipped - tag "${example.name}" may not exist)`);
      } catch (error) {
        // Expected for non-existent tags
      }
    }
    console.log('');

    // Step 9: Check connection status
    console.log('Step 9: Connection status...');
    console.log(`   Connected: ${driver.isConnected() ? 'Yes' : 'No'}`);
    console.log(`   Session Handle: ${driver.getSessionHandle()}\n`);

    // Step 10: Disconnect
    console.log('Step 10: Disconnecting...');
    await driver.disconnect();
    console.log('✓ Disconnected successfully\n');

    console.log('=== Example Complete ===');
    console.log('\nNext steps:');
    console.log('1. Update tag names in this script to match your PLC');
    console.log('2. Modify the examples to suit your needs');
    console.log('3. Integrate the driver into your application');
    console.log('4. Check README.md for complete API documentation');

  } catch (error) {
    console.error('\n✗ Fatal error:', error);
    console.error('Stack:', error.stack);
    
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

// Run the example
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

