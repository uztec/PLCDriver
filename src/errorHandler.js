/**
 * Error Handler Utilities
 * Provides better error messages for EtherNet/IP status codes
 */

import { STATUS_CODES } from './constants.js';

/**
 * Get human-readable error message for EIP status code
 */
export function getEIPStatusMessage(statusCode) {
  // EIP Status codes (from EtherNet/IP specification)
  const eipStatusMessages = {
    0x0000: 'Success',
    0x0001: 'Invalid or unsupported command',
    0x0002: 'Insufficient memory in the target device',
    0x0003: 'Invalid parameter value or malformed data',
    0x0065: 'Invalid session handle',
    0x0066: 'Invalid length',
    0x0067: 'Unsupported protocol version',
    0x0068: 'Invalid connection ID',
    0x0069: 'Connection type not supported',
    0x006A: 'Invalid connection size',
    0x006B: 'Module not configured or not available',
    0x006C: 'Ethernet link lost',
    0x006D: 'Invalid application path segment',
    0x006E: 'Invalid connection point',
    0x006F: 'Invalid connection format',
    0x0070: 'Connection manager error',
    0x0071: 'Connection in use',
    0x0072: 'Module failure',
    0x0073: 'Connection request timeout',
    0x0074: 'Unconnected message timeout',
    0x0075: 'Unconnected send parameter error',
    0x0076: 'Message too large',
    0x0077: 'Invalid segment type in path',
    0x0078: 'Connection not ready',
    0x0079: 'Path size invalid',
    0x007A: 'Connection timed out',
    0x007B: 'Resource unavailable',
    0x007C: 'Invalid connection point',
    0x007D: 'Invalid connection format',
    0x007E: 'Connection manager error',
    0x007F: 'Connection in use'
  };

  if (eipStatusMessages[statusCode]) {
    return eipStatusMessages[statusCode];
  }

  // Check CIP status codes
  const statusName = Object.keys(STATUS_CODES).find(
    key => STATUS_CODES[key] === statusCode
  );

  if (statusName) {
    return statusName.replace(/_/g, ' ').toLowerCase();
  }

  return `Unknown error (0x${statusCode.toString(16)})`;
}

/**
 * Get detailed error information
 */
export function getDetailedError(statusCode, context = '') {
  const message = getEIPStatusMessage(statusCode);
  const hexCode = `0x${statusCode.toString(16).padStart(2, '0').toUpperCase()}`;
  
  let suggestions = [];
  
  switch (statusCode) {
    case 0x0003: // Invalid parameter value
      suggestions = [
        'Check if the PLC supports the protocol version being used',
        'Verify the request format matches the PLC requirements',
        'Some PLCs require specific options flags in Register Session',
        'Try using a different protocol version (some PLCs use version 2)'
      ];
      break;
    case 0x0067: // Unsupported protocol version
      suggestions = [
        'Try using protocol version 2 instead of 1',
        'Check PLC documentation for supported protocol versions'
      ];
      break;
    case 0x0065: // Invalid session handle
      suggestions = [
        'Session may have expired or been closed',
        'Try reconnecting to establish a new session'
      ];
      break;
    default:
      suggestions = [
        'Check PLC documentation for this error code',
        'Verify network connectivity',
        'Check if PLC is in the correct mode',
        'Verify firewall settings'
      ];
  }

  return {
    code: statusCode,
    hex: hexCode,
    message,
    context,
    suggestions
  };
}

/**
 * Format error for display
 */
export function formatError(error, statusCode = null) {
  if (statusCode !== null) {
    const details = getDetailedError(statusCode, error.message || '');
    return {
      error: error.message || 'Unknown error',
      statusCode: details.hex,
      statusMessage: details.message,
      suggestions: details.suggestions
    };
  }
  
  return {
    error: error.message || 'Unknown error',
    suggestions: ['Check network connectivity', 'Verify PLC configuration']
  };
}

