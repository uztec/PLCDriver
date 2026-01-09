/**
 * Basic example: Connect to PLC and read/write tags
 */

import EthernetIPDriver from '../index.js';

// PLC Configuration
const PLC_IP = '192.168.1.100'; // Replace with your PLC's IP address
const PLC_PORT = 44818;

async function main() {
  // Create driver instance
  const driver = new EthernetIPDriver(PLC_IP, PLC_PORT, {
    timeout: 5000
  });

  try {
    // Connect to PLC
    console.log('Connecting to PLC...');
    await driver.connect();
    console.log('Connected!');

    // Read a tag
    console.log('\nReading tag...');
    const value = await driver.readTag('MyTag');
    console.log('Tag value:', value);

    // Write a tag
    console.log('\nWriting tag...');
    await driver.writeTag('MyTag', 42);
    console.log('Tag written successfully');

    // Read it back
    console.log('\nReading tag again...');
    const newValue = await driver.readTag('MyTag');
    console.log('New tag value:', newValue);

    // Read multiple tags
    console.log('\nReading multiple tags...');
    const tags = await driver.readTags(['Tag1', 'Tag2', 'Tag3']);
    console.log('Tags:', tags);

    // Disconnect
    console.log('\nDisconnecting...');
    await driver.disconnect();
    console.log('Disconnected');
  } catch (error) {
    console.error('Error:', error);
    await driver.disconnect();
    process.exit(1);
  }
}

main();

