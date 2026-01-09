/**
 * Debug Utilities for EtherNet/IP
 * Helper functions to debug protocol messages
 */

/**
 * Hex dump a buffer
 */
export function hexDump(buffer, label = '') {
  const lines = [];
  if (label) {
    lines.push(`${label} (${buffer.length} bytes):`);
  }
  
  for (let i = 0; i < buffer.length; i += 16) {
    const hex = Array.from(buffer.slice(i, i + 16))
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
    
    const ascii = Array.from(buffer.slice(i, i + 16))
      .map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.')
      .join('');
    
    lines.push(`${i.toString(16).padStart(4, '0')}: ${hex.padEnd(48)} ${ascii}`);
  }
  
  return lines.join('\n');
}

/**
 * Analyze CIP path
 */
export function analyzePath(path) {
  const analysis = {
    length: path.length,
    hex: path.toString('hex').toUpperCase(),
    segments: []
  };
  
  let offset = 0;
  while (offset < path.length) {
    if (offset >= path.length) break;
    
    const segmentType = path[offset];
    const format = (segmentType >> 4) & 0x0F;
    const value = segmentType & 0x0F;
    
    if (format === 9 && value === 1) {
      // ANSI extended symbolic (0x91)
      if (offset + 1 < path.length) {
        const length = path[offset + 1];
        if (offset + 2 + length <= path.length) {
          const name = path.toString('ascii', offset + 2, offset + 2 + length);
          analysis.segments.push({
            type: 'ANSI extended symbolic',
            format: `0x${segmentType.toString(16)}`,
            length,
            name,
            bytes: path.slice(offset, offset + 2 + length).toString('hex').toUpperCase()
          });
          offset += 2 + length;
          continue;
        }
      }
    }
    
    // Unknown segment
    analysis.segments.push({
      type: 'unknown',
      format: `0x${segmentType.toString(16)}`,
      bytes: path.slice(offset, Math.min(offset + 16, path.length)).toString('hex').toUpperCase()
    });
    break;
  }
  
  return analysis;
}

