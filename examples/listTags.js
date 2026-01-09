/**
 * Example: List and browse tags in PLC
 */

import EthernetIPDriver from '../index.js';

// PLC Configuration
const PLC_IP = '192.168.1.100'; // Replace with your PLC's IP address
const PLC_PORT = 44818;

async function main() {
  // Create driver instance
  const driver = new EthernetIPDriver(PLC_IP, PLC_PORT, {
    timeout: 5000
  });

  try {
    // Connect to PLC
    console.log('Connecting to PLC...');
    await driver.connect();
    console.log('Connected!\n');

    // Method 1: List all tags (simple)
    console.log('=== Listing all tags ===');
    try {
      const tags = await driver.listTags(100); // Get up to 100 tags
      
      if (tags.length === 0) {
        console.log('No tags found. The PLC may not support tag browsing.');
        console.log('Note: Tag browsing requires Find_Next service support.');
      } else {
        console.log(`Found ${tags.length} tag(s):\n`);
        tags.forEach((tag, index) => {
          console.log(`${index + 1}. ${tag.name} (instance: ${tag.instanceId})`);
        });
      }
    } catch (error) {
      console.error('Error listing tags:', error.message);
      console.log('\nNote: This PLC may not support tag browsing via Find_Next service.');
    }

    // Method 2: List tags with detailed information
    console.log('\n=== Listing tags with details ===');
    try {
      const detailedTags = await driver.listTags(50, true); // Get up to 50 tags with details
      
      if (detailedTags.length > 0) {
        console.log(`Found ${detailedTags.length} tag(s) with details:\n`);
        detailedTags.slice(0, 10).forEach((tag, index) => { // Show first 10
          console.log(`${index + 1}. ${tag.name}`);
          if (tag.dataType !== undefined) {
            console.log(`   Type: 0x${tag.dataType.toString(16)}`);
            console.log(`   Elements: ${tag.elementCount}`);
            console.log(`   Array: ${tag.isArray ? 'Yes' : 'No'}`);
          }
          console.log('');
        });
        
        if (detailedTags.length > 10) {
          console.log(`... and ${detailedTags.length - 10} more tags`);
        }
      }
    } catch (error) {
      console.error('Error listing detailed tags:', error.message);
    }

    // Method 3: Get information about a specific tag
    console.log('\n=== Getting tag information ===');
    const testTagName = 'MyTag'; // Replace with an actual tag name
    try {
      const tagInfo = await driver.getTagInfo(testTagName);
      console.log(`Tag: ${tagInfo.name}`);
      console.log(`  Data Type: 0x${tagInfo.dataType.toString(16)}`);
      console.log(`  Element Count: ${tagInfo.elementCount}`);
      console.log(`  Is Array: ${tagInfo.isArray ? 'Yes' : 'No'}`);
    } catch (error) {
      console.error(`Error getting info for tag "${testTagName}":`, error.message);
      console.log('(This is expected if the tag does not exist)');
    }

    // Method 4: Browse tags (alias for listTags)
    console.log('\n=== Browsing tags ===');
    try {
      const browsedTags = await driver.browseTags(20); // Get up to 20 tags
      console.log(`Browsed ${browsedTags.length} tag(s)`);
      if (browsedTags.length > 0) {
        console.log('Sample tags:');
        browsedTags.slice(0, 5).forEach(tag => {
          console.log(`  - ${tag.name}`);
        });
      }
    } catch (error) {
      console.error('Error browsing tags:', error.message);
    }

    // Disconnect
    console.log('\nDisconnecting...');
    await driver.disconnect();
    console.log('Disconnected');
  } catch (error) {
    console.error('Error:', error);
    await driver.disconnect();
    process.exit(1);
  }
}

main();

