/**
 * OPC UA client driver (CODESYS, Siemens TIA Portal / SIMATIC OPC UA, and other servers).
 * Pass a full NodeId string (e.g. Siemens: ns=3;s=DBName.Path.To.Tag) to read/write directly.
 */

import { OPCUAClient, MessageSecurityMode, SecurityPolicy, AttributeIds } from "node-opcua";
import { EventEmitter } from 'events';
import debug from 'debug';

const log = debug('ethernetip:opcua');

/** OPC UA NodeClass: Object */
const NC_OBJECT = 1;
/** OPC UA NodeClass: Variable */
const NC_VARIABLE = 2;
/** OPC UA NodeClass: View */
const NC_VIEW = 128;

/** @param {string} s */
function looksLikeOpcUaNodeId(s) {
  return (
    s.startsWith('ns=') ||
    s.startsWith('i=') ||
    s.startsWith('g=') ||
    s.startsWith('b=')
  );
}

/** CODESYS-style fallbacks when the tag is not a full NodeId */
function defaultCodesysTagPaths(tagName) {
  return [
    `ns=4;s=|var|PLC500 Industrial.Application.GVL.${tagName}`,
    `ns=4;s=|var|Application.GVL.${tagName}`,
    `ns=4;s=|var|GVL.${tagName}`,
    `ns=4;s=|var|${tagName}`,
    `ns=4;s=|plc|Application.GVL.${tagName}`,
    `ns=4;s=|plc|GVL.${tagName}`,
    `ns=4;s=|plc|${tagName}`,
    `ns=4;s=${tagName}`,
    `ns=2;s=${tagName}`,
    `ns=2;s=Application.${tagName}`,
    `ns=2;s=Application.GVL.${tagName}`,
    `ns=2;s=GVL.${tagName}`,
    `ns=2;s=Program:MainProgram.${tagName}`,
    `ns=2;s=MainProgram.${tagName}`
  ];
}

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
   * @param {string} tagName - Short CODESYS name or full NodeId (e.g. Siemens: ns=3;s=Monitoramento_....Corrente_L1)
   * @returns {Promise<any>} Tag value
   */
  async readTag(tagName) {
    if (!this.connected || !this.session) {
      throw new Error('Not connected to OPC UA server');
    }

    log(`Reading tag: ${tagName}`);

    const tagPaths = looksLikeOpcUaNodeId(tagName)
      ? [tagName]
      : defaultCodesysTagPaths(tagName);

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
   * Read a member of a structured OPC UA variable (UDT / ExtensionObject decoded as object).
   * The NodeId addresses the whole struct; fieldPath uses dot notation inside the returned value
   * (e.g. ns=4;i=289 + "MOTORES_WATERJETS.TENSAO_L1_L2", not the browse display name prefix).
   * @param {string} tagName - Same as readTag (NodeId or short name)
   * @param {string} fieldPath - Dot path, e.g. "MOTORES_WATERJETS.TENSAO_L1_L2"
   * @returns {Promise<any>}
   */
  async readTagField(tagName, fieldPath) {
    const root = await this.readTag(tagName);
    if (!fieldPath || !String(fieldPath).trim()) {
      return root;
    }
    const parts = String(fieldPath).split('.').filter(Boolean);
    let cur = root;
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object') {
        throw new Error(
          `readTagField: cannot resolve "${fieldPath}" — not an object at segment "${p}" (from "${tagName}")`
        );
      }
      if (!(p in cur)) {
        const keys =
          cur && typeof cur === 'object' ? Object.keys(cur).slice(0, 15).join(', ') : '';
        throw new Error(
          `readTagField: no property "${p}" in path "${fieldPath}" (from "${tagName}")` +
            (keys ? `. Sibling keys (sample): ${keys}` : '')
        );
      }
      cur = cur[p];
    }
    return cur;
  }

  /**
   * Find Variable nodes whose browse name equals `browseName` (BFS from a starting node).
   * OPC UA always reads by NodeId; this walks the address space to resolve a display/browse name.
   * @param {string} browseName - e.g. "CHF" as shown in listAllTags
   * @param {object} [options]
   * @param {string} [options.startingNodeId='ns=0;i=85'] - Usually Objects folder; narrow this if the name is ambiguous
   * @param {number} [options.maxDepth=25]
   * @param {string|null} [options.namespacePrefix] - e.g. "ns=4" to keep only matches in that namespace
   * @returns {Promise<string[]>} NodeId strings (0, 1, or many)
   */
  async findVariableNodeIdsByBrowseName(browseName, options = {}) {
    if (!this.connected || !this.session) {
      throw new Error('Not connected to OPC UA server');
    }
    const name = String(browseName).trim();
    if (!name) {
      throw new Error('findVariableNodeIdsByBrowseName: empty browseName');
    }

    const startingNodeId = options.startingNodeId ?? 'ns=0;i=85';
    const maxDepth = options.maxDepth ?? 25;
    const namespacePrefix = options.namespacePrefix ?? null;

    const matches = [];
    const visited = new Set();
    const queue = [{ nodeId: startingNodeId, level: 0 }];

    while (queue.length > 0) {
      const { nodeId, level } = queue.shift();
      const nodeIdStr = typeof nodeId === 'string' ? nodeId : nodeId.toString();
      if (visited.has(nodeIdStr)) continue;
      visited.add(nodeIdStr);
      if (level > maxDepth) continue;

      try {
        const browseResult = await this.session.browse(nodeId);
        for (const ref of browseResult.references || []) {
          const refNodeIdStr = ref.nodeId.toString();
          const bn = ref.browseName && ref.browseName.name;
          const nc = ref.nodeClass;

          if (nc === NC_VARIABLE && bn === name) {
            matches.push(refNodeIdStr);
          }

          if (level < maxDepth && (nc === NC_OBJECT || nc === NC_VIEW)) {
            queue.push({ nodeId: ref.nodeId, level: level + 1 });
          }
        }
      } catch (e) {
        log(`browse skip ${nodeIdStr}: ${e.message}`);
      }
    }

    let out = matches;
    if (namespacePrefix) {
      out = matches.filter((id) => id.startsWith(namespacePrefix));
    }
    return out;
  }

  /**
   * Read a variable by its browse name (see findVariableNodeIdsByBrowseName).
   * @param {string} browseName
   * @param {object} [options] - passed to findVariableNodeIdsByBrowseName
   * @returns {Promise<any>}
   */
  async readTagByBrowseName(browseName, options = {}) {
    const ids = await this.findVariableNodeIdsByBrowseName(browseName, options);
    if (ids.length === 0) {
      throw new Error(
        `No Variable with browse name "${browseName}" found (from "${options.startingNodeId ?? 'ns=0;i=85'}", maxDepth ${options.maxDepth ?? 25})`
      );
    }
    if (ids.length > 1) {
      throw new Error(
        `Ambiguous browse name "${browseName}": ${ids.length} variables — ${ids.join(' | ')}. ` +
          'Pass options.startingNodeId (narrower parent) or options.namespacePrefix (e.g. "ns=4").'
      );
    }
    return this.readTag(ids[0]);
  }

  /**
   * readTagField after resolving the parent variable by browse name.
   * @param {string} browseName
   * @param {string} fieldPath
   * @param {object} [options] - passed to findVariableNodeIdsByBrowseName
   */
  async readTagFieldByBrowseName(browseName, fieldPath, options = {}) {
    const ids = await this.findVariableNodeIdsByBrowseName(browseName, options);
    if (ids.length === 0) {
      throw new Error(
        `No Variable with browse name "${browseName}" found (from "${options.startingNodeId ?? 'ns=0;i=85'}")`
      );
    }
    if (ids.length > 1) {
      throw new Error(
        `Ambiguous browse name "${browseName}": ${ids.length} variables — ${ids.join(' | ')}`
      );
    }
    return this.readTagField(ids[0], fieldPath);
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

    const tagPaths = looksLikeOpcUaNodeId(tagName)
      ? [tagName]
      : defaultCodesysTagPaths(tagName);

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
   * @param {string} namespaceFilter - If set, only include Variable nodes whose NodeId starts with this (e.g. "ns=3"). Object folders are still traversed (e.g. ns=0) so Siemens tags under Objects are reachable.
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

          const name = ref.browseName.name;
          const nodeClass = ref.nodeClass;
          const fullPath = path ? `${path}.${name}` : name;

          // NodeClass 2 = Variable (tag)
          if (nodeClass === 2) {
            // Filter only variables (Siemens etc. live under ns=0 folders → ns=3 leaves)
            if (namespaceFilter && !refNodeId.startsWith(namespaceFilter)) {
              continue;
            }
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

