/**
 * Read one OPC UA variable: NodeId, CODESYS short name, or browse name (TAG label from listAllTags).
 *
 * By NodeId (whole struct or scalar):
 *   node examples/readTag.js "ns=4;i=289"
 *
 * By browse name (e.g. list shows "CHF" with Node ID ns=4;i=5):
 *   node examples/readTag.js --by-name CHF
 *   TAG_BY_BROWSE_NAME=1 TAG_NAME=CHF node examples/readTag.js
 *
 * Optional: start browse under a parent (if the name is ambiguous):
 *   node examples/readTag.js --by-name CHF --from=ns=0;i=85
 *
 * Restrict to one namespace when several "CHF" exist:
 *   node examples/readTag.js --by-name CHF --ns-prefix=ns=4
 *
 * Struct field (after resolving parent by NodeId or by browse name):
 *   node examples/readTag.js --by-name GERAL_COMPRESSOR_WJ --field=MOTORES_WATERJETS.TENSAO_L1_L2
 *   node examples/readTag.js --tag=ns=4;i=289 --field=MOTORES_WATERJETS.TENSAO_L1_L2
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

const DEFAULT_TAG = 'ns=4;i=289';

function argValue(prefix) {
  const a = process.argv.find((x) => x.startsWith(prefix));
  return a ? a.slice(prefix.length).trim() || null : null;
}

function tagFromArgv() {
  const eq = argValue('--tag=');
  if (eq) return eq;
  const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  return pos[0] || null;
}

const TAG_NAME = tagFromArgv() || process.env.TAG_NAME || DEFAULT_TAG;
const TAG_FIELD = argValue('--field=') || process.env.TAG_FIELD || '';
const BY_NAME =
  process.argv.includes('--by-name') || process.env.TAG_BY_BROWSE_NAME === '1';
const BROWSE_FROM =
  argValue('--from=') || process.env.OPCUA_BROWSE_FROM || 'ns=0;i=85';
const NS_PREFIX = argValue('--ns-prefix=') || process.env.OPCUA_NS_PREFIX || null;

function browseOptions() {
  const o = { startingNodeId: BROWSE_FROM, maxDepth: 25 };
  if (NS_PREFIX) o.namespacePrefix = NS_PREFIX;
  return o;
}

async function main() {
  console.log('=== Reading tag via OPC UA ===\n');
  console.log(`PLC: ${PLC_IP}:${PLC_PORT}`);
  if (BY_NAME) {
    console.log(`Resolve by browse name: ${TAG_NAME}`);
    console.log(`Browse from: ${BROWSE_FROM}`);
    if (NS_PREFIX) console.log(`Namespace filter: ${NS_PREFIX}`);
  } else {
    console.log(`Tag / NodeId: ${TAG_NAME}`);
  }
  if (TAG_FIELD) console.log(`Struct field path: ${TAG_FIELD}`);
  console.log('');

  const driver = new OPCUADriver(PLC_IP, PLC_PORT);

  try {
    console.log('Connecting to OPC UA server...');
    await driver.connect();
    console.log('✓ Connected successfully!\n');

    const opts = browseOptions();
    let value;
    if (BY_NAME) {
      console.log(
        `Reading ${TAG_FIELD ? `field "${TAG_FIELD}" of ` : ''}browse name "${TAG_NAME}"...`
      );
      value = TAG_FIELD
        ? await driver.readTagFieldByBrowseName(TAG_NAME, TAG_FIELD, opts)
        : await driver.readTagByBrowseName(TAG_NAME, opts);
    } else {
      console.log(
        `Reading ${TAG_FIELD ? `field "${TAG_FIELD}" of ` : ''}"${TAG_NAME}"...`
      );
      value = TAG_FIELD
        ? await driver.readTagField(TAG_NAME, TAG_FIELD)
        : await driver.readTag(TAG_NAME);
    }

    console.log('\n✓ Success!');
    console.log(BY_NAME ? `Browse name: ${TAG_NAME}` : `Tag / NodeId: ${TAG_NAME}`);
    if (TAG_FIELD) console.log(`Field path: ${TAG_FIELD}`);
    console.log(`Value: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
    console.log(`Type: ${typeof value}`);
  } catch (error) {
    console.error(`\n✗ Error: ${error.message}`);

    if (
      error.message.includes('not found') ||
      error.message.includes('readTagField') ||
      error.message.includes('browse name') ||
      error.message.includes('Ambiguous')
    ) {
      console.log('\nTroubleshooting:');
      console.log('  By browse name: node examples/readTag.js --by-name CHF');
      console.log('  Ambiguous name: add --from=<parent NodeId> or --ns-prefix=ns=4');
      console.log('  CODESYS short symbol: omit --by-name');
      console.log('  Siemens string NodeId: ns=3;s=...');
      console.log('  List tags: npm run listAllTags');
    }
  } finally {
    await driver.disconnect();
    console.log('\n=== Complete ===');
  }
}

main().catch(console.error);
