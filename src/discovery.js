/**
 * EtherNet/IP Network Discovery
 * Uses UDP List Identity service to discover PLCs on the network
 */

import { createSocket } from 'dgram';
import { EventEmitter } from 'events';
import debug from 'debug';

const log = debug('ethernetip:discovery');

import { EIP_COMMANDS, DEFAULT_PORTS } from './constants.js';
import { buildEIPHeader, parseEIPHeader } from './message.js';
import { fromUInt16LE, fromUInt32LE } from './utils.js';

/**
 * Build List Identity request message
 */
function buildListIdentityRequest() {
  // List Identity uses a special format - just the EIP header with List Identity command
  // No additional data is required
  return buildEIPHeader(EIP_COMMANDS.LIST_IDENTITY, 0);
}

/**
 * Parse List Identity response
 */
function parseListIdentityResponse(buffer) {
  if (buffer.length < 24) {
    throw new Error('Response too short');
  }

  const header = parseEIPHeader(buffer);

  if (header.command !== EIP_COMMANDS.LIST_IDENTITY) {
    throw new Error(`Unexpected command: 0x${header.command.toString(16)}`);
  }

  if (header.status !== 0) {
    throw new Error(`EIP Status error: 0x${header.status.toString(16)}`);
  }

  // List Identity response structure (after 24-byte header):
  // - Encapsulation Version (2 bytes)
  // - Socket Address (16 bytes)
  //   - sin_family (2 bytes) - should be 2 (AF_INET)
  //   - sin_port (2 bytes) - port number
  //   - sin_addr (4 bytes) - IP address
  //   - sin_zero (8 bytes) - padding
  // - Vendor ID (2 bytes)
  // - Device Type (2 bytes)
  // - Product Code (2 bytes)
  // - Revision (2 bytes)
  // - Status (2 bytes)
  // - Serial Number (4 bytes)
  // - Product Name Length (1 byte)
  // - Product Name (variable)
  // - State (1 byte)

  let offset = 24;

  if (buffer.length < offset + 2) {
    throw new Error('Insufficient data for encapsulation version');
  }

  const encapVersion = fromUInt16LE(buffer, offset);
  offset += 2;

  // Socket Address (16 bytes)
  if (buffer.length < offset + 16) {
    throw new Error('Insufficient data for socket address');
  }

  const sinFamily = fromUInt16LE(buffer, offset);
  const sinPort = fromUInt16LE(buffer, offset + 2);
  const sinAddr = [
    buffer[offset + 4],
    buffer[offset + 5],
    buffer[offset + 6],
    buffer[offset + 7]
  ];
  const ipAddress = sinAddr.join('.');
  offset += 16;

  // Vendor ID
  if (buffer.length < offset + 2) {
    throw new Error('Insufficient data for vendor ID');
  }
  const vendorId = fromUInt16LE(buffer, offset);
  offset += 2;

  // Device Type
  if (buffer.length < offset + 2) {
    throw new Error('Insufficient data for device type');
  }
  const deviceType = fromUInt16LE(buffer, offset);
  offset += 2;

  // Product Code
  if (buffer.length < offset + 2) {
    throw new Error('Insufficient data for product code');
  }
  const productCode = fromUInt16LE(buffer, offset);
  offset += 2;

  // Revision
  if (buffer.length < offset + 2) {
    throw new Error('Insufficient data for revision');
  }
  const revision = fromUInt16LE(buffer, offset);
  offset += 2;

  // Status
  if (buffer.length < offset + 2) {
    throw new Error('Insufficient data for status');
  }
  const status = fromUInt16LE(buffer, offset);
  offset += 2;

  // Serial Number
  if (buffer.length < offset + 4) {
    throw new Error('Insufficient data for serial number');
  }
  const serialNumber = fromUInt32LE(buffer, offset);
  offset += 4;

  // Product Name Length
  if (buffer.length < offset + 1) {
    throw new Error('Insufficient data for product name length');
  }
  const productNameLength = buffer[offset++];

  // Product Name
  let productName = '';
  if (productNameLength > 0 && buffer.length >= offset + productNameLength) {
    productName = buffer.toString('ascii', offset, offset + productNameLength);
    offset += productNameLength;
  }

  // State
  let state = 0;
  if (buffer.length > offset) {
    state = buffer[offset];
  }

  return {
    ipAddress,
    port: sinPort,
    vendorId,
    deviceType,
    productCode,
    revision: {
      major: (revision >> 8) & 0xFF,
      minor: revision & 0xFF
    },
    status,
    serialNumber,
    productName,
    state,
    sinFamily
  };
}

/**
 * Discover PLCs on the network
 * @param {number} timeout - Timeout in milliseconds (default: 3000)
 * @param {string} broadcastAddress - Broadcast address (default: '255.255.255.255')
 * @returns {Promise<Array>} Array of discovered devices
 */
export async function discoverPLCs(timeout = 3000, broadcastAddress = '255.255.255.255') {
  return new Promise((resolve, reject) => {
    const socket = createSocket('udp4');
    const discoveredDevices = [];
    const deviceMap = new Map(); // To avoid duplicates

    socket.on('message', (msg, rinfo) => {
      try {
        log(`Received response from ${rinfo.address}:${rinfo.port}`);
        const device = parseListIdentityResponse(msg);
        
        // Use IP address as unique key
        const key = device.ipAddress;
        if (!deviceMap.has(key)) {
          deviceMap.set(key, device);
          discoveredDevices.push(device);
          log(`Discovered device: ${device.productName} at ${device.ipAddress}`);
        }
      } catch (error) {
        log(`Error parsing response from ${rinfo.address}:`, error.message);
      }
    });

    socket.on('error', (error) => {
      log('Socket error:', error);
      socket.close();
      reject(error);
    });

    socket.bind(() => {
      socket.setBroadcast(true);
      
      const request = buildListIdentityRequest();
      const port = DEFAULT_PORTS.IMPLICIT; // UDP port 2222
      
      log(`Broadcasting List Identity request to ${broadcastAddress}:${port}`);
      socket.send(request, port, broadcastAddress, (err) => {
        if (err) {
          log('Error sending broadcast:', err);
          socket.close();
          reject(err);
          return;
        }
        
        log('Broadcast sent, waiting for responses...');
      });
    });

    // Set timeout
    setTimeout(() => {
      socket.close();
      log(`Discovery complete. Found ${discoveredDevices.length} device(s)`);
      resolve(discoveredDevices);
    }, timeout);
  });
}

/**
 * Discover a specific PLC by IP address
 * @param {string} ipAddress - IP address of the PLC
 * @param {number} timeout - Timeout in milliseconds (default: 2000)
 * @param {boolean} verbose - Enable verbose logging (default: false)
 * @returns {Promise<Object|null>} Device information or null if not found
 */
export async function discoverPLC(ipAddress, timeout = 2000, verbose = false) {
  return new Promise((resolve, reject) => {
    const socket = createSocket('udp4');
    let device = null;
    let responseReceived = false;

    socket.on('message', (msg, rinfo) => {
      responseReceived = true;
      if (verbose) {
        console.log(`Received ${msg.length} bytes from ${rinfo.address}:${rinfo.port}`);
        console.log(`First 24 bytes (header):`, msg.slice(0, 24).toString('hex'));
      }
      
      try {
        if (rinfo.address === ipAddress) {
          device = parseListIdentityResponse(msg);
          log(`Discovered device at ${ipAddress}: ${device.productName}`);
          socket.close();
          resolve(device);
        } else {
          if (verbose) {
            console.log(`Response from different IP: ${rinfo.address} (expected ${ipAddress})`);
          }
        }
      } catch (error) {
        if (verbose) {
          console.error(`Error parsing response from ${rinfo.address}:`, error.message);
          console.error('Response data:', msg.toString('hex'));
        }
        log(`Error parsing response from ${rinfo.address}:`, error.message);
      }
    });

    socket.on('error', (error) => {
      log('Socket error:', error);
      if (verbose) {
        console.error('UDP socket error:', error);
      }
      socket.close();
      reject(error);
    });

    socket.bind(() => {
      socket.setBroadcast(true);
      
      const request = buildListIdentityRequest();
      const port = DEFAULT_PORTS.IMPLICIT;
      
      if (verbose) {
        console.log(`Sending List Identity request to ${ipAddress}:${port}`);
        console.log(`Request (${request.length} bytes):`, request.toString('hex'));
      }
      
      log(`Sending List Identity request to ${ipAddress}:${port}`);
      socket.send(request, port, ipAddress, (err) => {
        if (err) {
          log('Error sending request:', err);
          if (verbose) {
            console.error('Error sending UDP request:', err);
          }
          socket.close();
          reject(err);
          return;
        }
        if (verbose) {
          console.log('Request sent successfully');
        }
      });
    });

    // Set timeout
    setTimeout(() => {
      socket.close();
      if (!device) {
        if (verbose) {
          if (!responseReceived) {
            console.log(`No response received from ${ipAddress}:${DEFAULT_PORTS.IMPLICIT}`);
            console.log('Possible reasons:');
            console.log('  1. PLC does not support List Identity service');
            console.log('  2. Firewall blocking UDP port 2222');
            console.log('  3. PLC is not on the network');
            console.log('  4. Network configuration issue');
            console.log('\nTip: Try using testConnection() to verify TCP connectivity');
          } else {
            console.log(`Response received but could not parse or from different IP`);
          }
        }
        log(`No response from ${ipAddress}`);
        resolve(null);
      }
    }, timeout);
  });
}

/**
 * Discovery class for continuous discovery
 */
export class PLCDiscovery extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.isDiscovering = false;
    this.discoveredDevices = new Map();
  }

  /**
   * Start continuous discovery
   */
  start(interval = 5000, broadcastAddress = '255.255.255.255') {
    if (this.isDiscovering) {
      return;
    }

    this.isDiscovering = true;
    this.socket = createSocket('udp4');

    this.socket.on('message', (msg, rinfo) => {
      try {
        const device = parseListIdentityResponse(msg);
        const key = device.ipAddress;
        
        if (!this.discoveredDevices.has(key)) {
          this.discoveredDevices.set(key, device);
          this.emit('device', device);
          log(`New device discovered: ${device.productName} at ${device.ipAddress}`);
        } else {
          // Update existing device
          this.discoveredDevices.set(key, device);
          this.emit('deviceUpdate', device);
        }
      } catch (error) {
        log(`Error parsing response from ${rinfo.address}:`, error.message);
      }
    });

    this.socket.on('error', (error) => {
      log('Socket error:', error);
      this.emit('error', error);
    });

    this.socket.bind(() => {
      this.socket.setBroadcast(true);
      this._sendDiscovery(broadcastAddress);
      
      // Set up interval
      this.interval = setInterval(() => {
        this._sendDiscovery(broadcastAddress);
      }, interval);
    });
  }

  /**
   * Send discovery broadcast
   */
  _sendDiscovery(broadcastAddress) {
    if (!this.socket) return;
    
    const request = buildListIdentityRequest();
    const port = DEFAULT_PORTS.IMPLICIT;
    
    this.socket.send(request, port, broadcastAddress, (err) => {
      if (err) {
        log('Error sending broadcast:', err);
        this.emit('error', err);
      }
    });
  }

  /**
   * Stop discovery
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.isDiscovering = false;
  }

  /**
   * Get discovered devices
   */
  getDevices() {
    return Array.from(this.discoveredDevices.values());
  }
}

