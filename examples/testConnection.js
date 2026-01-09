/**
 * Connection Test Example
 * 
 * Test if a PLC is reachable and supports EtherNet/IP,
 * even if discovery doesn't work.
 * 
 * Usage:
 *   node examples/testConnection.js
 */

import { testConnection, verifyPLC } from '../index.js';

// PLC Configuration
const PLC_IP = '10.88.48.100'; // Replace with your PLC's IP address
const PLC_PORT = 44818;

async function main() {
  console.log('=== EtherNet/IP Connection Test ===\n');
  console.log(`Testing PLC at ${PLC_IP}:${PLC_PORT}\n`);

  // Method 1: Simple connection test
  console.log('1. Testing TCP Connection...');
  try {
    const result = await testConnection(PLC_IP, PLC_PORT, 5000);
    
    console.log('   Result:');
    console.log(`     Reachable: ${result.reachable ? 'Yes' : 'No'}`);
    console.log(`     Session Supported: ${result.sessionSupported ? 'Yes' : 'No'}`);
    console.log(`     Session Handle: ${result.sessionHandle || 'N/A'}`);
    console.log(`     Response Time: ${result.responseTime}ms`);
    console.log(`     Status: ${result.status}`);
    
    if (result.reachable && result.sessionSupported) {
      console.log('\n   ✓ PLC is reachable and supports EtherNet/IP!');
      console.log('   You can connect using:');
      console.log(`     const driver = new EthernetIPDriver('${PLC_IP}', ${PLC_PORT});`);
      console.log(`     await driver.connect();`);
    } else if (result.reachable) {
      console.log('\n   ⚠ PLC is reachable but session registration failed.');
      console.log('   Possible issues:');
      console.log('     - PLC may require authentication');
      console.log('     - PLC may be in a different mode');
      console.log('     - Check PLC configuration');
    } else {
      console.log('\n   ✗ PLC is not reachable.');
      console.log('   Possible issues:');
      console.log('     - Network connectivity problem');
      console.log('     - Firewall blocking port 44818');
      console.log('     - PLC is not powered on');
      console.log('     - Wrong IP address');
    }
  } catch (error) {
    console.error('   Error:', error.message);
  }

  // Method 2: Comprehensive verification (includes discovery)
  console.log('\n2. Comprehensive Verification (Discovery + Connection)...');
  try {
    const verification = await verifyPLC(PLC_IP, 5000);
    
    console.log('   Discovery:');
    if (verification.discovery && !verification.discovery.error) {
      console.log(`     ✓ Device found: ${verification.discovery.productName}`);
      console.log(`       Vendor ID: ${verification.discovery.vendorId}`);
      console.log(`       Product Code: ${verification.discovery.productCode}`);
    } else {
      console.log('     ✗ Discovery failed (List Identity not supported or blocked)');
      if (verification.discovery && verification.discovery.error) {
        console.log(`       Error: ${verification.discovery.error}`);
      }
    }
    
    console.log('\n   Connection:');
    if (verification.connection && !verification.connection.error) {
      console.log(`     Reachable: ${verification.connection.reachable ? 'Yes' : 'No'}`);
      console.log(`     Session Supported: ${verification.connection.sessionSupported ? 'Yes' : 'No'}`);
    } else {
      console.log('     ✗ Connection test failed');
      if (verification.connection && verification.connection.error) {
        console.log(`       Error: ${verification.connection.error}`);
      }
    }
    
    console.log('\n   Recommendation:');
    console.log(`     ${verification.recommended}`);
    if (verification.recommendedMessage) {
      console.log(`     ${verification.recommendedMessage}`);
    }
    
    if (verification.recommended === 'use_direct_connection') {
      console.log('\n   ✓ You can still use the driver!');
      console.log('   The PLC supports EtherNet/IP but not discovery.');
      console.log('   Just connect directly without using discovery.');
    }
    
  } catch (error) {
    console.error('   Error:', error.message);
  }

  console.log('\n=== Test Complete ===\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

