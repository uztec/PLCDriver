/**
 * Advanced example: Using events and different data types
 */

import EthernetIPDriver, { CIP_DATA_TYPES } from '../index.js';

// PLC Configuration
const PLC_IP = '192.168.1.100'; // Replace with your PLC's IP address
const PLC_PORT = 44818;

async function main() {
  const driver = new EthernetIPDriver(PLC_IP, PLC_PORT);

  // Set up event handlers
  driver.on('connected', () => {
    console.log('Driver connected event fired');
  });

  driver.on('disconnected', () => {
    console.log('Driver disconnected event fired');
  });

  driver.on('error', (error) => {
    console.error('Driver error:', error);
  });

  try {
    await driver.connect();

    // Read different data types
    console.log('\nReading different data types:');

    // Boolean
    const boolValue = await driver.readTag('MyBoolTag');
    console.log('Boolean:', boolValue);

    // Integer
    const intValue = await driver.readTag('MyIntTag');
    console.log('Integer:', intValue);

    // Real (Float)
    const realValue = await driver.readTag('MyRealTag');
    console.log('Real:', realValue);

    // String
    const stringValue = await driver.readTag('MyStringTag');
    console.log('String:', stringValue);

    // Write with explicit data types
    console.log('\nWriting with explicit data types:');
    
    await driver.writeTag('MyBoolTag', true, CIP_DATA_TYPES.BOOL);
    await driver.writeTag('MyIntTag', 12345, CIP_DATA_TYPES.DINT);
    await driver.writeTag('MyRealTag', 3.14159, CIP_DATA_TYPES.REAL);
    await driver.writeTag('MyStringTag', 'Hello PLC', CIP_DATA_TYPES.STRING);

    // Read array
    console.log('\nReading array:');
    const arrayValues = await driver.readTag('MyArrayTag', 10); // Read 10 elements
    console.log('Array:', arrayValues);

    await driver.disconnect();
  } catch (error) {
    console.error('Error:', error);
    await driver.disconnect();
    process.exit(1);
  }
}

main();

