/**
 * PLC Simulator Example
 * 
 * Run this to start a simulated PLC that can be used for testing the driver.
 * 
 * Usage:
 *   node examples/simulator.js
 * 
 * Then in another terminal, run any of the example scripts pointing to localhost:
 *   node examples/basic.js  (update PLC_IP to '127.0.0.1')
 */

import PLCSimulator from '../src/simulator.js';

// Simulator Configuration
const SIMULATOR_HOST = '0.0.0.0'; // Listen on all interfaces
const SIMULATOR_PORT = 44818;
const SIMULATOR_UDP_PORT = 2222;

async function main() {
  console.log('=== EtherNet/IP PLC Simulator ===\n');

  // Create simulator instance
  const simulator = new PLCSimulator({
    host: SIMULATOR_HOST,
    port: SIMULATOR_PORT,
    udpPort: SIMULATOR_UDP_PORT,
    vendorId: 1,
    deviceType: 12,
    productCode: 1,
    revisionMajor: 1,
    revisionMinor: 0,
    serialNumber: 12345,
    productName: 'EtherNet/IP Simulator'
  });

  // Set up event handlers
  simulator.on('listening', (info) => {
    console.log(`✓ ${info.type.toUpperCase()} server listening on port ${info.port}`);
  });

  simulator.on('tagChanged', ({ name, value, dataType }) => {
    console.log(`\n[Tag Changed] ${name} = ${value} (type: 0x${dataType.toString(16)})`);
  });

  simulator.on('error', (error) => {
    console.error('✗ Simulator error:', error);
  });

  // Add some custom tags
  console.log('\nInitializing tags...');
  simulator.setTag('TestTag', 100, 0xC4); // DINT
  simulator.setTag('Counter', 0, 0xC4);
  simulator.setTag('Temperature', 25.5, 0xCA); // REAL
  simulator.setTag('Running', true, 0xC1); // BOOL
  simulator.setTag('Status', 'Ready', 0xDA); // STRING
  
  console.log('Default tags:');
  simulator.listTags().forEach(tag => {
    const value = simulator.getTag(tag);
    const type = simulator.getTagType(tag);
    console.log(`  - ${tag}: ${value} (0x${type.toString(16)})`);
  });

  // Start the simulator
  try {
    await simulator.start();
    console.log('\n✓ Simulator started successfully!');
    console.log(`\nConnect to: 127.0.0.1:${SIMULATOR_PORT}`);
    console.log('Press Ctrl+C to stop\n');
    
    // Keep running
    process.on('SIGINT', async () => {
      console.log('\n\nStopping simulator...');
      await simulator.stop();
      console.log('Simulator stopped');
      process.exit(0);
    });

    // Display tag values periodically (optional)
    setInterval(() => {
      // You could update tags here to simulate changing values
      // simulator.setTag('Counter', (simulator.getTag('Counter') || 0) + 1);
    }, 5000);

  } catch (error) {
    console.error('Failed to start simulator:', error);
    process.exit(1);
  }
}

main();

