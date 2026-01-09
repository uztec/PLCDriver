/**
 * Check if the EtherNet/IP Adapter requires specific configuration
 * Based on device info: CODESYS EtherNet/IP Adapter v4.8.0.0
 */

import { EthernetIPDriver } from '../index.js';

const PLC_IP = '10.88.48.100';
const PLC_PORT = 44818;

async function checkAdapterConfig() {
  console.log('=== CODESYS EtherNet/IP Adapter Configuration Check ===\n');
  console.log('Device Information:');
  console.log('  Name: EtherNet/IP Adapter');
  console.log('  Vendor: CODESYS');
  console.log('  Version: 4.8.0.0');
  console.log('  Configuration Version: 3.5.15.0');
  console.log('  Type: 120 (0x0078)');
  console.log('  ID: 0000 1016\n');
  
  console.log('Important Notes:');
  console.log('1. This is an EtherNet/IP ADAPTER (not a scanner)');
  console.log('2. Adapters typically act as servers, responding to requests');
  console.log('3. Explicit messaging should work, but may require configuration\n');
  
  const driver = new EthernetIPDriver(PLC_IP, PLC_PORT);
  
  try {
    console.log('Testing connection...');
    await driver.connect();
    console.log('✓ Connected successfully!');
    console.log(`  Session Handle: ${driver.getSessionHandle()}\n`);
    
    console.log('=== Configuration Checklist ===\n');
    console.log('Please check the following in CODESYS IDE:\n');
    
    console.log('1. Device Configuration:');
    console.log('   - Open Device Configuration in CODESYS IDE');
    console.log('   - Select "EtherNet/IP Adapter" device');
    console.log('   - Check "Properties" or "Settings" tab');
    console.log('   - Look for:');
    console.log('     * "Explicit Messaging" option');
    console.log('     * "SendRRData" option');
    console.log('     * "Enable Explicit Messaging" checkbox');
    console.log('     * "Security" or "Access Control" settings\n');
    
    console.log('2. Communication Settings:');
    console.log('   - Check "Communication" or "Network" settings');
    console.log('   - Verify port 44818 is enabled');
    console.log('   - Check firewall/security rules');
    console.log('   - Look for IP address restrictions\n');
    
    console.log('3. Runtime Settings:');
    console.log('   - Check CODESYS Runtime settings');
    console.log('   - Look for EtherNet/IP specific options');
    console.log('   - Verify adapter mode is enabled\n');
    
    console.log('4. Additional EDS Files:');
    console.log('   The following EDS files were mentioned:');
    console.log('   - CODESYS_EtherNetIP_Adapter_Chassis.eds');
    console.log('   - CODESYS_EtherNetIP_Adapter_CommunicationModule.eds');
    console.log('   - EtherNetIPAdapterStrings.xml');
    console.log('   These may contain configuration parameters\n');
    
    console.log('5. Version-Specific Notes:');
    console.log('   - Adapter Version: 4.8.0.0');
    console.log('   - Configuration Version: 3.5.15.0');
    console.log('   - Check CODESYS release notes for version 4.8.0.0');
    console.log('   - Look for known issues with explicit messaging\n');
    
    console.log('=== Testing Minimal Request ===\n');
    
    // Try the most minimal request possible
    try {
      const result = await driver.readTag('INT1_RUN', 1);
      console.log('✓ SUCCESS! Explicit messaging works!');
      console.log(`  Tag value: ${result}`);
    } catch (error) {
      console.log('✗ Explicit messaging still fails:');
      console.log(`  Error: ${error.message}`);
      if (error.statusCode) {
        console.log(`  Status: 0x${error.statusHex}`);
      }
      console.log('\nThis confirms explicit messaging needs to be enabled in configuration.');
    }
    
  } catch (error) {
    console.error(`✗ Error: ${error.message}`);
  } finally {
    await driver.disconnect();
    console.log('\n=== Complete ===');
  }
}

checkAdapterConfig().catch(console.error);

