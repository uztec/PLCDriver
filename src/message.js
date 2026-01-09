/**
 * EtherNet/IP Message Builder and Parser
 */

import { EIP_COMMANDS, CIP_SERVICES } from './constants.js';
import { toUInt16LE, toUInt32LE, fromUInt16LE, fromUInt32LE, buildPath, buildPathSymbolic, buildPath16Bit, buildPathStandard, buildMessageRouterPath, buildMessageRouterPathCompact, encodeValue, decodeValue } from './utils.js';
import { getDetailedError } from './errorHandler.js';

/**
 * Build EtherNet/IP message header
 */
export function buildEIPHeader(command, length, sessionHandle = 0, status = 0, senderContext = Buffer.alloc(8, 0), options = 0) {
  const header = Buffer.alloc(24);
  
  // Command (2 bytes)
  toUInt16LE(command).copy(header, 0);
  
  // Length (2 bytes)
  toUInt16LE(length).copy(header, 2);
  
  // Session Handle (4 bytes)
  toUInt32LE(sessionHandle).copy(header, 4);
  
  // Status (4 bytes)
  toUInt32LE(status).copy(header, 8);
  
  // Sender Context (8 bytes)
  senderContext.copy(header, 12);
  
  // Options (4 bytes)
  toUInt32LE(options).copy(header, 20);
  
  return header;
}

/**
 * Parse EtherNet/IP message header
 */
export function parseEIPHeader(buffer) {
  return {
    command: fromUInt16LE(buffer, 0),
    length: fromUInt16LE(buffer, 2),
    sessionHandle: fromUInt32LE(buffer, 4),
    status: fromUInt32LE(buffer, 8),
    senderContext: buffer.slice(12, 20),
    options: fromUInt32LE(buffer, 20)
  };
}

/**
 * Build Register Session message
 * @param {number} protocolVersion - Protocol version (default: 1)
 * @param {number} optionsFlags - Options flags (default: 0)
 */
export function buildRegisterSession(protocolVersion = 1, optionsFlags = 0) {
  const header = buildEIPHeader(EIP_COMMANDS.REGISTER_SESSION, 4);
  const data = Buffer.alloc(4);
  toUInt16LE(protocolVersion).copy(data, 0); // Protocol version
  toUInt16LE(optionsFlags).copy(data, 2); // Options flags
  return Buffer.concat([header, data]);
}

/**
 * Build Unregister Session message
 */
export function buildUnregisterSession(sessionHandle) {
  return buildEIPHeader(EIP_COMMANDS.UNREGISTER_SESSION, 0, sessionHandle);
}

/**
 * Build SendRRData message (explicit messaging)
 * @param {number} sessionHandle - Session handle
 * @param {number} cipService - CIP service code
 * @param {Buffer} cipPath - CIP path
 * @param {Buffer} cipData - CIP data
 * @param {Buffer} senderContext - Sender context (8 bytes)
 * @param {boolean|number} interfaceHandleFormat - Interface handle format: false (two 16-bit), true (32-bit), or number (timeout in ms)
 */
export function buildSendRRData(sessionHandle, cipService, cipPath, cipData = Buffer.alloc(0), senderContext = null, interfaceHandleFormat = false) {
  // CIP Interface Handle (4 bytes: 2 bytes handle + 2 bytes timeout)
  // Interface handle = 0 for CIP, Timeout = 0 (no timeout)
  // According to EtherNet/IP spec, this should be two 16-bit values:
  // - Interface Handle (UINT16) = 0 for CIP
  // - Timeout (UINT16) = 0 for no timeout (some PLCs may require non-zero)
  // Some PLCs may require timeout in milliseconds (e.g., 5000 = 5 seconds)
  // Some PLCs may expect this as a single 32-bit value instead of two 16-bit values
  const interfaceHandle = Buffer.alloc(4);
  
  if (interfaceHandleFormat === true) {
    // Some PLCs expect interface handle as a single 32-bit value (0x00000000)
    interfaceHandle.writeUInt32LE(0, 0);
  } else if (typeof interfaceHandleFormat === 'number') {
    // Timeout specified in milliseconds
    interfaceHandle.writeUInt16LE(0, 0); // Interface handle (0 for CIP)
    interfaceHandle.writeUInt16LE(interfaceHandleFormat, 2); // Timeout in milliseconds
  } else {
    // Standard format: two 16-bit values
    interfaceHandle.writeUInt16LE(0, 0); // Interface handle (0 for CIP)
    interfaceHandle.writeUInt16LE(0, 2); // Timeout (0 = no timeout)
  }
  
  // CIP Path size (in 16-bit words) + CIP Path (must be word-aligned)
  // Pad path to even number of bytes if needed
  const paddedPath = cipPath.length % 2 === 0 ? cipPath : Buffer.concat([cipPath, Buffer.from([0])]);
  const pathSize = paddedPath.length / 2;
  
  if (pathSize > 255) {
    throw new Error(`CIP path too long: ${pathSize} words (max 255)`);
  }
  
  const pathSizeBuffer = Buffer.alloc(1);
  pathSizeBuffer[0] = pathSize;
  
  // CIP Service + Path + Data
  const cipPacket = Buffer.concat([
    Buffer.from([cipService]),
    pathSizeBuffer,
    paddedPath,
    cipData
  ]);
  
  // SendRRData structure
  const rrData = Buffer.concat([
    interfaceHandle,
    toUInt16LE(cipPacket.length),
    cipPacket
  ]);
  
  // Generate unique sender context if not provided (for request/response matching)
  let context = senderContext;
  if (!context) {
    context = Buffer.alloc(8);
    // Use timestamp and random for uniqueness
    const timestamp = Date.now();
    context.writeUInt32LE(timestamp & 0xFFFFFFFF, 0);
    context.writeUInt32LE(Math.floor(Math.random() * 0xFFFFFFFF), 4);
  }
  
  const header = buildEIPHeader(EIP_COMMANDS.SEND_RR_DATA, rrData.length, sessionHandle, 0, context);
  
  return Buffer.concat([header, rrData]);
}

/**
 * Build Read Tag request
 * @param {number} sessionHandle - Session handle
 * @param {string} tagName - Tag name
 * @param {number} elementCount - Element count
 * @param {string} pathFormat - Path format: 'default', 'symbolic', '16bit', or 'withRouter' (default: 'default')
 * @param {boolean} useMessageRouter - Prepend Message Router path (01 00) - some PLCs require this
 */
export function buildReadTagRequest(sessionHandle, tagName, elementCount = 1, pathFormat = 'default', useMessageRouter = false, interfaceHandleFormat = false) {
  let cipPath;
  
  if (pathFormat === 'symbolic') {
    cipPath = buildPathSymbolic(tagName);
  } else if (pathFormat === '16bit') {
    cipPath = buildPath16Bit(tagName);
  } else if (pathFormat === 'standard') {
    cipPath = buildPathStandard(tagName);
  } else if (pathFormat === 'withRouter') {
    cipPath = buildPath(tagName, true, false); // Include Message Router prefix (standard format)
  } else if (pathFormat === 'withRouterCompact') {
    cipPath = buildPath(tagName, true, true); // Include Message Router prefix (01 00 compact format)
  } else {
    cipPath = buildPath(tagName, useMessageRouter, false);
  }
  
  const cipData = Buffer.alloc(2);
  toUInt16LE(elementCount).copy(cipData, 0);
  
  return buildSendRRData(sessionHandle, CIP_SERVICES.READ_TAG, cipPath, cipData, null, interfaceHandleFormat);
}

/**
 * Build Write Tag request
 */
export function buildWriteTagRequest(sessionHandle, tagName, dataType, value, elementCount = 1) {
  const cipPath = buildPath(tagName);
  const encodedValue = encodeValue(dataType, value);
  
  const cipData = Buffer.alloc(3 + encodedValue.length);
  toUInt16LE(elementCount).copy(cipData, 0);
  cipData[2] = dataType;
  encodedValue.copy(cipData, 3);
  
  return buildSendRRData(sessionHandle, CIP_SERVICES.WRITE_TAG, cipPath, cipData);
}

/**
 * Parse SendRRData response
 */
export function parseSendRRDataResponse(buffer) {
  const header = parseEIPHeader(buffer);
  
  if (header.command !== EIP_COMMANDS.SEND_RR_DATA) {
    throw new Error(`Unexpected command: 0x${header.command.toString(16)}`);
  }
  
  if (header.status !== 0) {
    const errorDetails = getDetailedError(header.status, 'SendRRData');
    const error = new Error(
      `EIP Status error: ${errorDetails.message} (${errorDetails.hex})`
    );
    error.statusCode = header.status;
    error.statusHex = errorDetails.hex;
    error.statusMessage = errorDetails.message;
    error.suggestions = errorDetails.suggestions;
    throw error;
  }
  
  let offset = 24; // Skip EIP header
  
  // Interface handle (4 bytes)
  const interfaceHandle = fromUInt32LE(buffer, offset);
  offset += 4;
  
  // CIP Length (2 bytes)
  const cipLength = fromUInt16LE(buffer, offset);
  offset += 2;
  
  // CIP Status (1 byte)
  const cipStatus = buffer[offset++];
  
  if (cipStatus !== 0) {
    throw new Error(`CIP Status error: 0x${cipStatus.toString(16)}`);
  }
  
  // CIP Data (cipLength includes the status byte, so subtract 1)
  const cipData = buffer.slice(offset, offset + cipLength - 1);
  
  return {
    sessionHandle: header.sessionHandle,
    interfaceHandle,
    cipStatus,
    cipData
  };
}

/**
 * Parse Read Tag response
 */
export function parseReadTagResponse(buffer) {
  const response = parseSendRRDataResponse(buffer);
  
  if (response.cipData.length < 2) {
    throw new Error('Invalid Read Tag response: insufficient data');
  }
  
  const dataType = response.cipData[0];
  const elementCount = fromUInt16LE(response.cipData, 1);
  const data = response.cipData.slice(3);
  
  return {
    dataType,
    elementCount,
    data,
    cipStatus: response.cipStatus
  };
}

/**
 * Parse Write Tag response
 */
export function parseWriteTagResponse(buffer) {
  const response = parseSendRRDataResponse(buffer);
  
  return {
    cipStatus: response.cipStatus
  };
}

