/**
 * @file DocxExtractor.js
 * Zero-dependency extractor for Word (.docx) files in Browser & Node.js
 * 
 * Capability:
 * - Parses ZIP archive structure of .docx files
 * - Extracts embedded images from word/media/ (e.g. image1.png, image2.jpeg)
 * - Extracts clean text & paragraphs from word/document.xml
 * - Uses native DecompressionStream('deflate-raw') or Node zlib.inflateRaw
 */

/**
 * Maps image file extension to MIME type.
 * @param {string} filename
 * @returns {string}
 */
export function getMimeFromFilename(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}

/**
 * Decompresses raw Deflate bytes using native DecompressionStream or Node zlib.
 * @param {Uint8Array} compressedBytes
 * @returns {Promise<Uint8Array>}
 */
export async function decompressDeflateRaw(compressedBytes) {
  // 1. Try browser / standard Web Streams DecompressionStream
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(compressedBytes);
      writer.close();
      const response = new Response(ds.readable);
      const buf = await response.arrayBuffer();
      return new Uint8Array(buf);
    } catch {
      // Fallback to next strategy
    }
  }

  // 2. Try Node.js zlib.inflateRaw
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      const zlib = await import('node:zlib');
      return new Promise((resolve, reject) => {
        zlib.inflateRaw(Buffer.from(compressedBytes), (err, res) => {
          if (err) reject(err);
          else resolve(new Uint8Array(res.buffer, res.byteOffset, res.byteLength));
        });
      });
    } catch (nodeErr) {
      // Fallback
    }
  }

  throw new Error('Môi trường không hỗ trợ giải nén Deflate (thiếu DecompressionStream/zlib).');
}

/**
 * Extracts files from a ZIP archive (like .docx).
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {Promise<Array<{ name: string, data: Uint8Array, size: number }>>}
 */
export async function parseZipEntries(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries = [];

  // Search for End of Central Directory (EOCD) signature: 0x06054b50 (PK\x05\x06)
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset !== -1) {
    // Read Central Directory
    const totalEntries = view.getUint16(eocdOffset + 10, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);

    let currOffset = cdOffset;
    for (let i = 0; i < totalEntries && currOffset < eocdOffset; i++) {
      if (view.getUint32(currOffset, true) !== 0x02014b50) break; // PK\x01\x02

      const method = view.getUint16(currOffset + 10, true);
      const compSize = view.getUint32(currOffset + 20, true);
      const uncompSize = view.getUint32(currOffset + 24, true);
      const nameLen = view.getUint16(currOffset + 28, true);
      const extraLen = view.getUint16(currOffset + 30, true);
      const commentLen = view.getUint16(currOffset + 32, true);
      const localHeaderOffset = view.getUint32(currOffset + 42, true);

      const nameBytes = bytes.subarray(currOffset + 46, currOffset + 46 + nameLen);
      const filename = new TextDecoder('utf-8').decode(nameBytes);

      // Locate data in Local Header
      if (localHeaderOffset + 30 <= bytes.length && view.getUint32(localHeaderOffset, true) === 0x04034b50) {
        const localNameLen = view.getUint16(localHeaderOffset + 26, true);
        const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
        const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
        const compressedData = bytes.subarray(dataStart, dataStart + compSize);

        try {
          let fileData;
          if (method === 0) {
            // Stored
            fileData = compressedData;
          } else if (method === 8) {
            // Deflate
            fileData = await decompressDeflateRaw(compressedData);
          }

          if (fileData) {
            entries.push({
              name: filename,
              data: fileData,
              size: uncompSize || fileData.length,
            });
          }
        } catch {
          // Skip entry if decompression fails
        }
      }

      currOffset += 46 + nameLen + extraLen + commentLen;
    }
  } else {
    // Fallback: Scan Local File Headers (PK\x03\x04) directly
    let pos = 0;
    while (pos + 30 < bytes.length) {
      if (view.getUint32(pos, true) !== 0x04034b50) {
        pos++;
        continue;
      }

      const method = view.getUint16(pos + 8, true);
      const compSize = view.getUint32(pos + 18, true);
      const uncompSize = view.getUint32(pos + 22, true);
      const nameLen = view.getUint16(pos + 26, true);
      const extraLen = view.getUint16(pos + 28, true);

      const nameBytes = bytes.subarray(pos + 30, pos + 30 + nameLen);
      const filename = new TextDecoder('utf-8').decode(nameBytes);

      const dataStart = pos + 30 + nameLen + extraLen;
      if (compSize > 0 && dataStart + compSize <= bytes.length) {
        const compressedData = bytes.subarray(dataStart, dataStart + compSize);
        try {
          let fileData;
          if (method === 0) {
            fileData = compressedData;
          } else if (method === 8) {
            fileData = await decompressDeflateRaw(compressedData);
          }
          if (fileData) {
            entries.push({
              name: filename,
              data: fileData,
              size: uncompSize || fileData.length,
            });
          }
        } catch {
          // ignore
        }
        pos = dataStart + compSize;
      } else {
        pos += 30 + nameLen + extraLen;
      }
    }
  }

  return entries;
}

/**
 * Extracts plain text from word/document.xml content.
 * @param {Uint8Array} xmlBytes
 * @returns {{ text: string, paragraphs: string[] }}
 */
export function extractTextFromDocumentXml(xmlBytes) {
  const xmlString = new TextDecoder('utf-8').decode(xmlBytes);
  const paragraphs = [];

  // Match paragraphs <w:p>...</w:p>
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi;
  let pMatch;

  while ((pMatch = pRegex.exec(xmlString)) !== null) {
    const pContent = pMatch[1];
    // Extract text elements <w:t>...</w:t> or <w:t xml:space="...">...</w:t>
    const tRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi;
    let tMatch;
    let paragraphText = '';
    while ((tMatch = tRegex.exec(pContent)) !== null) {
      paragraphText += tMatch[1];
    }
    const cleanText = paragraphText.trim();
    if (cleanText) {
      paragraphs.push(cleanText);
    }
  }

  return {
    text: paragraphs.join('\n'),
    paragraphs,
  };
}

/**
 * Main entry point: Extracts images and text from a .docx file or Blob/Buffer.
 * 
 * @param {File|Blob|ArrayBuffer|Uint8Array} docxFile
 * @returns {Promise<{
 *   success: boolean,
 *   images: Array<{ name: string, data: Uint8Array, mimeType: string, blob?: Blob, size: number }>,
 *   text: string,
 *   paragraphs: string[],
 *   primaryImage?: { name: string, data: Uint8Array, mimeType: string, blob?: Blob, size: number },
 *   error?: string
 * }>}
 */
export async function extractDocx(docxFile) {
  try {
    let arrayBuffer;
    if (docxFile instanceof ArrayBuffer) {
      arrayBuffer = docxFile;
    } else if (docxFile instanceof Uint8Array) {
      arrayBuffer = docxFile.buffer.slice(docxFile.byteOffset, docxFile.byteOffset + docxFile.byteLength);
    } else if (docxFile && typeof docxFile.arrayBuffer === 'function') {
      arrayBuffer = await docxFile.arrayBuffer();
    } else if (docxFile && docxFile.data) {
      const d = docxFile.data;
      arrayBuffer = (d instanceof ArrayBuffer) ? d : (d.buffer || new Uint8Array(d).buffer);
    } else {
      return { success: false, images: [], text: '', paragraphs: [], error: 'Định dạng tệp không đọc được.' };
    }

    const entries = await parseZipEntries(arrayBuffer);

    // 1. Extract Images from word/media/
    const images = [];
    const mediaEntries = entries.filter(e => {
      const lower = e.name.toLowerCase();
      return lower.includes('word/media/') && /\.(png|jpe?g|webp|gif|svg)$/i.test(lower);
    });

    for (const item of mediaEntries) {
      const filename = item.name.split('/').pop() || 'image.png';
      const mimeType = getMimeFromFilename(filename);
      let blob;
      if (typeof Blob !== 'undefined') {
        blob = new Blob([item.data], { type: mimeType });
      }
      images.push({
        name: filename,
        data: item.data,
        mimeType,
        blob,
        size: item.size,
      });
    }

    // Sort images by size descending (largest diagrams usually first)
    images.sort((a, b) => b.size - a.size);

    // 2. Extract Document Text from word/document.xml
    let text = '';
    let paragraphs = [];
    const docXmlEntry = entries.find(e => e.name.toLowerCase() === 'word/document.xml');
    if (docXmlEntry) {
      const textResult = extractTextFromDocumentXml(docXmlEntry.data);
      text = textResult.text;
      paragraphs = textResult.paragraphs;
    }

    const primaryImage = images.length > 0 ? images[0] : null;

    return {
      success: images.length > 0 || text.length > 0,
      images,
      text,
      paragraphs,
      primaryImage,
    };
  } catch (err) {
    return {
      success: false,
      images: [],
      text: '',
      paragraphs: [],
      error: `Lỗi đọc tệp Word (.docx): ${err.message}`,
    };
  }
}
