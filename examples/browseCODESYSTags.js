/**
 * Browse CODESYS-specific OPC UA structure
 * Focuses on namespace 4 (CODESYSSPV3/3S/IecVarAccess) and PLC500 Industrial node
 */

import { OPCUAClient, MessageSecurityMode, SecurityPolicy, AttributeIds } from "node-opcua";

const PLC_IP = '10.88.48.100';
const PLC_PORT = 4840;

async function browseCODESYS() {
  console.log('=== Browsing CODESYS OPC UA Tags ===\n');
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

    // Browse from PLC500 Industrial node (namespace 4)
    console.log('=== Browsing from PLC500 Industrial (ns=4) ===\n');
    
    const plcNodeId = "ns=4;s=|plc|PLC500 Industrial";
    
    async function browseRecursive(nodeId, level = 0, maxLevel = 5, path = '') {
      if (level > maxLevel) return [];

      const indent = '  '.repeat(level);
      const nodes = [];

      try {
        const browseResult = await session.browse({
          nodeId: nodeId,
          browseDirection: 0,
          referenceTypeId: null,
          includeSubtypes: true,
          nodeClassMask: 0,
          resultMask: 0x3F
        });

        if (browseResult.references && browseResult.references.length > 0) {
          for (const ref of browseResult.references) {
            const name = ref.browseName ? ref.browseName.name : 'unnamed';
            const nodeIdStr = ref.nodeId ? ref.nodeId.toString() : 'unknown';
            const nodeClass = ref.nodeClass ? ref.nodeClass.toString() : 'unknown';
            const fullPath = path ? `${path}.${name}` : name;
            
            // Show all nodes, but focus on variables
            if (ref.nodeClass === 2) { // Variable
              console.log(`${indent}📊 ${name} (Variable)`);
              console.log(`${indent}   Node ID: ${nodeIdStr}`);
              console.log(`${indent}   Path: ${fullPath}`);
              
              // Try to read value
              try {
                const dataValue = await session.read({
                  nodeId: ref.nodeId,
                  attributeId: AttributeIds.Value
                });
                
                if (dataValue.statusCode.isGood()) {
                  console.log(`${indent}   Value: ${dataValue.value.value} (${dataValue.value.dataType.name})`);
                }
              } catch (error) {
                // Ignore read errors
              }
              
              // Check if it matches INT1_RUN
              if (name.toUpperCase().includes('INT1_RUN') || 
                  name.toUpperCase().includes('INT1') ||
                  (name.toUpperCase().includes('RUN') && name.toUpperCase().includes('INT'))) {
                console.log(`${indent}   ⭐ MATCHES INT1_RUN!`);
              }
              
              console.log('');
              
              nodes.push({
                name: name,
                nodeId: nodeIdStr,
                path: fullPath,
                isVariable: true
              });
            } else if (ref.nodeClass === 1 && level < 3) { // Object, browse recursively
              console.log(`${indent}📁 ${name} (Object)`);
              console.log(`${indent}   Node ID: ${nodeIdStr}`);
              console.log('');
              
              nodes.push({
                name: name,
                nodeId: nodeIdStr,
                path: fullPath,
                isVariable: false
              });
              
              // Recursively browse objects (limit depth)
              const childNodes = await browseRecursive(ref.nodeId, level + 1, maxLevel, fullPath);
              nodes.push(...childNodes);
            }
          }
        }
      } catch (error) {
        // Ignore browse errors
      }

      return nodes;
    }

    const allNodes = await browseRecursive(plcNodeId);
    
    // Also try namespace 3 (PLCopen)
    console.log('\n\n=== Trying Namespace 3 (PLCopen) ===\n');
    console.log('Trying common PLCopen tag paths...\n');
    
    const plcopenPaths = [
      'ns=3;s=INT1_RUN',
      'ns=3;s=Application.INT1_RUN',
      'ns=3;s=Application.GVL.INT1_RUN',
      'ns=3;s=GVL.INT1_RUN',
      'ns=3;s=Program:MainProgram.INT1_RUN',
      'ns=3;s=MainProgram.INT1_RUN',
    ];

    for (const path of plcopenPaths) {
      try {
        const dataValue = await session.read({
          nodeId: path,
          attributeId: AttributeIds.Value
        });
        
        if (dataValue.statusCode.isGood()) {
          console.log(`✓ SUCCESS! ${path}`);
          console.log(`  Value: ${dataValue.value.value} (${dataValue.value.dataType.name})\n`);
        }
      } catch (error) {
        // Ignore
      }
    }

    // Try namespace 4 with different formats
    console.log('\n=== Trying Namespace 4 (CODESYS) Direct Paths ===\n');
    
    const codesysPaths = [
      'ns=4;s=|plc|INT1_RUN',
      'ns=4;s=|plc|Application.INT1_RUN',
      'ns=4;s=|plc|Application.GVL.INT1_RUN',
      'ns=4;s=|plc|GVL.INT1_RUN',
      'ns=4;s=|plc|Program:MainProgram.INT1_RUN',
      'ns=4;s=|plc|MainProgram.INT1_RUN',
      'ns=4;s=INT1_RUN',
      'ns=4;s=Application.INT1_RUN',
      'ns=4;s=GVL.INT1_RUN',
    ];

    for (const path of codesysPaths) {
      try {
        const dataValue = await session.read({
          nodeId: path,
          attributeId: AttributeIds.Value
        });
        
        if (dataValue.statusCode.isGood()) {
          console.log(`✓ SUCCESS! ${path}`);
          console.log(`  Value: ${dataValue.value.value} (${dataValue.value.dataType.name})\n`);
        }
      } catch (error) {
        // Ignore
      }
    }

    // Summary
    console.log('\n=== Summary ===');
    const variableNodes = allNodes.filter(n => n.isVariable);
    console.log(`Found ${variableNodes.length} variable nodes`);
    
    const int1RunNodes = variableNodes.filter(n => 
      n.name.toUpperCase().includes('INT1_RUN') ||
      (n.name.toUpperCase().includes('INT1') && n.name.toUpperCase().includes('RUN'))
    );
    
    if (int1RunNodes.length > 0) {
      console.log(`\n⭐ Found ${int1RunNodes.length} INT1_RUN related node(s):\n`);
      for (const node of int1RunNodes) {
        console.log(`  Name: ${node.name}`);
        console.log(`  Node ID: ${node.nodeId}`);
        console.log(`  Path: ${node.path}\n`);
      }
    } else {
      console.log('\n✗ INT1_RUN not found in browsed nodes');
      if (variableNodes.length > 0) {
        console.log('\nAvailable variable names (first 30):');
        const uniqueNames = [...new Set(variableNodes.map(n => n.name))].slice(0, 30);
        for (const name of uniqueNames) {
          console.log(`  - ${name}`);
        }
        if (variableNodes.length > 30) {
          console.log(`  ... and ${variableNodes.length - 30} more`);
        }
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

browseCODESYS().catch(console.error);

