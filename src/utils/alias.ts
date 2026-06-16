/**
 * 别名工具模块
 * 提供过敏原别名标准化、映射校验、别名解析等功能
 */

/**
 * 过敏原别名映射类型
 * key: 标准名
 * value: 别名数组
 */
export type AliasMap = Record<string, string[]>;

/**
 * 别名解析结果类型
 */
export interface AliasResolveResult {
  standardName: string | null;
  matchedAliases: string[];
}

/**
 * 校验错误类型
 */
export interface AliasValidationError {
  type: 'empty_standard' | 'duplicate_alias' | 'circular_reference';
  message: string;
  standardName?: string;
  alias?: string;
}

/**
 * 标准化别名名称
 * 去除首尾空格并转为小写
 * @param name 原始名称
 * @returns 标准化后的名称
 */
export function normalizeAliasName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * 校验别名映射
 * 检查循环引用、标准名空、别名重复
 * @param map 别名映射
 * @returns 校验错误数组（空数组表示校验通过）
 */
export function validateAliasMap(map: AliasMap): AliasValidationError[] {
  const errors: AliasValidationError[] = [];
  const aliasToStandard: Record<string, string> = {};

  for (const standard of Object.keys(map)) {
    const trimmedStandard = standard.trim();
    if (!trimmedStandard) {
      errors.push({
        type: 'empty_standard',
        message: '存在空的标准名称',
      });
      continue;
    }

    const aliases = map[standard] || [];
    for (const rawAlias of aliases) {
      const normalizedAlias = normalizeAliasName(rawAlias);
      if (!normalizedAlias) {
        continue;
      }

      if (aliasToStandard[normalizedAlias]) {
        errors.push({
          type: 'duplicate_alias',
          message: `别名 "${rawAlias}" 同时映射到 "${aliasToStandard[normalizedAlias]}" 和 "${trimmedStandard}"`,
          alias: rawAlias,
          standardName: trimmedStandard,
        });
      } else {
        aliasToStandard[normalizedAlias] = trimmedStandard;
      }
    }
  }

  for (const standard of Object.keys(map)) {
    const trimmedStandard = standard.trim();
    if (!trimmedStandard) {
      continue;
    }
    const normalizedStandard = normalizeAliasName(trimmedStandard);
    const aliases = map[standard] || [];
    for (const rawAlias of aliases) {
      const normalizedAlias = normalizeAliasName(rawAlias);
      if (!normalizedAlias) {
        continue;
      }
      if (aliasToStandard[normalizedStandard] && aliasToStandard[normalizedStandard] !== trimmedStandard) {
        errors.push({
          type: 'circular_reference',
          message: `标准名 "${trimmedStandard}" 与 "${aliasToStandard[normalizedStandard]}" 存在循环引用`,
          standardName: trimmedStandard,
        });
      }
    }
  }

  return errors;
}

/**
 * 解析过敏原别名
 * @param raw 原始名称（可能是别名）
 * @param map 别名映射
 * @returns 解析结果：标准名 + 命中的别名数组
 */
export function resolveAllergenAlias(raw: string, map: AliasMap): AliasResolveResult {
  const result: AliasResolveResult = {
    standardName: null,
    matchedAliases: [],
  };

  const normalizedRaw = normalizeAliasName(raw);
  if (!normalizedRaw) {
    return result;
  }

  for (const standard of Object.keys(map)) {
    const trimmedStandard = standard.trim();
    const normalizedStandard = normalizeAliasName(trimmedStandard);
    const aliases = map[standard] || [];

    if (normalizedRaw === normalizedStandard) {
      result.standardName = trimmedStandard;
      result.matchedAliases = aliases.filter(a => normalizeAliasName(a) !== normalizedStandard);
      return result;
    }

    for (const alias of aliases) {
      if (normalizedRaw === normalizeAliasName(alias)) {
        result.standardName = trimmedStandard;
        result.matchedAliases = aliases.filter(a => normalizeAliasName(a) !== normalizedStandard);
        return result;
      }
    }
  }

  return result;
}
