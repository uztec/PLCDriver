/**
 * OPC UA Example - Read/Write tags using OPC UA instead of EtherNet/IP
 * This works with CODESYS PLC when EtherNet/IP explicit messaging is not enabled
 */

import { OPCUAClient, MessageSecurityMode, SecurityPolicy, AttributeIds, makeBrowsePath } from "node-opcua";

const PLC_IP = '10.88.48.100';
const PLC_PORT = 4840;
const TAG_NAME = 'INT1_RUN'; // The tag you want to read

async function readTagOPCUA() {
  console.log('=== Reading Tag via OPC UA ===\n');
  console.log(`PLC: ${PLC_IP}:${PLC_PORT}`);
  console.log(`Tag: ${TAG_NAME}\n`);

  const client = OPCUAClient.create({
    endpointMustExist: false,
    connectionStrategy: {
      initialDelay: 1000,
      maxRetry: 3
    },
    securityMode: MessageSecurityMode.None, // Use None for basic connection
    securityPolicy: SecurityPolicy.None
  });

  try {
    console.log('Connecting to OPC UA server...');
    await client.connect(`opc.tcp://${PLC_IP}:${PLC_PORT}`);
    console.log('✓ Connected to OPC UA server!\n');

    const session = await client.createSession();
    console.log('✓ Session created!\n');

    // Browse for the tag
    console.log(`Looking for tag: ${TAG_NAME}...`);
    
    // Try different common tag paths in CODESYS
    const tagPaths = [
      `ns=2;s=${TAG_NAME}`,                    // Direct tag
      `ns=2;s=Application.${TAG_NAME}`,       // Application scope
      `ns=2;s=Application.GVL.${TAG_NAME}`,  // GVL scope
      `ns=2;s=GVL.${TAG_NAME}`,              // GVL direct
      `ns=2;s=Program:MainProgram.${TAG_NAME}`, // Program scope
      `ns=2;s=MainProgram.${TAG_NAME}`        // Program direct
    ];

    let tagNodeId = null;
    let tagValue = null;

    for (const tagPath of tagPaths) {
      try {
        console.log(`  Trying: ${tagPath}...`);
        const nodeId = tagPath;
        
        // Try to read the tag
        const dataValue = await session.read({
          nodeId: nodeId,
          attributeId: AttributeIds.Value
        });

        if (dataValue.statusCode.isGood()) {
          tagNodeId = nodeId;
          tagValue = dataValue.value.value;
          console.log(`  ✓ Found! Value: ${tagValue} (Type: ${dataValue.value.dataType.name})\n`);
          break;
        }
      } catch (error) {
        // Continue to next path
      }
    }

    if (!tagNodeId) {
      console.log('\n✗ Tag not found. Browsing available nodes...\n');
      
      // Browse the server to see what's available
      const browseResult = await session.browse("RootFolder");
      console.log('Available nodes:');
      for (const reference of browseResult.references || []) {
        console.log(`  - ${reference.browseName.name} (${reference.nodeId.toString()})`);
      }
    } else {
      console.log('=== Success ===');
      console.log(`Tag: ${TAG_NAME}`);
      console.log(`Node ID: ${tagNodeId}`);
      console.log(`Value: ${tagValue}`);
      console.log(`Type: ${typeof tagValue}`);
    }

    await session.close();
    await client.disconnect();
    console.log('\n✓ Disconnected');

  } catch (error) {
    console.error(`✗ Error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

readTagOPCUA().catch(console.error);

