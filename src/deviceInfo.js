/**
 * Device Information Utilities
 * Get PLC device information and properties
 */

import { CIP_SERVICES, CIP_CLASSES } from './constants.js';
import { buildSendRRData, parseSendRRDataResponse } from './message.js';
import { fromUInt16LE, fromUInt32LE } from './utils.js';
import debug from 'debug';

const log = debug('ethernetip:deviceInfo');

/**
 * Build path to CIP Identity object (class 0x01, instance 1)
 */
function buildIdentityPath() {
  // Path: Class 0x01 (Identity), Instance 1
  const path = Buffer.alloc(4);
  path[0] = 0x20; // 8-bit logical segment, class
  path[1] = CIP_CLASSES.IDENTITY;
  path[2] = 0x24; // 8-bit logical segment, instance
  path[3] = 1; // Instance 1
  return path;
}

/**
 * Parse Identity object Get_Attribute_All response
 */
function parseIdentityAttributes(buffer) {
  const response = parseSendRRDataResponse(buffer);
  
  if (response.cipStatus !== 0) {
    throw new Error(`CIP error getting identity: 0x${response.cipStatus.toString(16)}`);
  }
  
  // Identity object attributes (from CIP specification):
  // Attribute 1: Vendor ID (UINT)
  // Attribute 2: Device Type (UINT)
  // Attribute 3: Product Code (UINT)
  // Attribute 4: Revision (STRUCT of USINT major, USINT minor)
  // Attribute 5: Status (WORD)
  // Attribute 6: Serial Number (UDINT)
  // Attribute 7: Product Name (SHORT_STRING)
  // Attribute 8: State (USINT)
  
  let offset = 0;
  const attributes = {};
  
  try {
    // Attribute 1: Vendor ID (UINT - 2 bytes)
    if (response.cipData.length >= offset + 2) {
      attributes.vendorId = fromUInt16LE(response.cipData, offset);
      offset += 2;
    }
    
    // Attribute 2: Device Type (UINT - 2 bytes)
    if (response.cipData.length >= offset + 2) {
      attributes.deviceType = fromUInt16LE(response.cipData, offset);
      offset += 2;
    }
    
    // Attribute 3: Product Code (UINT - 2 bytes)
    if (response.cipData.length >= offset + 2) {
      attributes.productCode = fromUInt16LE(response.cipData, offset);
      offset += 2;
    }
    
    // Attribute 4: Revision (STRUCT - 2 bytes: major, minor)
    if (response.cipData.length >= offset + 2) {
      attributes.revision = {
        major: response.cipData[offset],
        minor: response.cipData[offset + 1]
      };
      offset += 2;
    }
    
    // Attribute 5: Status (WORD - 2 bytes)
    if (response.cipData.length >= offset + 2) {
      attributes.status = fromUInt16LE(response.cipData, offset);
      offset += 2;
    }
    
    // Attribute 6: Serial Number (UDINT - 4 bytes)
    if (response.cipData.length >= offset + 4) {
      attributes.serialNumber = fromUInt32LE(response.cipData, offset);
      offset += 4;
    }
    
    // Attribute 7: Product Name (SHORT_STRING - 1 byte length + string)
    if (response.cipData.length > offset) {
      const nameLength = response.cipData[offset++];
      if (nameLength > 0 && response.cipData.length >= offset + nameLength) {
        attributes.productName = response.cipData.toString('ascii', offset, offset + nameLength);
        offset += nameLength;
      }
    }
    
    // Attribute 8: State (USINT - 1 byte)
    if (response.cipData.length > offset) {
      attributes.state = response.cipData[offset];
    }
  } catch (error) {
    log('Error parsing identity attributes:', error);
    // Return partial data if available
  }
  
  return attributes;
}

/**
 * Get device information from PLC
 */
export async function getDeviceInfo(connection) {
  try {
    const cipPath = buildIdentityPath();
    const request = buildSendRRData(
      connection.sessionHandle,
      CIP_SERVICES.GET_ATTRIBUTE_ALL,
      cipPath
    );
    
    const response = await connection.sendRequest(request);
    const attributes = parseIdentityAttributes(response);
    
    return {
      vendorId: attributes.vendorId,
      deviceType: attributes.deviceType,
      productCode: attributes.productCode,
      revision: attributes.revision || { major: 0, minor: 0 },
      status: attributes.status || 0,
      serialNumber: attributes.serialNumber || 0,
      productName: attributes.productName || 'Unknown',
      state: attributes.state || 0
    };
  } catch (error) {
    log('Error getting device info:', error);
    throw error;
  }
}

/**
 * Get connection status with details
 */
export function getConnectionStatus(driver) {
  return {
    connected: driver.isConnected(),
    sessionHandle: driver.getSessionHandle(),
    host: driver.host,
    port: driver.port,
    timeout: driver.options.timeout
  };
}

