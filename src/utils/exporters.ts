/**
 * 数据导出工具模块
 * 提供CSV/JSON导出、字段转义、Blob下载等功能
 */

/**
 * 事件对象类型（带任意属性的基础类型）
 */
export interface ExportEvent {
  id?: string;
  [key: string]: unknown;
}

/**
 * CSV字段定义
 */
export interface CSVField {
  key: string;
  label?: string;
}

/**
 * 转义CSV字段值
 * 处理包含逗号、引号、换行符的情况
 * @param value 原始值
 * @returns 转义后的CSV字段字符串
 */
export function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);

  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * 将事件数组转换为CSV字符串
 * @param events 事件数组
 * @param fields 字段定义数组
 * @returns CSV字符串
 */
export function toCSV(events: ExportEvent[], fields: (string | CSVField)[]): string {
  if (!Array.isArray(events) || events.length === 0) {
    const header = fields
      .map(f => (typeof f === 'string' ? f : f.label || f.key))
      .map(escapeCSVField)
      .join(',');
    return header;
  }

  const keys = fields.map(f => (typeof f === 'string' ? f : f.key));
  const labels = fields.map(f => (typeof f === 'string' ? f : f.label || f.key));

  const headerRow = labels.map(escapeCSVField).join(',');

  const dataRows = events.map(event => {
    return keys
      .map(key => {
        const value = event[key];
        return escapeCSVField(value);
      })
      .join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * 导出事件为CSV或JSON格式的Blob
 * @param events 事件数组
 * @param format 导出格式 'csv' | 'json'
 * @param fields CSV导出时的字段定义（可选，CSV时必填）
 * @returns Blob对象
 */
export function exportEvents(
  events: ExportEvent[],
  format: 'csv' | 'json',
  fields?: (string | CSVField)[]
): Blob {
  if (format === 'json') {
    const jsonStr = JSON.stringify(events, null, 2);
    return new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  }

  if (format === 'csv') {
    const csvFields = fields || extractFieldsFromEvents(events);
    const csvStr = toCSV(events, csvFields);
    const BOM = '\uFEFF';
    return new Blob([BOM + csvStr], { type: 'text/csv;charset=utf-8' });
  }

  throw new Error(`不支持的导出格式: ${format}`);
}

/**
 * 从事件数组自动提取字段
 * @param events 事件数组
 * @returns 字段键数组
 */
function extractFieldsFromEvents(events: ExportEvent[]): string[] {
  const fieldSet = new Set<string>();
  for (const event of events) {
    for (const key of Object.keys(event)) {
      fieldSet.add(key);
    }
  }
  return Array.from(fieldSet);
}

/**
 * 触发浏览器下载Blob
 * @param blob 要下载的Blob对象
 * @param filename 下载文件名
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
