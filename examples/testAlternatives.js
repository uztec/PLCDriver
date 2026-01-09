/**
 * Test alternative communication protocols with CODESYS PLC
 * Tests: OPC UA, Modbus TCP, REST API
 */

const PLC_IP = '10.88.48.100';

async function testOPCUA() {
  console.log('\n=== Testing OPC UA ===');
  try {
    // Try to import node-opcua (may not be installed)
    const { OPCUAClient } = await import('node-opcua');
    
    const client = OPCUAClient.create({
      endpointMustExist: false,
      connectionStrategy: {
        initialDelay: 1000,
        maxRetry: 3
      }
    });
    
    console.log('Attempting OPC UA connection...');
    await client.connect(`opc.tcp://${PLC_IP}:4840`);
    console.log('✓ OPC UA connection successful!');
    console.log('  OPC UA is available on this PLC');
    console.log('  You can use node-opcua library for communication');
    await client.disconnect();
    return true;
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.log('✗ node-opcua library not installed');
      console.log('  Install with: npm install node-opcua');
    } else {
      console.log(`✗ OPC UA not available: ${error.message}`);
      console.log('  OPC UA may not be enabled on this PLC');
    }
    return false;
  }
}

async function testModbusTCP() {
  console.log('\n=== Testing Modbus TCP ===');
  try {
    // Try to import modbus-serial (may not be installed)
    const ModbusRTU = (await import('modbus-serial')).default;
    
    const client = new ModbusRTU();
    
    console.log('Attempting Modbus TCP connection...');
    await client.connectTCP(PLC_IP, { port: 502 });
    console.log('✓ Modbus TCP connection successful!');
    console.log('  Modbus TCP is available on this PLC');
    console.log('  You can use modbus-serial library for communication');
    await client.close();
    return true;
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.log('✗ modbus-serial library not installed');
      console.log('  Install with: npm install modbus-serial');
    } else {
      console.log(`✗ Modbus TCP not available: ${error.message}`);
      console.log('  Modbus TCP may not be enabled on this PLC');
    }
    return false;
  }
}

async function testRESTAPI() {
  console.log('\n=== Testing REST API ===');
  const ports = [8080, 8443, 80, 443];
  
  for (const port of ports) {
    try {
      const fetch = (await import('node-fetch')).default;
      const url = `http://${PLC_IP}:${port}/api/v1/status`;
      
      console.log(`Trying port ${port}...`);
      const response = await fetch(url, { 
        method: 'GET',
        timeout: 2000 
      });
      
      if (response.ok) {
        console.log(`✓ REST API available on port ${port}!`);
        console.log('  CODESYS REST API is available');
        console.log('  You can use standard HTTP client for communication');
        return true;
      }
    } catch (error) {
      // Continue to next port
    }
  }
  
  console.log('✗ REST API not available on common ports');
  console.log('  REST API may not be enabled on this PLC');
  return false;
}

async function testAllAlternatives() {
  console.log('=== Testing Alternative Communication Protocols ===');
  console.log(`PLC: ${PLC_IP}\n`);
  console.log('Testing available communication methods...\n');
  
  const results = {
    opcua: false,
    modbus: false,
    rest: false
  };
  
  results.opcua = await testOPCUA();
  results.modbus = await testModbusTCP();
  results.rest = await testRESTAPI();
  
  console.log('\n=== Summary ===');
  console.log('Available protocols:');
  console.log(`  OPC UA: ${results.opcua ? '✓ Available' : '✗ Not available'}`);
  console.log(`  Modbus TCP: ${results.modbus ? '✓ Available' : '✗ Not available'}`);
  console.log(`  REST API: ${results.rest ? '✓ Available' : '✗ Not available'}`);
  
  if (!results.opcua && !results.modbus && !results.rest) {
    console.log('\n⚠ No alternative protocols found');
    console.log('Recommendation: Enable EtherNet/IP explicit messaging in CODESYS IDE');
  } else {
    console.log('\n✓ Alternative protocols found!');
    console.log('You can use these instead of EtherNet/IP explicit messaging');
    console.log('See CODESYS_ALTERNATIVES.md for implementation details');
  }
}

testAllAlternatives().catch(console.error);

