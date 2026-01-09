/**
 * EtherNet/IP Driver - Main API
 */

import { EventEmitter } from 'events';
import debug from 'debug';

const log = debug('ethernetip:driver');

import { CIP_DATA_TYPES } from './constants.js';
import { EIPConnection } from './connection.js';
import { 
  buildReadTagRequest, 
  buildWriteTagRequest, 
  parseReadTagResponse, 
  parseWriteTagResponse
} from './message.js';
import { decodeValue } from './utils.js';
import { 
  browseTags, 
  browseTagsDetailed, 
  getTagInfo,
  listTagsByPattern 
} from './tagBrowser.js';
import { getDeviceInfo, getConnectionStatus } from './deviceInfo.js';

export class EthernetIPDriver extends EventEmitter {
  constructor(host, port = 44818, options = {}) {
    super();
    this.host = host;
    this.port = port;
    this.options = {
      timeout: options.timeout || 5000,
      ...options
    };
    this.connection = new EIPConnection(host, port);
    this.connection.setTimeout(this.options.timeout);
    
    // Forward connection events
    this.connection.on('connected', () => {
      this.emit('connected');
    });
    
    this.connection.on('disconnected', () => {
      this.emit('disconnected');
    });
    
    this.connection.on('error', (error) => {
      this.emit('error', error);
    });
  }

  /**
   * Connect to PLC
   */
  async connect() {
    log(`Connecting to ${this.host}:${this.port}`);
    await this.connection.connect();
    log('Connected successfully');
  }

  /**
   * Disconnect from PLC
   */
  async disconnect() {
    log('Disconnecting...');
    await this.connection.disconnect();
    log('Disconnected');
  }

  /**
   * Read tag value
   * @param {string} tagName - Tag name (e.g., "MyTag" or "Program:MainProgram.MyTag")
   * @param {number} elementCount - Number of elements to read (default: 1)
   * @param {string} pathFormat - Path format: 'default', 'symbolic', '16bit', or 'withRouter' (default: 'default')
   * @param {boolean} useMessageRouter - Prepend Message Router path (01 00) - some PLCs require this (default: false)
   * @param {boolean|number} interfaceHandleFormat - Interface handle format: false (two 16-bit), true (32-bit), or number (timeout in ms)
   * @returns {Promise<any>} Tag value(s)
   */
  async readTag(tagName, elementCount = 1, pathFormat = 'default', useMessageRouter = false, interfaceHandleFormat = false) {
    if (!this.connection.connected) {
      throw new Error('Not connected to PLC');
    }

    log(`Reading tag: ${tagName} (${elementCount} elements, path format: ${pathFormat})`);

    try {
      const request = buildReadTagRequest(
        this.connection.sessionHandle,
        tagName,
        elementCount,
        pathFormat,
        useMessageRouter,
        interfaceHandleFormat
      );

      // Debug: log request details if debug is enabled
      if (process.env.DEBUG && process.env.DEBUG.includes('ethernetip')) {
        const { hexDump, analyzePath } = await import('./debugUtils.js');
        const { buildPath, buildPathSymbolic, buildPath16Bit } = await import('./utils.js');
        
        let testPath;
        if (pathFormat === 'symbolic') {
          testPath = buildPathSymbolic(tagName);
        } else if (pathFormat === '16bit') {
          testPath = buildPath16Bit(tagName);
        } else {
          testPath = buildPath(tagName);
        }
        
        log('Request details:');
        log(`  Tag name: ${tagName}`);
        log(`  Path format: ${pathFormat}`);
        log(`  Path analysis:`, JSON.stringify(analyzePath(testPath), null, 2));
        log(`  Request (first 64 bytes):`, hexDump(request.slice(0, 64), 'Request'));
      }

      const response = await this.connection.sendRequest(request);
      const parsed = parseReadTagResponse(response);

      if (parsed.cipStatus !== 0) {
        throw new Error(`CIP error reading tag: 0x${parsed.cipStatus.toString(16)}`);
      }

      // Decode value(s)
      if (elementCount === 1) {
        const value = decodeValue(parsed.dataType, parsed.data, 0);
        log(`Tag ${tagName} = ${value} (type: 0x${parsed.dataType.toString(16)})`);
        return value;
      } else {
        // Array read
        const values = [];
        let offset = 0;
        const elementSize = parsed.data.length / elementCount;
        
        for (let i = 0; i < elementCount; i++) {
          const value = decodeValue(parsed.dataType, parsed.data, offset);
          values.push(value);
          offset += elementSize;
        }
        
        log(`Tag ${tagName} = [${values.join(', ')}] (${elementCount} elements)`);
        return values;
      }
    } catch (error) {
      log(`Error reading tag ${tagName}:`, error);
      throw error;
    }
  }

  /**
   * Write tag value
   * @param {string} tagName - Tag name
   * @param {any} value - Value to write
   * @param {number} dataType - CIP data type (optional, will be inferred if not provided)
   * @param {number} elementCount - Number of elements to write (default: 1)
   * @returns {Promise<void>}
   */
  async writeTag(tagName, value, dataType = null, elementCount = 1) {
    if (!this.connection.connected) {
      throw new Error('Not connected to PLC');
    }

    // Infer data type if not provided
    if (dataType === null) {
      dataType = this._inferDataType(value);
    }

    log(`Writing tag: ${tagName} = ${value} (type: 0x${dataType.toString(16)}, elements: ${elementCount})`);

    try {
      const request = buildWriteTagRequest(
        this.connection.sessionHandle,
        tagName,
        dataType,
        value,
        elementCount
      );

      const response = await this.connection.sendRequest(request);
      const parsed = parseWriteTagResponse(response);

      if (parsed.cipStatus !== 0) {
        throw new Error(`CIP error writing tag: 0x${parsed.cipStatus.toString(16)}`);
      }

      log(`Tag ${tagName} written successfully`);
    } catch (error) {
      log(`Error writing tag ${tagName}:`, error);
      throw error;
    }
  }

  /**
   * Write multiple tag values (array)
   * @param {string} tagName - Tag name
   * @param {Array} values - Array of values to write
   * @param {number} dataType - CIP data type (optional)
   * @returns {Promise<void>}
   */
  async writeTagArray(tagName, values, dataType = null) {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('values must be a non-empty array');
    }

    // Infer data type from first value if not provided
    if (dataType === null) {
      dataType = this._inferDataType(values[0]);
    }

    // For array writes, we need to handle it differently
    // For now, we'll write the first element and log a warning
    log('Warning: Array writes are currently limited. Writing first element only.');
    return this.writeTag(tagName, values[0], dataType, values.length);
  }

  /**
   * Read multiple tags
   * @param {Array<string>} tagNames - Array of tag names
   * @returns {Promise<Object>} Object with tag names as keys and values as values
   */
  async readTags(tagNames) {
    const results = {};
    
    for (const tagName of tagNames) {
      try {
        results[tagName] = await this.readTag(tagName);
      } catch (error) {
        results[tagName] = { error: error.message };
      }
    }
    
    return results;
  }

  /**
   * Infer CIP data type from JavaScript value
   */
  _inferDataType(value) {
    if (typeof value === 'boolean') {
      return CIP_DATA_TYPES.BOOL;
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        if (value >= -128 && value <= 127) {
          return CIP_DATA_TYPES.SINT;
        } else if (value >= 0 && value <= 255) {
          return CIP_DATA_TYPES.USINT;
        } else if (value >= -32768 && value <= 32767) {
          return CIP_DATA_TYPES.INT;
        } else if (value >= 0 && value <= 65535) {
          return CIP_DATA_TYPES.UINT;
        } else {
          return CIP_DATA_TYPES.DINT;
        }
      } else {
        return CIP_DATA_TYPES.REAL;
      }
    } else if (typeof value === 'string') {
      return CIP_DATA_TYPES.STRING;
    } else {
      throw new Error(`Cannot infer data type for value: ${value}`);
    }
  }

  /**
   * List all tags in the PLC
   * @param {number} maxTags - Maximum number of tags to retrieve (default: 1000)
   * @param {boolean} detailed - Get detailed information for each tag (default: false)
   * @returns {Promise<Array>} Array of tag objects
   */
  async listTags(maxTags = 1000, detailed = false) {
    if (!this.connection.connected) {
      throw new Error('Not connected to PLC');
    }

    log(`Listing tags (max: ${maxTags}, detailed: ${detailed})`);

    try {
      if (detailed) {
        return await browseTagsDetailed(this.connection, maxTags);
      } else {
        return await browseTags(this.connection, maxTags);
      }
    } catch (error) {
      log('Error listing tags:', error);
      throw error;
    }
  }

  /**
   * Browse tags (alias for listTags)
   * @param {number} maxTags - Maximum number of tags to retrieve (default: 1000)
   * @returns {Promise<Array>} Array of tag objects
   */
  async browseTags(maxTags = 1000) {
    return this.listTags(maxTags, false);
  }

  /**
   * Get information about a specific tag
   * @param {string} tagName - Tag name
   * @returns {Promise<Object>} Tag information
   */
  async getTagInfo(tagName) {
    if (!this.connection.connected) {
      throw new Error('Not connected to PLC');
    }

    log(`Getting tag info for: ${tagName}`);

    try {
      return await getTagInfo(this.connection, tagName);
    } catch (error) {
      log(`Error getting tag info for ${tagName}:`, error);
      throw error;
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connection.connected;
  }

  /**
   * Get session handle
   */
  getSessionHandle() {
    return this.connection.sessionHandle;
  }

  /**
   * Get connection status and details
   * @returns {Object} Connection status information
   */
  getConnectionStatus() {
    return getConnectionStatus(this);
  }

  /**
   * Get PLC device information
   * @returns {Promise<Object>} Device information
   */
  async getDeviceInfo() {
    if (!this.connection.connected) {
      throw new Error('Not connected to PLC');
    }

    log('Getting device information...');

    try {
      return await getDeviceInfo(this.connection);
    } catch (error) {
      log('Error getting device info:', error);
      throw error;
    }
  }

  /**
   * Get PLC properties (connection status + device info)
   * @returns {Promise<Object>} Complete PLC properties
   */
  async getProperties() {
    const properties = {
      connection: this.getConnectionStatus(),
      device: null
    };

    if (this.connection.connected) {
      try {
        properties.device = await this.getDeviceInfo();
      } catch (error) {
        properties.deviceError = error.message;
        log('Could not get device info:', error);
      }
    }

    return properties;
  }
}

export default EthernetIPDriver;

