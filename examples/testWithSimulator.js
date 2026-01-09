/**
 * Test Example - Using the Simulator
 * 
 * This example shows how to test the driver with the simulator.
 * 
 * First, start the simulator in one terminal:
 *   npm run simulator
 * 
 * Then run this example in another terminal:
 *   node examples/testWithSimulator.js
 */

import EthernetIPDriver from '../index.js';

// Connect to the simulator running on localhost
const PLC_IP = '127.0.0.1'; // Simulator runs on localhost
const PLC_PORT = 44818;

async function main() {
  console.log('=== Testing Driver with Simulator ===\n');

  const driver = new EthernetIPDriver(PLC_IP, PLC_PORT, {
    timeout: 5000
  });

  try {
    // Connect
    console.log('Connecting to simulator...');
    await driver.connect();
    console.log('✓ Connected!\n');

    // Read a tag
    console.log('Reading tags...');
    const myTag = await driver.readTag('MyTag');
    console.log(`  MyTag: ${myTag}`);

    const myBool = await driver.readTag('MyBoolTag');
    console.log(`  MyBoolTag: ${myBool}`);

    const myInt = await driver.readTag('MyIntTag');
    console.log(`  MyIntTag: ${myInt}`);

    const myReal = await driver.readTag('MyRealTag');
    console.log(`  MyRealTag: ${myReal}`);

    const myString = await driver.readTag('MyStringTag');
    console.log(`  MyStringTag: ${myString}`);

    // Write a tag
    console.log('\nWriting tags...');
    await driver.writeTag('MyTag', 999);
    console.log('  MyTag written: 999');

    // Read it back
    const newValue = await driver.readTag('MyTag');
    console.log(`  MyTag read back: ${newValue}`);

    // Test array
    console.log('\nReading array...');
    const array = await driver.readTag('MyArrayTag', 5);
    console.log(`  MyArrayTag: [${array.join(', ')}]`);

    // Read multiple tags
    console.log('\nReading multiple tags...');
    const tags = await driver.readTags(['MyTag', 'MyBoolTag', 'MyIntTag']);
    console.log('  Results:');
    Object.entries(tags).forEach(([name, value]) => {
      console.log(`    ${name}: ${value}`);
    });

    // Disconnect
    console.log('\nDisconnecting...');
    await driver.disconnect();
    console.log('✓ Disconnected');

    console.log('\n✓ All tests passed!');

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error('Make sure the simulator is running: npm run simulator');
    await driver.disconnect();
    process.exit(1);
  }
}

main();

