/**
 * Browse OPC UA server to find available tags
 * This will help identify the correct tag paths in CODESYS
 */

import { OPCUAClient, MessageSecurityMode, SecurityPolicy, AttributeIds } from "node-opcua";

const PLC_IP = '10.88.48.100';
const PLC_PORT = 4840;

async function browseTags() {
  console.log('=== Browsing OPC UA Server ===\n');
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
    console.log('Connecting to OPC UA server...');
    await client.connect(`opc.tcp://${PLC_IP}:${PLC_PORT}`);
    console.log('✓ Connected!\n');

    const session = await client.createSession();
    console.log('✓ Session created!\n');

    // Browse starting from RootFolder
    console.log('Browsing OPC UA server structure...\n');
    
    async function browseNode(nodeId, level = 0, maxLevel = 5) {
      if (level > maxLevel) return [];

      const indent = '  '.repeat(level);
      const nodes = [];

      try {
        const browseResult = await session.browse(nodeId);
        
        for (const reference of browseResult.references || []) {
          const nodeName = reference.browseName.name;
          const nodeIdStr = reference.nodeId.toString();
          const nodeClass = reference.nodeClass.toString();
          
          // Filter for interesting nodes (Variables, Objects)
          if (nodeClass.includes('Variable') || nodeClass.includes('Object')) {
            console.log(`${indent}${nodeName} (${nodeClass})`);
            console.log(`${indent}  Node ID: ${nodeIdStr}`);
            
            // Try to read value if it's a variable
            if (nodeClass.includes('Variable')) {
              try {
                const dataValue = await session.read({
                  nodeId: reference.nodeId,
                  attributeId: AttributeIds.Value
                });
                
                if (dataValue.statusCode.isGood()) {
                  console.log(`${indent}  Value: ${dataValue.value.value} (Type: ${dataValue.value.dataType.name})`);
                }
              } catch (error) {
                // Ignore read errors
              }
            }
            
            console.log(''); // Empty line
            
            nodes.push({
              name: nodeName,
              nodeId: nodeIdStr,
              nodeClass: nodeClass,
              level: level
            });

            // Recursively browse objects (but limit depth)
            if (nodeClass.includes('Object') && level < 3) {
              const childNodes = await browseNode(reference.nodeId, level + 1, maxLevel);
              nodes.push(...childNodes);
            }
          }
        }
      } catch (error) {
        // Ignore browse errors
      }

      return nodes;
    }

    const allNodes = await browseNode("RootFolder");
    
    console.log('\n=== Summary ===');
    console.log(`Found ${allNodes.length} nodes\n`);
    
    // Look for INT1_RUN specifically
    console.log('Searching for INT1_RUN...');
    const int1RunNodes = allNodes.filter(node => 
      node.name.includes('INT1_RUN') || 
      node.name.includes('INT1') ||
      node.name.includes('RUN')
    );
    
    if (int1RunNodes.length > 0) {
      console.log(`\n✓ Found ${int1RunNodes.length} matching node(s):\n`);
      for (const node of int1RunNodes) {
        console.log(`  Name: ${node.name}`);
        console.log(`  Node ID: ${node.nodeId}`);
        console.log(`  Class: ${node.nodeClass}\n`);
      }
    } else {
      console.log('\n✗ INT1_RUN not found in browsed nodes');
      console.log('\nAvailable node names (first 20):');
      const uniqueNames = [...new Set(allNodes.map(n => n.name))].slice(0, 20);
      for (const name of uniqueNames) {
        console.log(`  - ${name}`);
      }
      if (allNodes.length > 20) {
        console.log(`  ... and ${allNodes.length - 20} more`);
      }
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

browseTags().catch(console.error);

