/**
 * Example: Discover PLCs on the network
 */

import { discoverPLCs, discoverPLC, PLCDiscovery } from '../index.js';

// PLC Configuration
const PLC_IP = '192.168.1.100'; // Replace with your PLC's IP address

async function main() {
  console.log('=== EtherNet/IP PLC Discovery ===\n');

  // Method 1: Discover all PLCs on the network (broadcast)
  console.log('1. Discovering all PLCs on network (broadcast)...');
  try {
    const devices = await discoverPLCs(3000); // 3 second timeout
    
    if (devices.length === 0) {
      console.log('No devices found.\n');
    } else {
      console.log(`Found ${devices.length} device(s):\n`);
      devices.forEach((device, index) => {
        console.log(`Device ${index + 1}:`);
        console.log(`  IP Address: ${device.ipAddress}`);
        console.log(`  Product Name: ${device.productName}`);
        console.log(`  Vendor ID: ${device.vendorId}`);
        console.log(`  Device Type: ${device.deviceType}`);
        console.log(`  Product Code: ${device.productCode}`);
        console.log(`  Revision: ${device.revision.major}.${device.revision.minor}`);
        console.log(`  Serial Number: ${device.serialNumber}`);
        console.log(`  Status: 0x${device.status.toString(16)}`);
        console.log(`  State: ${device.state}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('Discovery error:', error);
  }

  // Method 2: Discover a specific PLC by IP
  console.log('\n2. Discovering specific PLC by IP...');
  const targetIP = PLC_IP;
  try {
    // Try with verbose mode to see what's happening
    const device = await discoverPLC(targetIP, 3000, true);
    
    if (device) {
      console.log(`Found device at ${targetIP}:`);
      console.log(`  Product Name: ${device.productName}`);
      console.log(`  Vendor ID: ${device.vendorId}`);
      console.log(`  Product Code: ${device.productCode}`);
    } else {
      console.log(`No device found at ${targetIP}`);
      console.log('\n  Note: If the PLC exists but discovery fails, it may not support List Identity.');
      console.log('  Try using testConnection() to verify TCP connectivity:');
      console.log('    node examples/testConnection.js');
    }
  } catch (error) {
    console.error('Discovery error:', error);
  }

  // Method 3: Continuous discovery with events
  console.log('\n3. Starting continuous discovery (5 seconds)...');
  const discovery = new PLCDiscovery();
  
  discovery.on('device', (device) => {
    console.log(`\n[EVENT] New device discovered: ${device.productName} at ${device.ipAddress}`);
  });
  
  discovery.on('deviceUpdate', (device) => {
    console.log(`[EVENT] Device updated: ${device.productName} at ${device.ipAddress}`);
  });
  
  discovery.on('error', (error) => {
    console.error('[EVENT] Discovery error:', error);
  });

  discovery.start(2000); // Discover every 2 seconds
  
  // Run for 5 seconds then stop
  setTimeout(() => {
    discovery.stop();
    const devices = discovery.getDevices();
    console.log(`\nContinuous discovery stopped. Total devices found: ${devices.length}`);
    process.exit(0);
  }, 5000);
}

main();

