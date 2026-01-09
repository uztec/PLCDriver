/**
 * Example: Get PLC Connection Status and Properties
 * 
 * This example demonstrates how to:
 * - Check if PLC is connected
 * - Get connection status details
 * - Get device information (vendor, product, serial number, etc.)
 * - Get complete PLC properties
 * 
 * Usage:
 *   node examples/getPLCProperties.js
 */

import EthernetIPDriver from '../index.js';

// PLC Configuration
const PLC_IP = '10.88.48.100'; // Replace with your PLC's IP address
const PLC_PORT = 44818;

async function main() {
  console.log('=== PLC Connection Status and Properties ===\n');
  console.log(`PLC: ${PLC_IP}:${PLC_PORT}\n`);

  // Create driver instance
  const driver = new EthernetIPDriver(PLC_IP, PLC_PORT, {
    timeout: 5000
  });

  try {
    // Method 1: Check connection status (before connecting)
    console.log('1. Connection Status (before connect):');
    const statusBefore = driver.getConnectionStatus();
    console.log(`   Connected: ${statusBefore.connected ? 'Yes' : 'No'}`);
    console.log(`   Session Handle: ${statusBefore.sessionHandle || 'N/A'}`);
    console.log(`   Host: ${statusBefore.host}`);
    console.log(`   Port: ${statusBefore.port}`);
    console.log(`   Timeout: ${statusBefore.timeout}ms\n`);

    // Connect to PLC
    console.log('2. Connecting to PLC...');
    await driver.connect();
    console.log('   ✓ Connected successfully!\n');

    // Method 2: Check connection status (after connecting)
    console.log('3. Connection Status (after connect):');
    const statusAfter = driver.getConnectionStatus();
    console.log(`   Connected: ${statusAfter.connected ? 'Yes' : 'No'}`);
    console.log(`   Session Handle: ${statusAfter.sessionHandle || 'N/A'}`);
    console.log(`   Host: ${statusAfter.host}`);
    console.log(`   Port: ${statusAfter.port}\n`);

    // Method 3: Get device information
    console.log('4. Device Information:');
    try {
      const deviceInfo = await driver.getDeviceInfo();
      console.log(`   Product Name: ${deviceInfo.productName}`);
      console.log(`   Vendor ID: ${deviceInfo.vendorId}`);
      console.log(`   Device Type: ${deviceInfo.deviceType}`);
      console.log(`   Product Code: ${deviceInfo.productCode}`);
      console.log(`   Revision: ${deviceInfo.revision.major}.${deviceInfo.revision.minor}`);
      console.log(`   Serial Number: ${deviceInfo.serialNumber}`);
      console.log(`   Status: 0x${deviceInfo.status.toString(16)}`);
      console.log(`   State: ${deviceInfo.state}`);
    } catch (error) {
      console.log(`   ✗ Could not get device info: ${error.message}`);
      console.log('   (Some PLCs may not support Identity object queries)');
    }

    // Method 4: Get complete properties (connection + device)
    console.log('\n5. Complete PLC Properties:');
    const properties = await driver.getProperties();
    
    console.log('   Connection:');
    console.log(`     Connected: ${properties.connection.connected}`);
    console.log(`     Session Handle: ${properties.connection.sessionHandle}`);
    
    if (properties.device) {
      console.log('   Device:');
      console.log(`     Product Name: ${properties.device.productName}`);
      console.log(`     Vendor ID: ${properties.device.vendorId}`);
      console.log(`     Product Code: ${properties.device.productCode}`);
      console.log(`     Serial Number: ${properties.device.serialNumber}`);
    } else if (properties.deviceError) {
      console.log(`   Device Info: Error - ${properties.deviceError}`);
    }

    // Method 5: Simple connection check
    console.log('\n6. Quick Connection Check:');
    if (driver.isConnected()) {
      console.log('   ✓ PLC is connected');
      console.log(`   Session Handle: ${driver.getSessionHandle()}`);
    } else {
      console.log('   ✗ PLC is not connected');
    }

    // Disconnect
    console.log('\n7. Disconnecting...');
    await driver.disconnect();
    console.log('   ✓ Disconnected');

    // Check status after disconnect
    console.log('\n8. Connection Status (after disconnect):');
    const statusFinal = driver.getConnectionStatus();
    console.log(`   Connected: ${statusFinal.connected ? 'Yes' : 'No'}`);
    console.log(`   Session Handle: ${statusFinal.sessionHandle || 'N/A'}`);

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

