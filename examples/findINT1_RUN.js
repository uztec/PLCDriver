/**
 * Find INT1_RUN tag using various methods
 * Also provides guidance on enabling OPC UA features in CODESYS
 */

import { OPCUAClient, MessageSecurityMode, SecurityPolicy, AttributeIds } from "node-opcua";

const PLC_IP = '10.88.48.100';
const PLC_PORT = 4840;

async function findINT1_RUN() {
  console.log('=== Finding INT1_RUN Tag ===\n');
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

    // Try comprehensive list of possible paths
    console.log('=== Trying All Possible Tag Paths ===\n');
    
    const allPaths = [
      // Namespace 4 (CODESYS) - various formats
      'ns=4;s=|plc|INT1_RUN',
      'ns=4;s=|plc|Application.INT1_RUN',
      'ns=4;s=|plc|Application.GVL.INT1_RUN',
      'ns=4;s=|plc|GVL.INT1_RUN',
      'ns=4;s=|plc|Program:MainProgram.INT1_RUN',
      'ns=4;s=|plc|MainProgram.INT1_RUN',
      'ns=4;s=|var|PLC500 Industrial.Application.INT1_RUN',
      'ns=4;s=|var|PLC500 Industrial.Application.GVL.INT1_RUN',
      'ns=4;s=|var|PLC500 Industrial.GVL.INT1_RUN',
      'ns=4;s=|var|Application.INT1_RUN',
      'ns=4;s=|var|Application.GVL.INT1_RUN',
      'ns=4;s=|var|GVL.INT1_RUN',
      'ns=4;s=INT1_RUN',
      'ns=4;s=Application.INT1_RUN',
      'ns=4;s=GVL.INT1_RUN',
      
      // Namespace 3 (PLCopen/IEC61131-3)
      'ns=3;s=INT1_RUN',
      'ns=3;s=Application.INT1_RUN',
      'ns=3;s=Application.GVL.INT1_RUN',
      'ns=3;s=GVL.INT1_RUN',
      'ns=3;s=Program:MainProgram.INT1_RUN',
      'ns=3;s=MainProgram.INT1_RUN',
      
      // Namespace 2 (Device Integration)
      'ns=2;s=INT1_RUN',
      'ns=2;s=Application.INT1_RUN',
      'ns=2;s=GVL.INT1_RUN',
    ];

    let found = false;

    for (const path of allPaths) {
      try {
        const dataValue = await session.read({
          nodeId: path,
          attributeId: AttributeIds.Value
        });
        
        if (dataValue.statusCode.isGood()) {
          console.log(`✓ SUCCESS! Found INT1_RUN!`);
          console.log(`  Node ID: ${path}`);
          console.log(`  Value: ${dataValue.value.value}`);
          console.log(`  Type: ${dataValue.value.dataType.name}`);
          console.log(`\n🎉 Use this Node ID to read the tag: ${path}\n`);
          found = true;
          break;
        }
      } catch (error) {
        // Continue to next path
      }
    }

    if (!found) {
      console.log('✗ INT1_RUN not found with any path format\n');
      
      console.log('=== Configuration Required ===\n');
      console.log('⚠️  OPC UA Features need to be enabled in CODESYS!\n');
      console.log('The server shows: "Please activate \'Support OPC UA Features\'');
      console.log('within the symbolconfiguration editor"\n');
      console.log('=== Steps to Enable OPC UA Features ===\n');
      console.log('1. Open your CODESYS project in CODESYS IDE');
      console.log('2. Navigate to: Device → Device Configuration');
      console.log('3. Select your device (PLC500 Industrial)');
      console.log('4. Look for "OPC UA" or "Symbol Configuration" settings');
      console.log('5. Enable "Support OPC UA Features"');
      console.log('6. Enable "Expose Variables to OPC UA" or similar option');
      console.log('7. Save and download the configuration to the PLC');
      console.log('8. Restart the PLC if needed\n');
      console.log('=== Alternative: Use EtherNet/IP ===\n');
      console.log('If OPC UA cannot be enabled, you can:');
      console.log('1. Enable EtherNet/IP explicit messaging in CODESYS');
      console.log('2. Use the EtherNet/IP driver (already implemented)');
      console.log('3. The driver is ready - just needs explicit messaging enabled\n');
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

findINT1_RUN().catch(console.error);

