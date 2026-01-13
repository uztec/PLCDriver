/**
 * List all available tags from CODESYS OPC UA server
 */

import OPCUADriver from '../lib-opcua-driver/src/opcuaDriver.js';
import { readFileSync } from 'fs';

// Try to load config.json, fallback to environment variables or defaults
let PLC_IP = '10.88.48.100';
let PLC_PORT = 4840;

try {
  const config = JSON.parse(readFileSync('./config.json', 'utf8'));
  PLC_IP = config.plc?.ip || PLC_IP;
  PLC_PORT = config.plc?.port || PLC_PORT;
} catch (e) {
  // config.json not found, use environment variables or defaults
}

PLC_IP = process.env.PLC_IP || PLC_IP;
PLC_PORT = parseInt(process.env.PLC_PORT || PLC_PORT);

async function listAllTags() {
  console.log('=== Listing All Tags from CODESYS OPC UA Server ===\n');
  console.log(`PLC: ${PLC_IP}:${PLC_PORT}\n`);

  const driver = new OPCUADriver(PLC_IP, PLC_PORT);

  try {
    console.log('Connecting...');
    await driver.connect();
    console.log('✓ Connected!\n');

    console.log('Browsing all tags (this may take a moment)...\n');
    
    // Try different starting points for CODESYS
    const startingPoints = [
      { nodeId: "RootFolder", description: "Root Folder" },
      { nodeId: "ns=4;s=|var|", description: "Namespace 4 Variables" },
      { nodeId: "ns=4;s=|plc|", description: "Namespace 4 PLC" },
      { nodeId: "ns=2;s=DeviceSet", description: "Device Set" }
    ];

    let allTags = [];
    const foundTags = new Set(); // To avoid duplicates

    for (const start of startingPoints) {
      try {
        console.log(`Trying ${start.description}...`);
        const tags = await driver.listAllTags(start.nodeId, 10, "ns=4");
        
        // Add unique tags (by Node ID)
        for (const tag of tags) {
          if (!foundTags.has(tag.nodeId)) {
            allTags.push(tag);
            foundTags.add(tag.nodeId);
          }
        }
        
        if (tags.length > 0) {
          console.log(`  ✓ Found ${tags.length} tag(s) from ${start.description}\n`);
        }
      } catch (error) {
        // Continue to next starting point
        console.log(`  ✗ Error browsing ${start.description}: ${error.message}\n`);
      }
    }

    // If no tags found with namespace filter, try without filter
    if (allTags.length === 0) {
      console.log('No tags found with namespace filter. Trying all namespaces...\n');
      try {
        const tags = await driver.listAllTags("RootFolder", 10);
        
        // Add unique tags
        for (const tag of tags) {
          if (!foundTags.has(tag.nodeId)) {
            allTags.push(tag);
            foundTags.add(tag.nodeId);
          }
        }
      } catch (error) {
        console.log(`Error browsing all namespaces: ${error.message}\n`);
      }
    }

    if (allTags.length === 0) {
      console.log('✗ No tags found.\n');
      console.log('Make sure OPC UA features are enabled in CODESYS:');
      console.log('  Tools → Symbol Configuration → Enable "Support OPC UA Features"\n');
    } else {
      console.log(`\n✓ Found ${allTags.length} unique tag(s) total:\n`);
      displayTags(allTags);
    }

    await driver.disconnect();
    console.log('\n✓ Disconnected');

  } catch (error) {
    console.error(`✗ Error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

function displayTags(tags) {
  // Sort tags by path for better readability
  tags.sort((a, b) => a.path.localeCompare(b.path));

  // Group by path prefix
  const grouped = {};
  for (const tag of tags) {
    const parts = tag.path.split('.');
    const prefix = parts.length > 1 ? parts.slice(0, -1).join('.') : 'Root';
    if (!grouped[prefix]) {
      grouped[prefix] = [];
    }
    grouped[prefix].push(tag);
  }

  // Display grouped tags
  for (const [prefix, tagList] of Object.entries(grouped).sort()) {
    if (prefix !== 'Root') {
      console.log(`📁 ${prefix}`);
    }
    
    for (const tag of tagList) {
      const displayName = tag.path.includes('.') ? tag.path.split('.').pop() : tag.name;
      const valueStr = tag.value !== null ? ` = ${JSON.stringify(tag.value)}` : '';
      const typeStr = tag.dataType ? ` (${tag.dataType})` : '';
      console.log(`  📊 ${displayName}${valueStr}${typeStr}`);
      console.log(`     Node ID: ${tag.nodeId}`);
    }
    console.log('');
  }

  // Summary
  console.log('=== Summary ===');
  console.log(`Total tags: ${tags.length}`);
  console.log(`Groups: ${Object.keys(grouped).length}`);
  
  // Show some statistics
  const withValues = tags.filter(t => t.value !== null).length;
  const withTypes = tags.filter(t => t.dataType).length;
  console.log(`Tags with values: ${withValues}`);
  console.log(`Tags with data types: ${withTypes}`);
}

listAllTags().catch(console.error);

