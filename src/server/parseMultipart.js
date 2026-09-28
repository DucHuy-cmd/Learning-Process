/**
 * @file parseMultipart.js
 * Zero-dependency multipart/form-data parser for Node.js HTTP servers.
 */

/**
 * Extracts boundary string from Content-Type header.
 * @param {string} contentType
 * @returns {string|null}
 */
export function extractBoundary(contentType) {
  if (!contentType) return null;
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return match ? (match[1] || match[2]).trim() : null;
}

/**
 * Reads the full body of an incoming HTTP request as a Buffer.
 * @param {import('node:http').IncomingMessage} req
 * @param {number} [maxBytes=16777216] 16MB default limit
 * @returns {Promise<Buffer>}
 */
export function readRequestBody(req, maxBytes = 16 * 1024 * 1024) {
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) {
      return Promise.resolve(req.body);
    }
    if (typeof req.body === 'string') {
      return Promise.resolve(Buffer.from(req.body, 'utf8'));
    }
    if (typeof req.body === 'object') {
      return Promise.resolve(Buffer.from(JSON.stringify(req.body), 'utf8'));
    }
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;

    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        req.destroy();
        reject(new Error(`Kích thước yêu cầu vượt quá giới hạn tối đa (${(maxBytes / (1024 * 1024)).toFixed(0)}MB).`));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Parses multipart/form-data Buffer into field values and file objects.
 * @param {Buffer} buffer
 * @param {string} boundary
 * @returns {{ files: Record<string, { filename: string, type: string, data: Buffer, size: number }>, fields: Record<string, string> }}
 */
export function parseMultipartData(buffer, boundary) {
  const files = {};
  const fields = {};

  if (!buffer || buffer.length === 0 || !boundary) {
    return { files, fields };
  }

  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const endBoundaryBuffer = Buffer.from(`--${boundary}--`);

  let startIndex = 0;

  while (startIndex < buffer.length) {
    const bIndex = buffer.indexOf(boundaryBuffer, startIndex);
    if (bIndex === -1) break;

    // Check if end boundary
    if (buffer.subarray(bIndex, bIndex + endBoundaryBuffer.length).equals(endBoundaryBuffer)) {
      break;
    }

    const partStart = bIndex + boundaryBuffer.length + 2; // skip \r\n
    const nextBIndex = buffer.indexOf(boundaryBuffer, partStart);
    if (nextBIndex === -1) break;

    // Part goes from partStart to nextBIndex - 2 (skip trailing \r\n)
    const partBuffer = buffer.subarray(partStart, nextBIndex - 2);
    startIndex = nextBIndex;

    // Split headers and body at \r\n\r\n
    const headerSep = Buffer.from('\r\n\r\n');
    const sepIndex = partBuffer.indexOf(headerSep);
    if (sepIndex === -1) continue;

    const headersStr = partBuffer.subarray(0, sepIndex).toString('utf8');
    const bodyBuffer = partBuffer.subarray(sepIndex + 4);

    // Parse Content-Disposition
    const dispMatch = headersStr.match(/Content-Disposition:\s*form-data;\s*([^;\r\n]+)(?:;\s*filename="([^"]*)")?/i);
    if (!dispMatch) continue;

    const nameMatch = headersStr.match(/name="([^"]+)"/i);
    const fieldName = nameMatch ? nameMatch[1] : 'file';
    const filename = dispMatch[2] !== undefined ? dispMatch[2] : null;

    if (filename !== null) {
      // It's a file
      const typeMatch = headersStr.match(/Content-Type:\s*([^\r\n]+)/i);
      const mimeType = typeMatch ? typeMatch[1].trim() : 'application/octet-stream';

      files[fieldName] = {
        filename,
        type: mimeType,
        data: bodyBuffer,
        size: bodyBuffer.length,
      };
    } else {
      // It's a text field
      fields[fieldName] = bodyBuffer.toString('utf8');
    }
  }

  return { files, fields };
}
