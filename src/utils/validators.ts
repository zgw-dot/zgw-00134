import {
  MenuItem,
  AllergyProfile,
  MealPickup,
  Complaint,
  ImportError,
} from '@/types';
import { isValidDate } from '@/utils/date';

export type ValidResult<T> = { valid: T[]; errors: ImportError[] };

const DATE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(str: string): boolean {
  if (!str) return false;
  const d = new Date(str);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str.slice(0, 10);
}

function toArray(value: any): string[] {
  if (Array.isArray(value)) {
    return value.map(v => String(v));
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(v => String(v));
      }
    } catch {}
    return trimmed.split(/[,，、;\s]+/).filter(Boolean);
  }
  return [];
}

function requireNonEmptyString(value: any): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

export function validateMenuRows(rows: any[], fileName?: string): ValidResult<MenuItem> {
  const valid: MenuItem[] = [];
  const errors: ImportError[] = [];

  if (!Array.isArray(rows)) {
    errors.push({
      file_type: 'menu',
      message: `输入数据不是数组，实际为: ${String(rows)}`,
      raw_data: rows,
    });
    return { valid, errors };
  }

  rows.forEach((row, index) => {
    const lineNumber = index + 1;
    const rowErrors: string[] = [];

    if (typeof row !== 'object' || row === null) {
      errors.push({
        file_type: 'menu',
        line_number: lineNumber,
        message: `第${lineNumber}行：数据不是有效的对象，实际为: ${String(row)}`,
        raw_data: row,
      });
      return;
    }

    const mealDateRaw = row.meal_date;
    const mealDate = requireNonEmptyString(mealDateRaw);
    if (mealDate === null) {
      rowErrors.push(`meal_date 不能为空，实际值: ${String(mealDateRaw)}`);
    } else if (!DATE_FORMAT_REGEX.test(mealDate)) {
      rowErrors.push(`meal_date 格式不正确(应为YYYY-MM-DD)，实际值: ${mealDate}`);
    } else if (!isValidDate(mealDate)) {
      rowErrors.push(`meal_date 不是合法日期，实际值: ${mealDate}`);
    }

    const dishIdRaw = row.dish_id;
    const dishId = requireNonEmptyString(dishIdRaw);
    if (dishId === null) {
      rowErrors.push(`dish_id 不能为空且trim后不能为空字符串，实际值: ${String(dishIdRaw)}`);
    }

    if (rowErrors.length > 0) {
      errors.push({
        file_type: 'menu',
        line_number: lineNumber,
        message: `第${lineNumber}行：${rowErrors.join('；')}`,
        raw_data: row,
      });
    } else {
      const item: MenuItem = {
        meal_date: mealDate as string,
        dish_id: dishId as string,
      };
      if (row.meal_type !== undefined && row.meal_type !== null) {
        item.meal_type = row.meal_type;
      }
      if (row.dish_name !== undefined && row.dish_name !== null) {
        item.dish_name = String(row.dish_name);
      }
      if (row.ingredients !== undefined && row.ingredients !== null) {
        item.ingredients = toArray(row.ingredients);
      }
      if (row.allergens_tagged !== undefined && row.allergens_tagged !== null) {
        item.allergens_tagged = toArray(row.allergens_tagged);
      }
      valid.push(item);
    }
  });

  return { valid, errors };
}

export function validateComplaints(arr: any[]): ValidResult<Complaint> {
  const valid: Complaint[] = [];
  const errors: ImportError[] = [];

  if (!Array.isArray(arr)) {
    errors.push({
      file_type: 'complaint',
      message: `输入数据不是数组，实际为: ${String(arr)}`,
      raw_data: arr,
    });
    return { valid, errors };
  }

  arr.forEach((item, index) => {
    const lineNumber = index + 1;
    const itemErrors: string[] = [];

    if (typeof item !== 'object' || item === null) {
      errors.push({
        file_type: 'complaint',
        line_number: lineNumber,
        message: `第${lineNumber}条：数据不是有效的对象，实际为: ${String(item)}`,
        raw_data: item,
      });
      return;
    }

    const complaintId = requireNonEmptyString(item.complaint_id);
    if (complaintId === null) {
      itemErrors.push(`complaint_id 不能为空，实际值: ${String(item.complaint_id)}`);
    }

    const studentId = requireNonEmptyString(item.student_id);
    if (studentId === null) {
      itemErrors.push(`student_id 不能为空，实际值: ${String(item.student_id)}`);
    }

    const mealDateRaw = item.meal_date;
    const mealDate = requireNonEmptyString(mealDateRaw);
    if (mealDate === null) {
      itemErrors.push(`meal_date 不能为空，实际值: ${String(mealDateRaw)}`);
    } else if (!DATE_FORMAT_REGEX.test(mealDate)) {
      itemErrors.push(`meal_date 格式不正确(应为YYYY-MM-DD)，实际值: ${mealDate}`);
    } else if (!isValidDate(mealDate)) {
      itemErrors.push(`meal_date 不是合法日期，实际值: ${mealDate}`);
    }

    const complaintTimeRaw = item.complaint_time;
    const complaintTime = requireNonEmptyString(complaintTimeRaw);
    if (complaintTime === null) {
      itemErrors.push(`complaint_time 不能为空，实际值: ${String(complaintTimeRaw)}`);
    } else if (!isIsoDate(complaintTime)) {
      itemErrors.push(`complaint_time 不是有效的ISO日期格式，实际值: ${complaintTime}`);
    }

    const symptomsArr = toArray(item.symptoms);
    if (symptomsArr.length === 0) {
      itemErrors.push(`symptoms 必须是非空数组或可转换为非空数组，实际值: ${String(item.symptoms)}`);
    }

    if (itemErrors.length > 0) {
      errors.push({
        file_type: 'complaint',
        line_number: lineNumber,
        message: `第${lineNumber}条：${itemErrors.join('；')}`,
        raw_data: item,
      });
    } else {
      const c: Complaint = {
        complaint_id: complaintId as string,
        student_id: studentId as string,
        meal_date: mealDate as string,
        complaint_time: complaintTime as string,
        symptoms: symptomsArr,
        description: item.description !== undefined && item.description !== null
          ? String(item.description)
          : '',
      };
      if (item.meal_type !== undefined && item.meal_type !== null) {
        c.meal_type = item.meal_type;
      }
      if (item.suspected_allergens !== undefined && item.suspected_allergens !== null) {
        c.suspected_allergens = toArray(item.suspected_allergens);
      }
      valid.push(c);
    }
  });

  return { valid, errors };
}

export function validateAllergyProfiles(arr: any[]): ValidResult<AllergyProfile> {
  const valid: AllergyProfile[] = [];
  const errors: ImportError[] = [];
  const validSeverities = ['mild', 'moderate', 'severe'];

  if (!Array.isArray(arr)) {
    errors.push({
      file_type: 'profile',
      message: `输入数据不是数组，实际为: ${String(arr)}`,
      raw_data: arr,
    });
    return { valid, errors };
  }

  arr.forEach((item, index) => {
    const lineNumber = index + 1;
    const itemErrors: string[] = [];

    if (typeof item !== 'object' || item === null) {
      errors.push({
        file_type: 'profile',
        line_number: lineNumber,
        message: `第${lineNumber}条：数据不是有效的对象，实际为: ${String(item)}`,
        raw_data: item,
      });
      return;
    }

    const studentId = requireNonEmptyString(item.student_id);
    if (studentId === null) {
      itemErrors.push(`student_id 不能为空，实际值: ${String(item.student_id)}`);
    }

    const studentName = requireNonEmptyString(item.student_name);
    if (studentName === null) {
      itemErrors.push(`student_name 不能为空，实际值: ${String(item.student_name)}`);
    }

    const className = requireNonEmptyString(item.class_name);
    if (className === null) {
      itemErrors.push(`class_name 不能为空，实际值: ${String(item.class_name)}`);
    }

    const allergensArr = toArray(item.allergens);
    if (allergensArr.length === 0) {
      itemErrors.push(`allergens 必须是非空数组，实际值: ${String(item.allergens)}`);
    }

    const severityRaw = requireNonEmptyString(item.severity);
    if (severityRaw === null) {
      itemErrors.push(`severity 不能为空，实际值: ${String(item.severity)}`);
    } else if (!validSeverities.includes(severityRaw)) {
      itemErrors.push(`severity 必须是 ['mild','moderate','severe'] 之一，实际值: ${severityRaw}`);
    }

    if (itemErrors.length > 0) {
      errors.push({
        file_type: 'profile',
        line_number: lineNumber,
        message: `第${lineNumber}条：${itemErrors.join('；')}`,
        raw_data: item,
      });
    } else {
      valid.push({
        student_id: studentId as string,
        student_name: studentName as string,
        class_name: className as string,
        allergens: allergensArr,
        severity: severityRaw as 'mild' | 'moderate' | 'severe',
      });
    }
  });

  return { valid, errors };
}

export function validateMealPickups(arr: any[]): ValidResult<MealPickup> {
  const valid: MealPickup[] = [];
  const errors: ImportError[] = [];

  if (!Array.isArray(arr)) {
    errors.push({
      file_type: 'pickup',
      message: `输入数据不是数组，实际为: ${String(arr)}`,
      raw_data: arr,
    });
    return { valid, errors };
  }

  arr.forEach((item, index) => {
    const lineNumber = index + 1;
    const itemErrors: string[] = [];

    if (typeof item !== 'object' || item === null) {
      errors.push({
        file_type: 'pickup',
        line_number: lineNumber,
        message: `第${lineNumber}条：数据不是有效的对象，实际为: ${String(item)}`,
        raw_data: item,
      });
      return;
    }

    const pickupId = requireNonEmptyString(item.pickup_id);
    if (pickupId === null) {
      itemErrors.push(`pickup_id 不能为空，实际值: ${String(item.pickup_id)}`);
    }

    const studentId = requireNonEmptyString(item.student_id);
    if (studentId === null) {
      itemErrors.push(`student_id 不能为空，实际值: ${String(item.student_id)}`);
    }

    const mealDateRaw = item.meal_date;
    const mealDate = requireNonEmptyString(mealDateRaw);
    if (mealDate === null) {
      itemErrors.push(`meal_date 不能为空，实际值: ${String(mealDateRaw)}`);
    } else if (!DATE_FORMAT_REGEX.test(mealDate)) {
      itemErrors.push(`meal_date 格式不正确(应为YYYY-MM-DD)，实际值: ${mealDate}`);
    } else if (!isValidDate(mealDate)) {
      itemErrors.push(`meal_date 不是合法日期，实际值: ${mealDate}`);
    }

    const dishIdsArr = toArray(item.dish_ids);
    if (dishIdsArr.length === 0) {
      itemErrors.push(`dish_ids 必须是非空数组，实际值: ${String(item.dish_ids)}`);
    }

    const pickupTimeRaw = item.pickup_time;
    const pickupTime = requireNonEmptyString(pickupTimeRaw);
    if (pickupTime === null) {
      itemErrors.push(`pickup_time 不能为空，实际值: ${String(pickupTimeRaw)}`);
    } else if (!isIsoDate(pickupTime)) {
      itemErrors.push(`pickup_time 不是有效的ISO日期格式，实际值: ${pickupTime}`);
    }

    if (itemErrors.length > 0) {
      errors.push({
        file_type: 'pickup',
        line_number: lineNumber,
        message: `第${lineNumber}条：${itemErrors.join('；')}`,
        raw_data: item,
      });
    } else {
      const p: MealPickup = {
        pickup_id: pickupId as string,
        student_id: studentId as string,
        meal_date: mealDate as string,
        dish_ids: dishIdsArr,
        pickup_time: pickupTime as string,
      };
      if (item.meal_type !== undefined && item.meal_type !== null) {
        p.meal_type = item.meal_type;
      }
      valid.push(p);
    }
  });

  return { valid, errors };
}
