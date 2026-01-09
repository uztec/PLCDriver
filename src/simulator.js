/**
 * EtherNet/IP PLC Simulator
 * 
 * Simulates a PLC for testing the driver without physical hardware.
 * Supports:
 * - Register/Unregister Session
 * - Tag read/write operations
 * - Network discovery (List Identity)
 * - Multiple data types
 */

import { createServer } from 'net';
import { createSocket } from 'dgram';
import { EventEmitter } from 'events';
import debug from 'debug';

const log = debug('ethernetip:simulator');

import { EIP_COMMANDS, CIP_SERVICES, CIP_DATA_TYPES, DEFAULT_PORTS } from './constants.js';
import { buildEIPHeader, parseEIPHeader } from './message.js';
import { toUInt16LE, toUInt32LE, fromUInt16LE, fromUInt32LE, buildPath, encodeValue, decodeValue, parsePath } from './utils.js';

export class PLCSimulator extends EventEmitter {
  constructor(options = {}) {
    super();
    this.port = options.port || DEFAULT_PORTS.EXPLICIT;
    this.udpPort = options.udpPort || DEFAULT_PORTS.IMPLICIT;
    this.host = options.host || '0.0.0.0';
    
    // Tag database (in-memory)
    this.tags = new Map();
    this.tagTypes = new Map(); // Store data types for tags
    
    // Session management
    this.sessions = new Map();
    this.nextSessionHandle = 1;
    
    // Server instances
    this.tcpServer = null;
    this.udpSocket = null;
    
    // Device information for discovery
    this.deviceInfo = {
      vendorId: options.vendorId || 1,
      deviceType: options.deviceType || 12,
      productCode: options.productCode || 1,
      revision: {
        major: options.revisionMajor || 1,
        minor: options.revisionMinor || 0
      },
      serialNumber: options.serialNumber || 12345,
      productName: options.productName || 'EtherNet/IP Simulator',
      status: 0,
      state: 0
    };
    
    // Initialize with some default tags
    this._initializeDefaultTags();
  }

  /**
   * Initialize default tags for testing
   */
  _initializeDefaultTags() {
    // Add some test tags
    this.setTag('MyTag', 42, CIP_DATA_TYPES.DINT);
    this.setTag('MyBoolTag', true, CIP_DATA_TYPES.BOOL);
    this.setTag('MyIntTag', 12345, CIP_DATA_TYPES.INT);
    this.setTag('MyRealTag', 3.14159, CIP_DATA_TYPES.REAL);
    this.setTag('MyStringTag', 'Hello PLC', CIP_DATA_TYPES.STRING);
    this.setTag('MyArrayTag', [1, 2, 3, 4, 5], CIP_DATA_TYPES.DINT);
  }

  /**
   * Set a tag value
   */
  setTag(name, value, dataType = null) {
    if (dataType === null) {
      // Infer data type
      if (typeof value === 'boolean') {
        dataType = CIP_DATA_TYPES.BOOL;
      } else if (typeof value === 'number') {
        dataType = Number.isInteger(value) ? CIP_DATA_TYPES.DINT : CIP_DATA_TYPES.REAL;
      } else if (typeof value === 'string') {
        dataType = CIP_DATA_TYPES.STRING;
      } else if (Array.isArray(value)) {
        dataType = CIP_DATA_TYPES.DINT; // Default for arrays
      }
    }
    
    this.tags.set(name, value);
    this.tagTypes.set(name, dataType);
    this.emit('tagChanged', { name, value, dataType });
    log(`Tag set: ${name} = ${value} (type: 0x${dataType.toString(16)})`);
  }

  /**
   * Get a tag value
   */
  getTag(name) {
    return this.tags.get(name);
  }

  /**
   * Get tag data type
   */
  getTagType(name) {
    return this.tagTypes.get(name);
  }

  /**
   * List all tags
   */
  listTags() {
    return Array.from(this.tags.keys());
  }

  /**
   * Start the simulator
   */
  async start() {
    return new Promise((resolve, reject) => {
      // Start TCP server for explicit messaging
      this.tcpServer = createServer((socket) => {
        this._handleTCPConnection(socket);
      });

      this.tcpServer.on('error', (error) => {
        log('TCP Server error:', error);
        this.emit('error', error);
      });

      this.tcpServer.listen(this.port, this.host, () => {
        log(`TCP server listening on ${this.host}:${this.port}`);
        this.emit('listening', { type: 'tcp', port: this.port });
      });

      // Start UDP socket for discovery
      this.udpSocket = createSocket('udp4');
      
      this.udpSocket.on('message', (msg, rinfo) => {
        this._handleUDPMessage(msg, rinfo);
      });

      this.udpSocket.on('error', (error) => {
        log('UDP Socket error:', error);
        this.emit('error', error);
      });

      this.udpSocket.bind(this.udpPort, this.host, () => {
        this.udpSocket.setBroadcast(true);
        log(`UDP socket listening on ${this.host}:${this.udpPort}`);
        this.emit('listening', { type: 'udp', port: this.udpPort });
        resolve();
      });
    });
  }

  /**
   * Stop the simulator
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.tcpServer) {
        this.tcpServer.close(() => {
          log('TCP server closed');
          this.tcpServer = null;
        });
      }

      if (this.udpSocket) {
        this.udpSocket.close(() => {
          log('UDP socket closed');
          this.udpSocket = null;
        });
      }

      setTimeout(resolve, 100);
    });
  }

  /**
   * Handle TCP connection
   */
  _handleTCPConnection(socket) {
    const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    log(`New TCP connection from ${clientAddress}`);

    socket.on('data', (data) => {
      try {
        this._handleTCPMessage(socket, data);
      } catch (error) {
        log(`Error handling message from ${clientAddress}:`, error);
        this.emit('error', error);
      }
    });

    socket.on('error', (error) => {
      log(`Socket error for ${clientAddress}:`, error);
    });

    socket.on('close', () => {
      log(`Connection closed: ${clientAddress}`);
      // Clean up sessions for this socket
      for (const [handle, session] of this.sessions.entries()) {
        if (session.socket === socket) {
          this.sessions.delete(handle);
        }
      }
    });
  }

  /**
   * Handle TCP message
   */
  _handleTCPMessage(socket, buffer) {
    if (buffer.length < 24) {
      log('Message too short');
      return;
    }

    const header = parseEIPHeader(buffer);
    log(`Received command: 0x${header.command.toString(16)}, length: ${header.length}`);

    switch (header.command) {
      case EIP_COMMANDS.REGISTER_SESSION:
        this._handleRegisterSession(socket, header, buffer);
        break;
      case EIP_COMMANDS.UNREGISTER_SESSION:
        this._handleUnregisterSession(socket, header);
        break;
      case EIP_COMMANDS.SEND_RR_DATA:
        this._handleSendRRData(socket, header, buffer);
        break;
      default:
        log(`Unsupported command: 0x${header.command.toString(16)}`);
        this._sendErrorResponse(socket, header, 0x01); // Invalid command
    }
  }

  /**
   * Handle Register Session
   */
  _handleRegisterSession(socket, header, buffer) {
    const sessionHandle = this.nextSessionHandle++;
    this.sessions.set(sessionHandle, {
      socket,
      handle: sessionHandle,
      createdAt: Date.now()
    });

    const response = buildEIPHeader(
      EIP_COMMANDS.REGISTER_SESSION,
      4,
      sessionHandle,
      0, // Status: success
      header.senderContext
    );
    
    const data = Buffer.alloc(4);
    toUInt16LE(1).copy(data, 0); // Protocol version
    toUInt16LE(0).copy(data, 2); // Options flags
    
    const fullResponse = Buffer.concat([response, data]);
    socket.write(fullResponse);
    log(`Session registered: ${sessionHandle}`);
  }

  /**
   * Handle Unregister Session
   */
  _handleUnregisterSession(socket, header) {
    if (this.sessions.has(header.sessionHandle)) {
      this.sessions.delete(header.sessionHandle);
      log(`Session unregistered: ${header.sessionHandle}`);
    }
    
    const response = buildEIPHeader(
      EIP_COMMANDS.UNREGISTER_SESSION,
      0,
      header.sessionHandle,
      0,
      header.senderContext
    );
    
    socket.write(response);
  }

  /**
   * Handle SendRRData (explicit messaging)
   */
  _handleSendRRData(socket, header, buffer) {
    if (!this.sessions.has(header.sessionHandle)) {
      log(`Invalid session handle: ${header.sessionHandle}`);
      return;
    }

    let offset = 24; // Skip EIP header
    
    // Interface handle (4 bytes)
    const interfaceHandle = fromUInt32LE(buffer, offset);
    offset += 4;
    
    // CIP Length (2 bytes)
    const cipLength = fromUInt16LE(buffer, offset);
    offset += 2;
    
    // CIP Packet
    const cipPacket = buffer.slice(offset, offset + cipLength);
    
    if (cipPacket.length < 1) {
      log('CIP packet too short');
      return;
    }

    const cipService = cipPacket[0];
    const cipPathSize = cipPacket[1];
    const cipPath = cipPacket.slice(2, 2 + cipPathSize * 2);
    const cipData = cipPacket.slice(2 + cipPathSize * 2);

    log(`CIP Service: 0x${cipService.toString(16)}`);

    let responseData = Buffer.alloc(0);
    let cipStatus = 0;

    switch (cipService) {
      case CIP_SERVICES.READ_TAG:
        responseData = this._handleReadTag(cipPath, cipData);
        break;
      case CIP_SERVICES.WRITE_TAG:
        cipStatus = this._handleWriteTag(cipPath, cipData);
        break;
      default:
        log(`Unsupported CIP service: 0x${cipService.toString(16)}`);
        cipStatus = 0x08; // Service not supported
    }

    // Build response
    const cipResponse = Buffer.alloc(1 + responseData.length);
    cipResponse[0] = cipStatus;
    responseData.copy(cipResponse, 1);

    const interfaceHandleBuffer = Buffer.alloc(4);
    toUInt32LE(interfaceHandle).copy(interfaceHandleBuffer, 0);
    
    const cipLengthBuffer = toUInt16LE(cipResponse.length);
    
    const rrData = Buffer.concat([
      interfaceHandleBuffer,
      cipLengthBuffer,
      cipResponse
    ]);

    const response = buildEIPHeader(
      EIP_COMMANDS.SEND_RR_DATA,
      rrData.length,
      header.sessionHandle,
      0,
      header.senderContext
    );

    socket.write(Buffer.concat([response, rrData]));
  }

  /**
   * Handle Read Tag
   */
  _handleReadTag(cipPath, cipData) {
    // Parse tag name from path
    const tagName = this._parseTagNameFromPath(cipPath);
    
    if (!tagName) {
      log('Could not parse tag name from path');
      return Buffer.from([0x16]); // Object does not exist
    }

    const elementCount = cipData.length >= 2 ? fromUInt16LE(cipData, 0) : 1;
    
    log(`Read tag: ${tagName}, elements: ${elementCount}`);

    const tagValue = this.getTag(tagName);
    const tagType = this.getTagType(tagName);

    if (tagValue === undefined || tagType === undefined) {
      log(`Tag not found: ${tagName}`);
      return Buffer.from([0x16]); // Object does not exist
    }

    // Build response: [DataType (1 byte)] [ElementCount (2 bytes)] [Data (variable)]
    const response = Buffer.alloc(3);
    response[0] = tagType;
    toUInt16LE(elementCount).copy(response, 1);

    // Encode value(s)
    if (Array.isArray(tagValue)) {
      // Array
      const values = tagValue.slice(0, elementCount);
      let dataBuffer = Buffer.alloc(0);
      for (const val of values) {
        const encoded = encodeValue(tagType, val);
        dataBuffer = Buffer.concat([dataBuffer, encoded]);
      }
      return Buffer.concat([response, dataBuffer]);
    } else {
      // Single value
      const encoded = encodeValue(tagType, tagValue);
      return Buffer.concat([response, encoded]);
    }
  }

  /**
   * Handle Write Tag
   */
  _handleWriteTag(cipPath, cipData) {
    // Parse tag name from path
    const tagName = this._parseTagNameFromPath(cipPath);
    
    if (!tagName) {
      log('Could not parse tag name from path');
      return 0x16; // Object does not exist
    }

    if (cipData.length < 3) {
      log('Write tag data too short');
      return 0x03; // Invalid parameter value
    }

    const elementCount = fromUInt16LE(cipData, 0);
    const dataType = cipData[2];
    const valueData = cipData.slice(3);

    log(`Write tag: ${tagName}, type: 0x${dataType.toString(16)}, elements: ${elementCount}`);

    try {
      if (elementCount === 1) {
        // Single value
        const value = decodeValue(dataType, valueData, 0);
        this.setTag(tagName, value, dataType);
      } else {
        // Array
        const values = [];
        let offset = 0;
        const elementSize = valueData.length / elementCount;
        for (let i = 0; i < elementCount; i++) {
          const value = decodeValue(dataType, valueData, offset);
          values.push(value);
          offset += elementSize;
        }
        this.setTag(tagName, values, dataType);
      }
      return 0; // Success
    } catch (error) {
      log(`Error writing tag: ${error.message}`);
      return 0x03; // Invalid parameter value
    }
  }

  /**
   * Parse tag name from CIP path
   */
  _parseTagNameFromPath(cipPath) {
    try {
      const { segments } = parsePath(cipPath);
      if (segments.length === 0) {
        return null;
      }
      
      // Extract tag name from symbolic segments
      const tagParts = [];
      for (const segment of segments) {
        if (segment.type === 'symbolic' && segment.name) {
          tagParts.push(segment.name);
        }
      }
      
      return tagParts.length > 0 ? tagParts.join('.') : null;
    } catch (error) {
      log(`Error parsing path: ${error.message}`);
      return null;
    }
  }

  /**
   * Handle UDP message (discovery)
   */
  _handleUDPMessage(msg, rinfo) {
    if (msg.length < 24) {
      return;
    }

    const header = parseEIPHeader(msg);
    
    if (header.command === EIP_COMMANDS.LIST_IDENTITY) {
      this._handleListIdentity(rinfo);
    }
  }

  /**
   * Handle List Identity (discovery)
   */
  _handleListIdentity(rinfo) {
    log(`List Identity request from ${rinfo.address}:${rinfo.port}`);

    // Build List Identity response
    const header = buildEIPHeader(EIP_COMMANDS.LIST_IDENTITY, 0);
    
    // Encapsulation version (2 bytes)
    const encapVersion = toUInt16LE(1);
    
    // Socket address (16 bytes)
    const socketAddr = Buffer.alloc(16);
    toUInt16LE(2).copy(socketAddr, 0); // AF_INET
    toUInt16LE(this.port).copy(socketAddr, 2); // Port
    // IP address (4 bytes) - use local address
    const ipParts = rinfo.address.split('.');
    socketAddr[4] = parseInt(ipParts[0] || '127');
    socketAddr[5] = parseInt(ipParts[1] || '0');
    socketAddr[6] = parseInt(ipParts[2] || '0');
    socketAddr[7] = parseInt(ipParts[3] || '1');
    // sin_zero (8 bytes) - padding
    
    // Vendor ID (2 bytes)
    const vendorId = toUInt16LE(this.deviceInfo.vendorId);
    
    // Device Type (2 bytes)
    const deviceType = toUInt16LE(this.deviceInfo.deviceType);
    
    // Product Code (2 bytes)
    const productCode = toUInt16LE(this.deviceInfo.productCode);
    
    // Revision (2 bytes)
    const revision = Buffer.alloc(2);
    revision[0] = this.deviceInfo.revision.major;
    revision[1] = this.deviceInfo.revision.minor;
    
    // Status (2 bytes)
    const status = toUInt16LE(this.deviceInfo.status);
    
    // Serial Number (4 bytes)
    const serialNumber = toUInt32LE(this.deviceInfo.serialNumber);
    
    // Product Name
    const productName = Buffer.from(this.deviceInfo.productName, 'ascii');
    const productNameLength = Buffer.alloc(1);
    productNameLength[0] = productName.length;
    
    // State (1 byte)
    const state = Buffer.alloc(1);
    state[0] = this.deviceInfo.state;
    
    // Calculate total length
    const dataLength = 2 + 16 + 2 + 2 + 2 + 2 + 2 + 4 + 1 + productName.length + 1;
    const responseHeader = buildEIPHeader(EIP_COMMANDS.LIST_IDENTITY, dataLength);
    
    const response = Buffer.concat([
      responseHeader,
      encapVersion,
      socketAddr,
      vendorId,
      deviceType,
      productCode,
      revision,
      status,
      serialNumber,
      productNameLength,
      productName,
      state
    ]);

    this.udpSocket.send(response, rinfo.port, rinfo.address, (err) => {
      if (err) {
        log('Error sending List Identity response:', err);
      } else {
        log(`List Identity response sent to ${rinfo.address}:${rinfo.port}`);
      }
    });
  }

  /**
   * Send error response
   */
  _sendErrorResponse(socket, header, status) {
    const response = buildEIPHeader(
      header.command,
      0,
      header.sessionHandle,
      status,
      header.senderContext
    );
    socket.write(response);
  }
}

export default PLCSimulator;

