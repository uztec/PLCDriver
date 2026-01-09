/**
 * EtherNet/IP Connection Manager
 */

import { EventEmitter } from 'events';
import { Socket } from 'net';
import debug from 'debug';

const log = debug('ethernetip:connection');

import { DEFAULT_PORTS, EIP_COMMANDS } from './constants.js';
import { buildRegisterSession, buildUnregisterSession, parseEIPHeader } from './message.js';
import { getDetailedError } from './errorHandler.js';

export class EIPConnection extends EventEmitter {
  constructor(host, port = DEFAULT_PORTS.EXPLICIT) {
    super();
    this.host = host;
    this.port = port;
    this.socket = null;
    this.sessionHandle = 0;
    this.connected = false;
    this.pendingRequests = new Map();
    this.requestId = 0;
    this.timeout = 5000;
  }

  /**
   * Connect to PLC
   */
  async connect() {
    return new Promise((resolve, reject) => {
      if (this.connected) {
        resolve();
        return;
      }

      log(`Connecting to ${this.host}:${this.port}`);

      this.socket = new Socket();
      
      this.socket.on('connect', () => {
        log('Socket connected');
        this._registerSession();
      });

      this.socket.on('data', (data) => {
        this._handleData(data);
      });

      this.socket.on('error', (error) => {
        log('Socket error:', error);
        this.connected = false;
        this.emit('error', error);
        reject(error);
      });

      this.socket.on('close', () => {
        log('Socket closed');
        this.connected = false;
        this.sessionHandle = 0;
        this.emit('close');
      });

      this.socket.on('timeout', () => {
        log('Socket timeout');
        this.socket.destroy();
        reject(new Error('Connection timeout'));
      });

      this.socket.setTimeout(this.timeout);
      this.socket.connect(this.port, this.host, () => {
        // Connection established, wait for session registration
      });

      // Store resolve/reject for session registration
      this._connectResolve = resolve;
      this._connectReject = reject;
    });
  }

  /**
   * Register session with PLC
   */
  _registerSession() {
    const message = buildRegisterSession();
    this.socket.write(message);
    log('Sent Register Session request');
  }

  /**
   * Handle incoming data
   */
  _handleData(data) {
    log(`Received ${data.length} bytes`);
    
    // Check if we have enough data for a header
    if (data.length < 24) {
      log('Insufficient data for header');
      return;
    }

    const header = parseEIPHeader(data);
    log('Received message:', {
      command: `0x${header.command.toString(16)}`,
      length: header.length,
      sessionHandle: header.sessionHandle,
      status: header.status
    });

    // Handle Register Session response
    if (header.command === 0x0065) { // REGISTER_SESSION
      if (header.status === 0) {
        this.sessionHandle = header.sessionHandle;
        this.connected = true;
        log(`Session registered: ${this.sessionHandle}`);
        if (this._connectResolve) {
          this._connectResolve();
          this._connectResolve = null;
          this._connectReject = null;
        }
        this.emit('connected');
      } else {
        const errorDetails = getDetailedError(header.status, 'Register Session');
        const error = new Error(
          `Register Session failed: ${errorDetails.message} (${errorDetails.hex})`
        );
        error.statusCode = header.status;
        error.statusHex = errorDetails.hex;
        error.statusMessage = errorDetails.message;
        error.suggestions = errorDetails.suggestions;
        log('Register Session failed:', error);
        if (this._connectReject) {
          this._connectReject(error);
          this._connectResolve = null;
          this._connectReject = null;
        }
        this.emit('error', error);
      }
      return;
    }

    // Handle other responses (SendRRData, etc.)
    if (this._pendingResponse) {
      // Check if this is an error response
      if (header.status !== 0) {
        const errorDetails = getDetailedError(header.status, 'EIP Response');
        const error = new Error(
          `EIP Status error: ${errorDetails.message} (${errorDetails.hex})`
        );
        error.statusCode = header.status;
        error.statusHex = errorDetails.hex;
        error.statusMessage = errorDetails.message;
        error.suggestions = errorDetails.suggestions;
        error.responseData = data; // Include response for debugging
        this._pendingResponse.reject(error);
      } else {
        this._pendingResponse.resolve(data);
      }
      this._pendingResponse = null;
    }
  }

  /**
   * Send message and wait for response
   */
  async sendRequest(message) {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._pendingResponse = null;
        reject(new Error('Request timeout'));
      }, this.timeout);

      this._pendingResponse = {
        resolve: (data) => {
          clearTimeout(timeout);
          resolve(data);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      };

      this.socket.write(message);
      log('Sent request message');
    });
  }

  /**
   * Disconnect from PLC
   */
  async disconnect() {
    return new Promise((resolve) => {
      if (!this.connected || !this.socket) {
        resolve();
        return;
      }

      log('Disconnecting...');

      if (this.sessionHandle !== 0) {
        try {
          const message = buildUnregisterSession(this.sessionHandle);
          this.socket.write(message);
          // Give it a moment to send
          setTimeout(() => {
            this._closeSocket();
            resolve();
          }, 100);
        } catch (error) {
          log('Error during unregister:', error);
          this._closeSocket();
          resolve();
        }
      } else {
        this._closeSocket();
        resolve();
      }
    });
  }

  /**
   * Close socket
   */
  _closeSocket() {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
    this.sessionHandle = 0;
    this.emit('disconnected');
  }

  /**
   * Set timeout for requests
   */
  setTimeout(timeout) {
    this.timeout = timeout;
  }
}

