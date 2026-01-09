/**
 * Utility functions for EtherNet/IP protocol
 */

/**
 * Convert number to little-endian byte array
 */
export function toUInt16LE(value) {
  const buffer = Buffer.allocUnsafe(2);
  buffer.writeUInt16LE(value, 0);
  return buffer;
}

export function toUInt32LE(value) {
  const buffer = Buffer.allocUnsafe(4);
  buffer.writeUInt32LE(value, 0);
  return buffer;
}

/**
 * Convert number from little-endian byte array
 */
export function fromUInt16LE(buffer, offset = 0) {
  return buffer.readUInt16LE(offset);
}

export function fromUInt32LE(buffer, offset = 0) {
  return buffer.readUInt32LE(offset);
}

/**
 * Build CIP path from tag name
 * Uses symbolic segment format (0x91 = ANSI extended symbolic segment with 8-bit length)
 * Format: [0x91][length][name bytes...]
 */
/**
 * Build Message Router path prefix (some PLCs require this)
 * Path: 01 00 = Message Router, Instance 0 (compact format)
 * This is a logical segment path: 0x20 (8-bit class) + 0x01 (Class 1) + 0x24 (8-bit instance) + 0x00 (Instance 0)
 */
export function buildMessageRouterPath() {
  // Standard format: 8-bit logical segments
  // 0x20 = 8-bit logical segment, class
  // 0x02 = Class 2 (Message Router)
  // 0x24 = 8-bit logical segment, instance
  // 0x00 = Instance 0
  const path = Buffer.alloc(4);
  path[0] = 0x20; // 8-bit logical segment, class
  path[1] = 0x02; // Class 2 (Message Router)
  path[2] = 0x24; // 8-bit logical segment, instance
  path[3] = 0x00; // Instance 0
  return path;
}

/**
 * Build Message Router path in compact format (01 00)
 * Some PLCs use this compact format
 */
export function buildMessageRouterPathCompact() {
  // Compact format: 01 = Class 1 (Message Router), 00 = Instance 0
  // This might be a path size indicator or a special encoding
  return Buffer.from([0x01, 0x00]);
}

export function buildPath(tagName, includeMessageRouter = false, useCompactRouter = false) {
  const segments = tagName.split('.');
  let path = Buffer.alloc(0);
  
  // Some PLCs require Message Router path prefix
  if (includeMessageRouter) {
    if (useCompactRouter) {
      path = buildMessageRouterPathCompact(); // Use 01 00 format
    } else {
      path = buildMessageRouterPath(); // Use standard logical segment format
    }
  }
  
  for (const segment of segments) {
    const length = segment.length;
    if (length > 255) {
      throw new Error(`Segment name too long: ${segment}`);
    }
    const segmentBuffer = Buffer.alloc(length + 2);
    segmentBuffer[0] = 0x91; // ANSI extended symbolic segment (format 9, 8-bit length)
    segmentBuffer[1] = length; // Length byte
    segmentBuffer.write(segment, 2, 'ascii'); // Name bytes
    path = Buffer.concat([path, segmentBuffer]);
  }
  
  return path;
}

/**
 * Build CIP path using alternative format (16-bit symbolic segment)
 * Some PLCs require this format
 */
export function buildPath16Bit(tagName) {
  const segments = tagName.split('.');
  let path = Buffer.alloc(0);
  
  for (const segment of segments) {
    const length = segment.length;
    const segmentBuffer = Buffer.alloc(length + 3);
    segmentBuffer[0] = 0x92; // 16-bit symbolic segment (format 9, 16-bit length)
    toUInt16LE(length).copy(segmentBuffer, 1); // 16-bit length
    segmentBuffer.write(segment, 3, 'ascii');
    path = Buffer.concat([path, segmentBuffer]);
  }
  
  return path;
}

/**
 * Build CIP path using standard symbolic segment (not ANSI extended)
 * Format: 0x91 but might need to be 0x20 + length for some PLCs
 * Actually, 0x91 IS the standard for symbolic segments with 8-bit length
 * But let's try without ANSI extended flag
 */
export function buildPathStandard(tagName) {
  const segments = tagName.split('.');
  let path = Buffer.alloc(0);
  
  for (const segment of segments) {
    const length = segment.length;
    if (length > 255) {
      throw new Error(`Segment name too long: ${segment}`);
    }
    // Try format: 0x91 (ANSI extended symbolic with 8-bit length)
    // This is the same as default, but kept separate for testing
    const segmentBuffer = Buffer.alloc(length + 2);
    segmentBuffer[0] = 0x91; // ANSI extended symbolic
    segmentBuffer[1] = length;
    segmentBuffer.write(segment, 2, 'ascii');
    path = Buffer.concat([path, segmentBuffer]);
  }
  
  return path;
}

/**
 * Build CIP path using standard symbolic segment format
 * Format: 0x91 (ANSI extended symbolic) + length byte + name
 * Same as default but kept for compatibility
 */
export function buildPathSymbolic(tagName) {
  return buildPath(tagName); // Same as default
}

/**
 * Build CIP path using simple 8-bit logical segment format
 * Some PLCs might prefer this simpler format
 */
export function buildPathSimple(tagName) {
  const segments = tagName.split('.');
  let path = Buffer.alloc(0);
  
  for (const segment of segments) {
    const length = segment.length;
    if (length > 255) {
      throw new Error(`Segment name too long: ${segment}`);
    }
    // Try format: 0x20 (8-bit logical, class) but this won't work for names
    // Actually, for tag names we need symbolic, so this is the same
    const segmentBuffer = Buffer.alloc(length + 2);
    segmentBuffer[0] = 0x91; // ANSI extended symbolic
    segmentBuffer[1] = length;
    segmentBuffer.write(segment, 2, 'ascii');
    path = Buffer.concat([path, segmentBuffer]);
  }
  
  return path;
}


/**
 * Parse CIP path
 */
export function parsePath(buffer, offset = 0) {
  const segments = [];
  let pos = offset;
  
  while (pos < buffer.length) {
    const segmentType = buffer[pos];
    const segmentFormat = (segmentType >> 4) & 0x0F;
    const segmentValue = segmentType & 0x0F;
    
    if (segmentFormat === 0) { // Logical segment
      if (segmentValue === 0) { // 8-bit
        const port = buffer[pos + 1];
        segments.push({ type: 'logical', port });
        pos += 2;
      } else if (segmentValue === 1) { // 16-bit
        const port = fromUInt16LE(buffer, pos + 1);
        segments.push({ type: 'logical', port });
        pos += 3;
      } else if (segmentValue === 2) { // 32-bit
        const port = fromUInt32LE(buffer, pos + 1);
        segments.push({ type: 'logical', port });
        pos += 5;
      }
    } else if (segmentFormat === 1) { // Network segment
      pos += 2;
    } else if (segmentFormat === 2) { // Symbolic segment
      const length = buffer[pos + 1];
      const name = buffer.toString('ascii', pos + 2, pos + 2 + length);
      segments.push({ type: 'symbolic', name });
      pos += 2 + length;
    } else if (segmentFormat === 3) { // Data segment
      const length = buffer[pos + 1];
      const data = buffer.slice(pos + 2, pos + 2 + length);
      segments.push({ type: 'data', data });
      pos += 2 + length;
    } else {
      break;
    }
  }
  
  return { segments, length: pos - offset };
}

/**
 * Encode CIP data type value
 */
export function encodeValue(dataType, value) {
  const buffer = Buffer.allocUnsafe(256);
  let offset = 0;
  
  switch (dataType) {
    case 0xC1: // BOOL
      buffer[offset++] = value ? 0xFF : 0x00;
      break;
    case 0xC2: // SINT
      buffer.writeInt8(value, offset);
      offset += 1;
      break;
    case 0xC3: // INT
      buffer.writeInt16LE(value, offset);
      offset += 2;
      break;
    case 0xC4: // DINT
      buffer.writeInt32LE(value, offset);
      offset += 4;
      break;
    case 0xC6: // USINT
      buffer[offset++] = value;
      break;
    case 0xC7: // UINT
      buffer.writeUInt16LE(value, offset);
      offset += 2;
      break;
    case 0xC8: // UDINT
      buffer.writeUInt32LE(value, offset);
      offset += 4;
      break;
    case 0xCA: // REAL
      buffer.writeFloatLE(value, offset);
      offset += 4;
      break;
    case 0xCB: // LREAL
      buffer.writeDoubleLE(value, offset);
      offset += 8;
      break;
    case 0xDA: // STRING
      const strLength = Buffer.byteLength(value, 'ascii');
      buffer[offset++] = strLength;
      buffer.write(value, offset, 'ascii');
      offset += strLength;
      break;
    default:
      throw new Error(`Unsupported data type: 0x${dataType.toString(16)}`);
  }
  
  return buffer.slice(0, offset);
}

/**
 * Decode CIP data type value
 */
export function decodeValue(dataType, buffer, offset = 0) {
  switch (dataType) {
    case 0xC1: // BOOL
      return buffer[offset] !== 0;
    case 0xC2: // SINT
      return buffer.readInt8(offset);
    case 0xC3: // INT
      return buffer.readInt16LE(offset);
    case 0xC4: // DINT
      return buffer.readInt32LE(offset);
    case 0xC6: // USINT
      return buffer[offset];
    case 0xC7: // UINT
      return buffer.readUInt16LE(offset);
    case 0xC8: // UDINT
      return buffer.readUInt32LE(offset);
    case 0xCA: // REAL
      return buffer.readFloatLE(offset);
    case 0xCB: // LREAL
      return buffer.readDoubleLE(offset);
    case 0xDA: // STRING
      const length = buffer[offset];
      return buffer.toString('ascii', offset + 1, offset + 1 + length);
    default:
      throw new Error(`Unsupported data type: 0x${dataType.toString(16)}`);
  }
}

/**
 * Get data type size in bytes
 */
export function getDataTypeSize(dataType) {
  switch (dataType) {
    case 0xC1: // BOOL
    case 0xC2: // SINT
    case 0xC6: // USINT
      return 1;
    case 0xC3: // INT
    case 0xC7: // UINT
      return 2;
    case 0xC4: // DINT
    case 0xC8: // UDINT
    case 0xCA: // REAL
      return 4;
    case 0xCB: // LREAL
      return 8;
    case 0xDA: // STRING
      return -1; // Variable length
    default:
      return 0;
  }
}

