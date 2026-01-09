/**
 * EtherNet/IP Driver for Node.js
 * Main entry point
 */

export { EthernetIPDriver, default } from './src/driver.js';
export { EIPConnection } from './src/connection.js';
export { discoverPLCs, discoverPLC, PLCDiscovery } from './src/discovery.js';
export { browseTags, browseTagsDetailed, getTagInfo } from './src/tagBrowser.js';
export { PLCSimulator } from './src/simulator.js';
export { testConnection, testConnections, verifyPLC } from './src/connectionTest.js';
export { getDeviceInfo, getConnectionStatus } from './src/deviceInfo.js';
export * from './src/constants.js';
export { buildRegisterSession, buildReadTagRequest, buildEIPHeader, buildSendRRData, parseEIPHeader } from './src/message.js';
export { buildPath, buildMessageRouterPath, toUInt16LE, toUInt32LE } from './src/utils.js';
export { hexDump } from './src/debugUtils.js';

