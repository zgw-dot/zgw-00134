/**
 * 加密与哈希工具模块
 * 提供简单的SHA1哈希、FNV-1a回退哈希、ID生成等功能
 */

/**
 * FNV-1a 32位哈希算法回退实现
 * @param input 输入字符串
 * @returns 十六进制哈希字符串
 */
function fnv1aHash(input: string): string {
  const FNV_OFFSET = 2166136261;
  const FNV_PRIME = 16777619;
  let hash = FNV_OFFSET;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * 计算SHA1哈希
 * 优先使用SubtleCrypto，不可用时回退到FNV-1a
 * @param input 输入字符串
 * @returns 十六进制哈希字符串
 */
export async function sha1Hash(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const buffer = await crypto.subtle.digest('SHA-1', data);
      const bytes = new Uint8Array(buffer);
      let hex = '';
      for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
      }
      return hex;
    } catch {
      return fnv1aHash(input);
    }
  }
  return fnv1aHash(input);
}

/**
 * 同步内容哈希（FNV-1a，同步版本，不依赖浏览器API
 * @param content 输入内容
 * @returns 十六进制哈希字符串
 */
export function contentHash(content: string): string {
  return fnv1aHash(content);
}

/**
 * 生成通用唯一ID
 * 格式：时间戳(16进制)+随机数(16进制)
 * @param prefix 可选前缀
 * @returns ID字符串
 */
export function genId(prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  const base = `${timestamp}${random}`;
  return prefix ? `${prefix}_${base}` : base;
}

/**
 * 生成事件ID
 * 基于内容哈希+时间戳，保证相同内容短时间内生成相近ID
 * @param content 事件内容
 * @returns 事件ID字符串
 */
export function genEventId(content: string): string {
  const hash = contentHash(content).slice(0, 8);
  const timestamp = Date.now().toString(36);
  return `evt_${hash}${timestamp}`;
}
