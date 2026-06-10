/**
 * OPC UA Driver for CODESYS PLC
 * Alternative to EtherNet/IP when explicit messaging is not available
 */

import { OPCUAClient, MessageSecurityMode, SecurityPolicy, AttributeIds } from "node-opcua";
import { EventEmitter } from 'events';
import debug from 'debug';

const log = debug('ethernetip:opcua');

export class OPCUADriver extends EventEmitter {
  constructor(host, port = 4840, options = {}) {
    super();
    this.host = host;
    this.port = port;
    this.options = {
      securityMode: options.securityMode || MessageSecurityMode.None,
      securityPolicy: options.securityPolicy || SecurityPolicy.None,
      ...options
    };
    this.client = null;
    this.session = null;
    this.connected = false;
  }

  /**
   * Connect to OPC UA server
   */
  async connect() {
    if (this.connected) {
      return;
    }

    log(`Connecting to OPC UA server at ${this.host}:${this.port}`);

    this.client = OPCUAClient.create({
      endpointMustExist: false,
      connectionStrategy: {
        initialDelay: 1000,
        maxRetry: 3
      },
      securityMode: this.options.securityMode,
      securityPolicy: this.options.securityPolicy
    });

    try {
      await this.client.connect(`opc.tcp://${this.host}:${this.port}`);
      log('Connected to OPC UA server');

      this.session = await this.client.createSession();
      log('OPC UA session created');

      this.connected = true;
      this.emit('connected');
    } catch (error) {
      log('Connection error:', error);
      throw error;
    }
  }

  /**
   * Disconnect from OPC UA server
   */
  async disconnect() {
    if (!this.connected) {
      return;
    }

    try {
      if (this.session) {
        await this.session.close();
        this.session = null;
      }
      if (this.client) {
        await this.client.disconnect();
        this.client = null;
      }
      this.connected = false;
      this.emit('disconnected');
      log('Disconnected from OPC UA server');
    } catch (error) {
      log('Disconnect error:', error);
      throw error;
    }
  }

  /**
   * Read tag value
   * @param {string} tagName - Tag name (e.g., "INT1_RUN" or "Application.GVL.INT1_RUN") or full Node ID (e.g., "ns=4;s=|var|PLC500 Industrial.Application.GVL.INT1_RUN")
   * @returns {Promise<any>} Tag value
   */
  async readTag(tagName) {
    if (!this.connected || !this.session) {
      throw new Error('Not connected to OPC UA server');
    }

    log(`Reading tag: ${tagName}`);

    // If it looks like a full Node ID, try it first
    const isNodeId = tagName.startsWith('ns=') || tagName.startsWith('i=') || tagName.startsWith('g=') || tagName.startsWith('b=');
    
    // Try different common tag paths in CODESYS
    // Based on discovery, CODESYS uses namespace 4 with |var| prefix
    const tagPaths = isNodeId 
      ? [tagName] // If it's a Node ID, try it first
      : [
      // Namespace 4 (CODESYS) - most common format
      `ns=4;s=|var|PLC500 Industrial.Application.GVL.${tagName}`,
      `ns=4;s=|var|Application.GVL.${tagName}`,
      `ns=4;s=|var|GVL.${tagName}`,
      `ns=4;s=|var|${tagName}`,
      `ns=4;s=|plc|Application.GVL.${tagName}`,
      `ns=4;s=|plc|GVL.${tagName}`,
      `ns=4;s=|plc|${tagName}`,
      `ns=4;s=${tagName}`,
      // Namespace 2 (fallback)
      `ns=2;s=${tagName}`,
      `ns=2;s=Application.${tagName}`,
      `ns=2;s=Application.GVL.${tagName}`,
      `ns=2;s=GVL.${tagName}`,
      `ns=2;s=Program:MainProgram.${tagName}`,
      `ns=2;s=MainProgram.${tagName}`
    ];

    for (const tagPath of tagPaths) {
      try {
        const dataValue = await this.session.read({
          nodeId: tagPath,
          attributeId: AttributeIds.Value
        });

        if (dataValue.statusCode.isGood()) {
          log(`Tag ${tagName} = ${dataValue.value.value} (Type: ${dataValue.value.dataType.name})`);
          return dataValue.value.value;
        }
      } catch (error) {
        // Continue to next path
      }
    }

    throw new Error(`Tag "${tagName}" not found. Tried paths: ${tagPaths.join(', ')}`);
  }

  /**
   * Write tag value
   * @param {string} tagName - Tag name
   * @param {any} value - Value to write
   * @returns {Promise<void>}
   */
  async writeTag(tagName, value) {
    if (!this.connected || !this.session) {
      throw new Error('Not connected to OPC UA server');
    }

    log(`Writing tag: ${tagName} = ${value}`);

    // Try different common tag paths
    // Based on discovery, CODESYS uses namespace 4 with |var| prefix
    const tagPaths = [
      // Namespace 4 (CODESYS) - most common format
      `ns=4;s=|var|PLC500 Industrial.Application.GVL.${tagName}`,
      `ns=4;s=|var|Application.GVL.${tagName}`,
      `ns=4;s=|var|GVL.${tagName}`,
      `ns=4;s=|var|${tagName}`,
      `ns=4;s=|plc|Application.GVL.${tagName}`,
      `ns=4;s=|plc|GVL.${tagName}`,
      `ns=4;s=|plc|${tagName}`,
      `ns=4;s=${tagName}`,
      // Namespace 2 (fallback)
      `ns=2;s=${tagName}`,
      `ns=2;s=Application.${tagName}`,
      `ns=2;s=Application.GVL.${tagName}`,
      `ns=2;s=GVL.${tagName}`,
      `ns=2;s=Program:MainProgram.${tagName}`,
      `ns=2;s=MainProgram.${tagName}`
    ];

    for (const tagPath of tagPaths) {
      try {
        const statusCode = await this.session.write({
          nodeId: tagPath,
          attributeId: AttributeIds.Value,
          value: {
            value: value
          }
        });

        if (statusCode.isGood()) {
          log(`Tag ${tagName} written successfully`);
          return;
        }
      } catch (error) {
        // Continue to next path
      }
    }

    throw new Error(`Tag "${tagName}" not found or cannot be written. Tried paths: ${tagPaths.join(', ')}`);
  }

  /**
   * Browse available tags
   * @param {string} startingPath - Starting browse path (default: "RootFolder")
   * @returns {Promise<Array>} Array of available nodes
   */
  async browseTags(startingPath = "RootFolder") {
    if (!this.connected || !this.session) {
      throw new Error('Not connected to OPC UA server');
    }

    log(`Browsing tags from: ${startingPath}`);

    try {
      const browseResult = await this.session.browse(startingPath);
      const nodes = [];

      for (const reference of browseResult.references || []) {
        nodes.push({
          name: reference.browseName.name,
          nodeId: reference.nodeId.toString(),
          nodeClass: reference.nodeClass
        });
      }

      return nodes;
    } catch (error) {
      log('Browse error:', error);
      throw error;
    }
  }

  /**
   * Recursively browse and list all tags (variables)
   * @param {string} startingNodeId - Starting node ID (default: "RootFolder")
   * @param {number} maxDepth - Maximum browse depth (default: 10)
   * @param {string} namespaceFilter - Optional namespace filter (e.g., "ns=4")
   * @returns {Promise<Array>} Array of all variable nodes (tags)
   */
  async listAllTags(startingNodeId = "RootFolder", maxDepth = 10, namespaceFilter = null) {
    if (!this.connected || !this.session) {
      throw new Error('Not connected to OPC UA server');
    }

    log(`Listing all tags from: ${startingNodeId} (max depth: ${maxDepth})`);

    const allTags = [];
    const visited = new Set();

    const browseRecursive = async (nodeId, level = 0, path = '') => {
      if (level > maxDepth) return;
      
      const nodeIdStr = typeof nodeId === 'string' ? nodeId : nodeId.toString();
      
      // Skip if already visited
      if (visited.has(nodeIdStr)) return;
      visited.add(nodeIdStr);

      try {
        const browseResult = await this.session.browse(nodeId);
        
        if (!browseResult || !browseResult.references) {
          return;
        }

        for (const ref of browseResult.references) {
          const refNodeId = ref.nodeId.toString();
          
          // Apply namespace filter if specified
          if (namespaceFilter && !refNodeId.startsWith(namespaceFilter)) {
            continue;
          }

          const name = ref.browseName.name;
          const nodeClass = ref.nodeClass;
          const fullPath = path ? `${path}.${name}` : name;

          // NodeClass 2 = Variable (tag)
          if (nodeClass === 2) {
            // Try to read the value
            let value = null;
            let dataType = null;
            
            try {
              const dataValue = await this.session.read({
                nodeId: ref.nodeId,
                attributeId: AttributeIds.Value
              });
              
              if (dataValue.statusCode.isGood()) {
                value = dataValue.value.value;
                dataType = dataValue.value.dataType ? dataValue.value.dataType.name : 'unknown';
              }
            } catch (error) {
              // Ignore read errors, just continue
            }

            allTags.push({
              name: name,
              nodeId: refNodeId,
              path: fullPath,
              value: value,
              dataType: dataType
            });

            log(`Found tag: ${fullPath} (${refNodeId})`);
          }
          // NodeClass 1 = Object (container), browse recursively
          else if (nodeClass === 1 && level < maxDepth) {
            await browseRecursive(ref.nodeId, level + 1, fullPath);
          }
        }
      } catch (error) {
        // Ignore browse errors for individual nodes
        log(`Browse error for ${nodeIdStr}:`, error.message);
      }
    };

    await browseRecursive(startingNodeId);
    
    log(`Found ${allTags.length} tag(s) total`);
    return allTags;
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected;
  }
}

export default OPCUADriver;

