/**
 * Read one OPC UA variable (typically BOOL); same as readTag.js with a BOOL-oriented default.
 *
 * Usage (from project root):
 *   node examples/readBoolTag.js
 *   node examples/readBoolTag.js "ns=3;s=YourDB.Path.To.BoolVar"
 *   node examples/readBoolTag.js --tag=INT1_RUN
 *   TAG_NAME=INT1_RUN npm run readTag
 */

import OPCUADriver from '../lib-opcua-driver/src/opcuaDriver.js';
import { readFileSync } from 'fs';

let PLC_IP = '10.88.48.51';
let PLC_PORT = 4840;

try {
  const config = JSON.parse(readFileSync('./config.json', 'utf8'));
  PLC_IP = config.plc?.ip || PLC_IP;
  PLC_PORT = config.plc?.port || PLC_PORT;
} catch (e) {
  // config.json not found
}

PLC_IP = process.env.PLC_IP || PLC_IP;
PLC_PORT = parseInt(process.env.PLC_PORT || PLC_PORT, 10);

const DEFAULT_TAG = 'INT1_RUN';

function tagFromArgv() {
  const eq = process.argv.find((a) => a.startsWith('--tag='));
  if (eq) return eq.slice('--tag='.length).trim() || null;
  const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  return pos[0] || null;
}

const TAG_NAME = tagFromArgv() || process.env.TAG_NAME || DEFAULT_TAG;

async function main() {
  console.log('=== Reading tag via OPC UA (BOOL example) ===\n');
  console.log(`PLC: ${PLC_IP}:${PLC_PORT}`);
  console.log(`Tag / NodeId: ${TAG_NAME}\n`);

  const driver = new OPCUADriver(PLC_IP, PLC_PORT);

  try {
    console.log('Connecting to OPC UA server...');
    await driver.connect();
    console.log('✓ Connected successfully!\n');

    console.log(`Reading "${TAG_NAME}"...`);
    const value = await driver.readTag(TAG_NAME);

    console.log('\n✓ Success!');
    console.log(`Tag / NodeId: ${TAG_NAME}`);
    console.log(`Value: ${value}`);
    console.log(`Type: ${typeof value}`);
  } catch (error) {
    console.error(`\n✗ Error: ${error.message}`);

    if (error.message.includes('not found')) {
      console.log('\nTroubleshooting:');
      console.log('  CODESYS: confirm BOOL symbol name; try npm run listAllTags');
      console.log(
        '  Siemens: use full NodeId (ns=3;s=...); list with OPCUA_NAMESPACE=ns=3 npm run listAllTags'
      );
    }
  } finally {
    await driver.disconnect();
    console.log('\n=== Complete ===');
  }
}

main().catch(console.error);
