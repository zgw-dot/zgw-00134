/**
 * 日期时间工具模块
 * 提供日期校验、时间加减、格式化、时间窗计算等功能
 */

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 校验YYYY-MM-DD格式日期是否合法
 * @param dateStr 日期字符串
 * @returns 是否合法
 */
export function isValidDate(dateStr: string): boolean {
  if (!DATE_REGEX.test(dateStr)) {
    return false;
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return false;
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * ISO时间字符串或Date对象加减小时
 * @param dateInput ISO时间字符串或Date对象
 * @param hours 要加减的小时数（正数加，负数减）
 * @returns 新的Date对象
 */
export function addHours(dateInput: string | Date, hours: number): Date {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput);
  const result = new Date(date.getTime());
  result.setHours(result.getHours() + hours);
  return result;
}

/**
 * 格式化时间为显示字符串
 * @param dateInput ISO时间字符串或Date对象
 * @param format 格式，支持 'full' | 'date' | 'time' | 'datetime'
 * @returns 格式化后的时间字符串
 */
export function formatTime(
  dateInput: string | Date,
  format: 'full' | 'date' | 'time' | 'datetime' = 'datetime'
): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput);
  if (isNaN(date.getTime())) {
    return '';
  }

  const pad = (n: number) => n.toString().padStart(2, '0');

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hours}:${minutes}:${seconds}`;
  const timeShortStr = `${hours}:${minutes}`;

  switch (format) {
    case 'full':
      return `${dateStr} ${timeStr}`;
    case 'date':
      return dateStr;
    case 'time':
      return timeShortStr;
    case 'datetime':
      return `${dateStr} ${timeShortStr}`;
    default:
      return `${dateStr} ${timeShortStr}`;
  }
}

/**
 * 时间窗结果类型
 */
export interface TimeWindow {
  start: Date;
  end: Date;
  startISO: string;
  endISO: string;
  center: Date;
  centerISO: string;
}

/**
 * 计算±N小时时间窗
 * @param dateInput ISO时间字符串或Date对象
 * @param offsetHours 偏移小时数，默认2小时
 * @returns 时间窗对象
 */
export function timeWindow(dateInput: string | Date, offsetHours: number = 2): TimeWindow {
  const center = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput);
  const start = addHours(center, -offsetHours);
  const end = addHours(center, offsetHours);

  return {
    start,
    end,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    center,
    centerISO: center.toISOString(),
  };
}
