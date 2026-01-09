/**
 * Test different path formats based on EDS file analysis
 * The EDS file shows CODESYS uses logical segments with format 0x20 (8-bit logical, class)
 */

import { EthernetIPDriver } from '../index.js';

const PLC_IP = '10.88.48.100';
const PLC_PORT = 44818;
const TAG_NAME = 'INT1_RUN';

async function testEDSPaths() {
  console.log('=== Testing Path Formats Based on EDS File Analysis ===\n');
  console.log(`PLC: ${PLC_IP}:${PLC_PORT}`);
  console.log(`Tag: ${TAG_NAME}\n`);

  const driver = new EthernetIPDriver(PLC_IP, PLC_PORT);

  try {
    console.log('Connecting to PLC...');
    await driver.connect();
    console.log('✓ Connected successfully!\n');

    // Test variations based on EDS file analysis
    // EDS shows paths like "20 04 24 66 2C 64 2C 65"
    // Format: 0x20 (8-bit logical, class) + Class ID + 0x24 (8-bit logical, instance) + Instance ID
    
    const tests = [
      {
        name: 'Direct tag path (no Message Router)',
        pathFormat: 'default',
        useMessageRouter: false,
        interfaceHandleFormat: false
      },
      {
        name: 'Message Router path (standard: 20 02 24 00)',
        pathFormat: 'withRouter',
        useMessageRouter: true,
        interfaceHandleFormat: false
      },
      {
        name: 'Message Router path (compact: 01 00)',
        pathFormat: 'withRouterCompact',
        useMessageRouter: true,
        interfaceHandleFormat: false
      },
      {
        name: 'Message Router with 32-bit interface handle',
        pathFormat: 'withRouter',
        useMessageRouter: true,
        interfaceHandleFormat: true
      },
      {
        name: 'Message Router with timeout (5000ms)',
        pathFormat: 'withRouter',
        useMessageRouter: true,
        interfaceHandleFormat: 5000
      },
      {
        name: '16-bit symbolic path',
        pathFormat: '16bit',
        useMessageRouter: false,
        interfaceHandleFormat: false
      }
    ];

    for (const test of tests) {
      console.log(`\n--- Test: ${test.name} ---`);
      try {
        const result = await driver.readTag(
          TAG_NAME, 
          1, 
          test.pathFormat, 
          test.useMessageRouter,
          test.interfaceHandleFormat
        );
        console.log(`✓ Success! Value: ${result} (Type: ${typeof result})`);
        console.log('\n✓ Found working configuration!');
        return; // Stop on first success
      } catch (error) {
        console.log(`✗ Failed: ${error.message}`);
        if (error.statusCode) {
          console.log(`  Status: 0x${error.statusHex}`);
        }
      }
    }

    console.log('\n✗ All path format tests failed');
    console.log('\nTroubleshooting suggestions:');
    console.log('1. Verify the tag exists in your PLC programming software');
    console.log('2. Check the exact tag name and path in the PLC');
    console.log('3. Try listing tags to see available names');
    console.log('4. Check PLC documentation for EtherNet/IP tag naming');
    console.log('5. The tag might require a different path format');

  } catch (error) {
    console.error(`✗ Error: ${error.message}`);
  } finally {
    await driver.disconnect();
    console.log('\n=== Complete ===');
  }
}

testEDSPaths().catch(console.error);
