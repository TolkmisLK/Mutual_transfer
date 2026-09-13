/** Inject the maintained SHA-256 implementation; never buffer a complete file. */
export async function hashFile(file, sha256, { chunkSize = 4 * 1024 * 1024, onProgress = () => {}, isCancelled = () => false } = {}) {
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1) throw new Error('Invalid hash chunk size');
  const hasher = sha256.create();
  try {
    for (let offset = 0; offset < file.size; offset += chunkSize) {
      if (isCancelled()) throw new Error('校验已暂停，未发送文件。');
      const bytes = new Uint8Array(await file.slice(offset, offset + chunkSize).arrayBuffer());
      hasher.update(bytes); onProgress(Math.min(file.size, offset + bytes.length));
    }
    if (isCancelled()) throw new Error('校验已暂停，未发送文件。');
    return toHex(hasher.digest());
  } finally { hasher.destroy(); }
}
export const toHex = bytes => Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
export function resumeMatches(item, file, digest) {
  return Boolean(item && !item.complete && item.name === file.name && item.size === file.size && item.expectedSha256 === digest &&
    Number.isSafeInteger(item.offset) && item.offset >= 0 && item.offset <= file.size);
}
