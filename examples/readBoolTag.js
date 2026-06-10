/**
 * Read tag using OPC UA
 */

import OPCUADriver from '../lib-opcua-driver/src/opcuaDriver.js';
import { readFileSync } from 'fs';

// Try to load config.json, fallback to environment variables or defaults
let PLC_IP = '10.88.48.100';
let PLC_PORT = 4840;

try {
  const config = JSON.parse(readFileSync('./config.json', 'utf8'));
  PLC_IP = config.plc?.ip || PLC_IP;
  PLC_PORT = config.plc?.port || PLC_PORT;
} catch (e) {
  // config.json not found, use environment variables or defaults
}

PLC_IP = process.env.PLC_IP || PLC_IP;
PLC_PORT = parseInt(process.env.PLC_PORT || PLC_PORT);
const TAG_NAME = process.env.TAG_NAME || 'INT1_RUN';

async function readTag() {
  console.log('=== Reading Tag via OPC UA ===\n');
  console.log(`PLC: ${PLC_IP}:${PLC_PORT}`);
  console.log(`Tag: ${TAG_NAME}\n`);

  const driver = new OPCUADriver(PLC_IP, PLC_PORT);

  try {
    console.log('Connecting to OPC UA server...');
    await driver.connect();
    console.log('✓ Connected successfully!\n');

    console.log(`Reading tag "${TAG_NAME}"...`);
    const value = await driver.readTag(TAG_NAME);
    
    console.log(`\n✓ Success!`);
    console.log(`Tag: ${TAG_NAME}`);
    console.log(`Value: ${value}`);
    console.log(`Type: ${typeof value}`);

  } catch (error) {
    console.error(`\n✗ Error: ${error.message}`);
    
    if (error.message.includes('not found')) {
      console.log('\nTroubleshooting:');
      console.log('1. Verify the tag exists in CODESYS');
      console.log('2. Check the exact tag name in CODESYS IDE');
      console.log('3. Try listing all tags: npm run listAllTags');
    }
  } finally {
    await driver.disconnect();
    console.log('\n=== Complete ===');
  }
}

readTag().catch(console.error);

