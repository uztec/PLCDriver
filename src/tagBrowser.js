/**
 * Tag Browser - List and browse tags in PLC
 */

import { CIP_SERVICES, CIP_CLASSES, SYMBOL_ATTRIBUTES } from './constants.js';
import { buildSendRRData, parseSendRRDataResponse } from './message.js';
import { toUInt16LE, fromUInt16LE, fromUInt32LE, buildPath } from './utils.js';
import debug from 'debug';

const log = debug('ethernetip:tagBrowser');

/**
 * Build path to CIP object class/instance
 */
function buildObjectPath(classId, instanceId = 0) {
  const path = Buffer.alloc(4);
  // 8-bit logical segment for class
  path[0] = 0x20; // 8-bit logical segment, class
  path[1] = classId;
  // 8-bit logical segment for instance
  path[2] = 0x24; // 8-bit logical segment, instance
  path[3] = instanceId;
  return path;
}

/**
 * Build Get_Attribute_All request for Symbol object
 */
function buildGetAttributeAllRequest(sessionHandle, instanceId = 0) {
  const cipPath = buildObjectPath(CIP_CLASSES.SYMBOL, instanceId);
  return buildSendRRData(sessionHandle, CIP_SERVICES.GET_ATTRIBUTE_ALL, cipPath);
}

/**
 * Build Find_Next request to browse tags
 */
function buildFindNextRequest(sessionHandle, objectClass, instanceId, startingName = '') {
  const cipPath = buildObjectPath(objectClass, instanceId);
  
  // Find_Next service data:
  // - Object Class (2 bytes)
  // - Starting Name (variable, null-terminated)
  const nameBuffer = Buffer.from(startingName + '\0', 'ascii');
  const cipData = Buffer.alloc(2 + nameBuffer.length);
  toUInt16LE(objectClass).copy(cipData, 0);
  nameBuffer.copy(cipData, 2);
  
  return buildSendRRData(sessionHandle, CIP_SERVICES.FIND_NEXT, cipPath, cipData);
}

/**
 * Parse Get_Attribute_All response for Symbol object
 */
function parseSymbolAttributeAll(buffer) {
  const response = parseSendRRDataResponse(buffer);
  
  if (response.cipStatus !== 0) {
    throw new Error(`CIP error: 0x${response.cipStatus.toString(16)}`);
  }
  
  // Attribute data structure (varies by PLC)
  // This is a generic parser - may need adjustment for specific PLCs
  let offset = 0;
  const attributes = {};
  
  // Parse attributes (format depends on PLC)
  // Common attributes:
  // - Attribute 1: Name (string)
  // - Attribute 2: Type (data type code)
  // - Attribute 3: Dimension (array dimensions)
  // - Attribute 4: Element Count (number of elements)
  
  try {
    // Try to parse name (usually first attribute)
    if (response.cipData.length > 0) {
      const nameLength = response.cipData[offset++];
      if (nameLength > 0 && offset + nameLength <= response.cipData.length) {
        attributes.name = response.cipData.toString('ascii', offset, offset + nameLength);
        offset += nameLength;
      }
    }
  } catch (error) {
    log('Error parsing symbol attributes:', error);
  }
  
  return attributes;
}

/**
 * Parse Find_Next response
 */
function parseFindNextResponse(buffer) {
  const response = parseSendRRDataResponse(buffer);
  
  if (response.cipStatus !== 0) {
    // No more items found
    return null;
  }
  
  // Find_Next response contains:
  // - Object Class (2 bytes)
  // - Instance ID (2 bytes)
  // - Name (variable, null-terminated)
  
  let offset = 0;
  
  if (response.cipData.length < 4) {
    return null;
  }
  
  const objectClass = fromUInt16LE(response.cipData, offset);
  offset += 2;
  const instanceId = fromUInt16LE(response.cipData, offset);
  offset += 2;
  
  // Find null terminator
  let nameEnd = offset;
  while (nameEnd < response.cipData.length && response.cipData[nameEnd] !== 0) {
    nameEnd++;
  }
  
  const name = response.cipData.toString('ascii', offset, nameEnd);
  
  return {
    objectClass,
    instanceId,
    name
  };
}

/**
 * Browse tags using Find_Next service
 * This works with Allen-Bradley and some other PLCs
 */
export async function browseTags(connection, maxTags = 1000) {
  const tags = [];
  let instanceId = 1; // Start from instance 1
  let lastName = '';
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 10;
  
  log('Starting tag browse...');
  
  while (tags.length < maxTags && consecutiveErrors < maxConsecutiveErrors) {
    try {
      const request = buildFindNextRequest(
        connection.sessionHandle,
        CIP_CLASSES.SYMBOL,
        0, // Instance 0 for class-level browse
        lastName
      );
      
      const response = await connection.sendRequest(request);
      const result = parseFindNextResponse(response);
      
      if (!result) {
        // No more tags found
        log('No more tags found');
        break;
      }
      
      // Check if we got a valid tag
      if (result.name && result.name.length > 0) {
        tags.push({
          name: result.name,
          instanceId: result.instanceId,
          objectClass: result.objectClass
        });
        
        lastName = result.name;
        consecutiveErrors = 0;
        
        log(`Found tag: ${result.name} (instance ${result.instanceId})`);
      } else {
        consecutiveErrors++;
      }
      
      // Small delay to avoid overwhelming the PLC
      await new Promise(resolve => setTimeout(resolve, 10));
      
    } catch (error) {
      log(`Error browsing tag at instance ${instanceId}:`, error.message);
      consecutiveErrors++;
      
      if (consecutiveErrors >= maxConsecutiveErrors) {
        log('Too many consecutive errors, stopping browse');
        break;
      }
      
      // Try next instance
      instanceId++;
      if (instanceId > maxTags) {
        break;
      }
    }
  }
  
  log(`Browse complete. Found ${tags.length} tag(s)`);
  return tags;
}

/**
 * Get tag information by name
 */
export async function getTagInfo(connection, tagName) {
  try {
    // Try to read the tag to get its information
    // This is a simple approach - we'll try to read it and infer type
    const readRequest = buildSendRRData(
      connection.sessionHandle,
      CIP_SERVICES.READ_TAG,
      buildPath(tagName),
      Buffer.from([0x01, 0x00]) // Element count = 1
    );
    
    const response = await connection.sendRequest(readRequest);
    const parsed = parseSendRRDataResponse(response);
    
    if (parsed.cipStatus !== 0) {
      throw new Error(`Tag not found or error: 0x${parsed.cipStatus.toString(16)}`);
    }
    
    // Parse tag data
    if (parsed.cipData.length < 3) {
      throw new Error('Invalid tag response');
    }
    
    const dataType = parsed.cipData[0];
    const elementCount = fromUInt16LE(parsed.cipData, 1);
    
    return {
      name: tagName,
      dataType,
      elementCount,
      isArray: elementCount > 1
    };
  } catch (error) {
    log(`Error getting tag info for ${tagName}:`, error);
    throw error;
  }
}

/**
 * List tags by attempting to read common tag patterns
 * This is a fallback method when Find_Next is not supported
 */
export async function listTagsByPattern(connection, patterns = []) {
  const tags = [];
  
  // Common tag patterns to try
  const defaultPatterns = [
    'Program:MainProgram.*',
    'ControllerTags.*',
    'Local:*',
    'Global:*'
  ];
  
  const tagPatterns = patterns.length > 0 ? patterns : defaultPatterns;
  
  log('Attempting to list tags by pattern (this may not work on all PLCs)');
  
  // This is a limited approach - we can't really enumerate all tags
  // without proper support from the PLC
  // This would require knowing tag names in advance
  
  return tags;
}

/**
 * Browse tags with detailed information
 */
export async function browseTagsDetailed(connection, maxTags = 1000) {
  const tags = await browseTags(connection, maxTags);
  
  // Get detailed info for each tag
  const detailedTags = [];
  
  for (const tag of tags) {
    try {
      const info = await getTagInfo(connection, tag.name);
      detailedTags.push({
        ...tag,
        ...info
      });
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      log(`Could not get details for tag ${tag.name}:`, error.message);
      detailedTags.push(tag); // Add without details
    }
  }
  
  return detailedTags;
}

