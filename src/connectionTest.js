/**
 * Connection Testing Utilities
 * 
 * Test if a PLC is reachable and supports EtherNet/IP,
 * even if discovery (List Identity) doesn't work.
 */

import { Socket } from 'net';
import debug from 'debug';

const log = debug('ethernetip:connectionTest');

import { DEFAULT_PORTS } from './constants.js';
import { buildRegisterSession, parseEIPHeader } from './message.js';
import { fromUInt32LE } from './utils.js';

/**
 * Test if a PLC is reachable via TCP (port 44818)
 * This works even if List Identity discovery doesn't work
 * 
 * @param {string} ipAddress - IP address of the PLC
 * @param {number} port - Port number (default: 44818)
 * @param {number} timeout - Timeout in milliseconds (default: 3000)
 * @returns {Promise<Object>} Connection test result
 */
export async function testConnection(ipAddress, port = DEFAULT_PORTS.EXPLICIT, timeout = 3000) {
  return new Promise((resolve) => {
    const socket = new Socket();
    let connected = false;
    let sessionRegistered = false;
    let sessionHandle = 0;
    const startTime = Date.now();

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      connected = true;
      log(`TCP connection established to ${ipAddress}:${port}`);
      
      // Try to register a session
      const registerRequest = buildRegisterSession();
      socket.write(registerRequest);
    });

    socket.on('data', (data) => {
      if (data.length >= 24) {
        const header = parseEIPHeader(data);
        
        if (header.command === 0x0065) { // REGISTER_SESSION
          if (header.status === 0) {
            sessionRegistered = true;
            sessionHandle = header.sessionHandle;
            log(`Session registered: ${sessionHandle}`);
          }
          socket.destroy();
        }
      }
    });

    socket.on('timeout', () => {
      socket.destroy();
    });

    socket.on('error', (error) => {
      log(`Connection error: ${error.message}`);
      socket.destroy();
    });

    socket.on('close', () => {
      const responseTime = Date.now() - startTime;
      
      resolve({
        ipAddress,
        port,
        reachable: connected,
        sessionSupported: sessionRegistered,
        sessionHandle: sessionRegistered ? sessionHandle : 0,
        responseTime,
        status: connected 
          ? (sessionRegistered ? 'ready' : 'connected_but_no_session')
          : 'unreachable'
      });
    });

    // Attempt connection
    socket.connect(port, ipAddress, () => {
      // Connection initiated, wait for events
    });
  });
}

/**
 * Test multiple PLCs
 * 
 * @param {Array<string>} ipAddresses - Array of IP addresses to test
 * @param {number} port - Port number (default: 44818)
 * @param {number} timeout - Timeout per PLC (default: 3000)
 * @returns {Promise<Array>} Array of test results
 */
export async function testConnections(ipAddresses, port = DEFAULT_PORTS.EXPLICIT, timeout = 3000) {
  const results = [];
  
  for (const ip of ipAddresses) {
    const result = await testConnection(ip, port, timeout);
    results.push(result);
  }
  
  return results;
}

/**
 * Verify if a PLC supports EtherNet/IP protocol
 * Combines discovery and connection testing
 * 
 * @param {string} ipAddress - IP address of the PLC
 * @param {number} timeout - Timeout in milliseconds (default: 5000)
 * @returns {Promise<Object>} Verification result
 */
export async function verifyPLC(ipAddress, timeout = 5000) {
  const results = {
    ipAddress,
    discovery: null,
    connection: null,
    recommended: null
  };

  // Try discovery first
  try {
    const { discoverPLC } = await import('./discovery.js');
    results.discovery = await discoverPLC(ipAddress, Math.min(timeout, 2000), false);
  } catch (error) {
    results.discovery = { error: error.message };
  }

  // Test TCP connection
  try {
    results.connection = await testConnection(ipAddress, DEFAULT_PORTS.EXPLICIT, timeout);
  } catch (error) {
    results.connection = { error: error.message };
  }

  // Provide recommendation
  if (results.discovery && !results.discovery.error) {
    results.recommended = 'use_discovery';
  } else if (results.connection && results.connection.reachable && results.connection.sessionSupported) {
    results.recommended = 'use_direct_connection';
    results.recommendedMessage = 'PLC is reachable via TCP but does not support List Identity discovery. You can still connect directly.';
  } else if (results.connection && results.connection.reachable) {
    results.recommended = 'connection_issue';
    results.recommendedMessage = 'PLC is reachable but session registration failed. Check PLC configuration.';
  } else {
    results.recommended = 'unreachable';
    results.recommendedMessage = 'PLC is not reachable. Check network connectivity and firewall settings.';
  }

  return results;
}

