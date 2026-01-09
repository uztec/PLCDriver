/**
 * Detailed OPC UA browser - tries different starting points and shows full structure
 */

import { OPCUAClient, MessageSecurityMode, SecurityPolicy, AttributeIds } from "node-opcua";

const PLC_IP = '10.88.48.100';
const PLC_PORT = 4840;

async function browseDetailed() {
  console.log('=== Detailed OPC UA Browser ===\n');
  console.log(`PLC: ${PLC_IP}:${PLC_PORT}\n`);

  const client = OPCUAClient.create({
    endpointMustExist: false,
    connectionStrategy: {
      initialDelay: 1000,
      maxRetry: 3
    },
    securityMode: MessageSecurityMode.None,
    securityPolicy: SecurityPolicy.None
  });

  try {
    console.log('Connecting...');
    await client.connect(`opc.tcp://${PLC_IP}:${PLC_PORT}`);
    console.log('✓ Connected!\n');

    const session = await client.createSession();
    console.log('✓ Session created!\n');

    // Try different starting points
    const startingPoints = [
      "RootFolder",
      "ObjectsFolder",
      "Server",
      "ns=0;i=85", // ObjectsFolder
      "ns=0;i=84", // RootFolder
      "ns=0;i=2253", // Server
      "ns=2;s=Application", // CODESYS Application
      "ns=2;s=GVL", // Global Variable List
    ];

    console.log('Trying different starting points...\n');

    for (const startPoint of startingPoints) {
      try {
        console.log(`\n--- Browsing from: ${startPoint} ---`);
        
        const browseResult = await session.browse({
          nodeId: startPoint,
          browseDirection: 0, // Forward
          referenceTypeId: null,
          includeSubtypes: true,
          nodeClassMask: 0,
          resultMask: 0x3F
        });

        if (browseResult.references && browseResult.references.length > 0) {
          console.log(`✓ Found ${browseResult.references.length} references:\n`);
          
          for (const ref of browseResult.references) {
            const name = ref.browseName ? ref.browseName.name : 'unnamed';
            const nodeId = ref.nodeId ? ref.nodeId.toString() : 'unknown';
            const nodeClass = ref.nodeClass ? ref.nodeClass.toString() : 'unknown';
            
            console.log(`  Name: ${name}`);
            console.log(`  Node ID: ${nodeId}`);
            console.log(`  Class: ${nodeClass}`);
            
            // If it's a variable, try to read it
            if (ref.nodeClass === 2) { // Variable
              try {
                const dataValue = await session.read({
                  nodeId: ref.nodeId,
                  attributeId: AttributeIds.Value
                });
                
                if (dataValue.statusCode.isGood()) {
                  console.log(`  Value: ${dataValue.value.value} (${dataValue.value.dataType.name})`);
                }
              } catch (error) {
                // Ignore read errors
              }
            }
            
            // Check if name contains INT1_RUN or similar
            if (name.toUpperCase().includes('INT1') || 
                name.toUpperCase().includes('RUN') ||
                name.toUpperCase().includes('INT1_RUN')) {
              console.log(`  ⭐ MATCHES INT1_RUN!`);
            }
            
            console.log('');
          }
        } else {
          console.log('  (No references found)');
        }
      } catch (error) {
        console.log(`  ✗ Error: ${error.message}`);
      }
    }

    // Try to read common CODESYS tag paths directly
    console.log('\n\n=== Trying Direct Tag Paths ===\n');
    
    const directPaths = [
      'ns=2;s=INT1_RUN',
      'ns=2;s=Application.INT1_RUN',
      'ns=2;s=Application.GVL.INT1_RUN',
      'ns=2;s=GVL.INT1_RUN',
      'ns=2;s=Program:MainProgram.INT1_RUN',
      'ns=2;s=MainProgram.INT1_RUN',
      'ns=2;s=INT1',
      'ns=2;s=Application.INT1',
      'ns=2;s=GVL.INT1',
    ];

    for (const path of directPaths) {
      try {
        console.log(`Trying: ${path}...`);
        const dataValue = await session.read({
          nodeId: path,
          attributeId: AttributeIds.Value
        });
        
        if (dataValue.statusCode.isGood()) {
          console.log(`  ✓ SUCCESS! Value: ${dataValue.value.value} (${dataValue.value.dataType.name})\n`);
        } else {
          console.log(`  ✗ Status: ${dataValue.statusCode.toString()}\n`);
        }
      } catch (error) {
        console.log(`  ✗ Error: ${error.message}\n`);
      }
    }

    // Get server namespace array
    console.log('\n=== Server Namespaces ===\n');
    try {
      const namespaceArray = await session.read({
        nodeId: "ns=0;i=2255", // Server.NamespaceArray
        attributeId: AttributeIds.Value
      });
      
      if (namespaceArray.statusCode.isGood() && namespaceArray.value.value) {
        console.log('Available namespaces:');
        namespaceArray.value.value.forEach((ns, index) => {
          console.log(`  ns=${index}: ${ns}`);
        });
      }
    } catch (error) {
      console.log(`Error reading namespaces: ${error.message}`);
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

browseDetailed().catch(console.error);

