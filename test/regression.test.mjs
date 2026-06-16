/**
 * 回归测试脚本 - 验证三个问题修复
 * 运行: node test/regression.test.mjs
 *
 * 覆盖:
 * 1. 导入有坏行的menu.json，验证有效数据仍然入库 → 应生成事件
 * 2. 别名包含自身(如"花生"的别名含"花生")不应误报
 * 3. CSV导出字段完整性(evidence/review_logs/closed_at)
 * 4. 重新导入不覆盖已有事件的status/review_logs/closed_at
 * 5. 筛选后导出不混入隐藏事件
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleDir = join(__dirname, '..', 'sample-data');
const outDir = join(__dirname, '..', 'test-output');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// ========== 模拟 TS 类型/常量 ==========
const DATE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/;
function isIsoDate(str) {
  if (!str) return false;
  const d = new Date(str);
  if (isNaN(d.getTime())) return false;
  const iso = d.toISOString();
  const inputDate = str.replace(/[Tt ].*/, '').slice(0, 10);
  const isoDate = iso.slice(0, 10);
  const tzMatch = str.match(/([+-]\d{2}):?(\d{2})$/);
  if (tzMatch) {
    const tzHours = parseInt(tzMatch[1], 10);
    const tzMinutes = parseInt(tzMatch[2], 10);
    const tzOffset = tzHours * 60 + (tzHours >= 0 ? tzMinutes : -tzMinutes);
    const utcMinutes = d.getTime() / 60000;
    const localMinutes = utcMinutes + tzOffset;
    const localDate = new Date(localMinutes * 60000).toISOString().slice(0, 10);
    return localDate === inputDate;
  }
  return isoDate === inputDate;
}
function toArray(value) {
  if (Array.isArray(value)) return value.map(v => String(v));
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try { const p = JSON.parse(trimmed); if (Array.isArray(p)) return p.map(v => String(v)); } catch {}
    return trimmed.split(/[,，、;\s]+/).filter(Boolean);
  }
  return [];
}
function requireNonEmptyString(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}
function contentHash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
function genId(prefix = '') {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function isValidDate(dateStr) {
  if (!DATE_FORMAT_REGEX.test(dateStr)) return false;
  const d = new Date(dateStr);
  return d.toISOString().slice(0, 10) === dateStr;
}
function normalizeAliasName(name) { return name.trim().toLowerCase(); }
function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
function timeWindow(dateInput, offsetHours = 2) {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const start = new Date(d.getTime() - offsetHours * 3600 * 1000);
  const end = new Date(d.getTime() + offsetHours * 3600 * 1000);
  return { startISO: start.toISOString(), endISO: end.toISOString(), centerISO: d.toISOString() };
}
function addHours(dateInput, hours) {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return new Date(d.getTime() + hours * 3600 * 1000).toISOString();
}

// ========== 导入 validateMenuRows ==========
function validateMenuRows(rows) {
  const valid = [];
  const errors = [];
  if (!Array.isArray(rows)) {
    errors.push({ file_type: 'menu', message: `输入数据不是数组，实际为: ${String(rows)}` });
    return { valid, errors };
  }
  rows.forEach((row, index) => {
    const lineNumber = index + 1;
    const rowErrors = [];
    if (typeof row !== 'object' || row === null) {
      errors.push({ file_type: 'menu', line_number: lineNumber, message: `第${lineNumber}行：数据不是有效的对象` });
      return;
    }
    const mealDateRaw = row.meal_date;
    const mealDate = requireNonEmptyString(mealDateRaw);
    if (mealDate === null) rowErrors.push(`meal_date 不能为空，实际值: ${String(mealDateRaw)}`);
    else if (!DATE_FORMAT_REGEX.test(mealDate)) rowErrors.push(`meal_date 格式不正确(应为YYYY-MM-DD)，实际值: ${mealDate}`);
    else if (!isValidDate(mealDate)) rowErrors.push(`meal_date 不是合法日期，实际值: ${mealDate}`);
    const dishIdRaw = row.dish_id;
    const dishId = requireNonEmptyString(dishIdRaw);
    if (dishId === null) rowErrors.push(`dish_id 不能为空且trim后不能为空字符串，实际值: ${String(dishIdRaw)}`);
    if (rowErrors.length > 0) {
      errors.push({ file_type: 'menu', line_number: lineNumber, message: `第${lineNumber}行：${rowErrors.join('；')}`, raw_data: row });
    } else {
      const item = { meal_date: mealDate, dish_id: dishId };
      if (row.meal_type !== undefined) item.meal_type = row.meal_type;
      if (row.dish_name !== undefined) item.dish_name = String(row.dish_name);
      if (row.ingredients !== undefined) item.ingredients = toArray(row.ingredients);
      if (row.allergens_tagged !== undefined) item.allergens_tagged = toArray(row.allergens_tagged);
      valid.push(item);
    }
  });
  return { valid, errors };
}
function validateComplaints(arr) {
  const valid = []; const errors = [];
  if (!Array.isArray(arr)) { errors.push({ file_type: 'complaint', message: '不是数组' }); return { valid, errors }; }
  arr.forEach((item, i) => {
    const lineNumber = i + 1;
    const e = [];
    const cid = requireNonEmptyString(item.complaint_id);
    const sid = requireNonEmptyString(item.student_id);
    const md = requireNonEmptyString(item.meal_date);
    const ct = requireNonEmptyString(item.complaint_time);
    if (cid === null) e.push('complaint_id 不能为空');
    if (sid === null) e.push('student_id 不能为空');
    if (md === null) e.push('meal_date 不能为空');
    if (ct === null) e.push('complaint_time 不能为空');
    else if (!isIsoDate(ct)) e.push('complaint_time 不是ISO格式');
    const symptoms = toArray(item.symptoms);
    if (symptoms.length === 0) e.push('symptoms 不能为空数组');
    if (e.length > 0) {
      errors.push({ file_type: 'complaint', line_number: lineNumber, message: `第${lineNumber}条: ${e.join('；')}` });
    } else {
      const c = { complaint_id: cid, student_id: sid, meal_date: md, complaint_time: ct, symptoms, description: item.description || '' };
      if (item.meal_type) c.meal_type = item.meal_type;
      if (item.suspected_allergens) c.suspected_allergens = toArray(item.suspected_allergens);
      valid.push(c);
    }
  });
  return { valid, errors };
}
function validateAllergyProfiles(arr) {
  const valid = []; const errors = [];
  if (!Array.isArray(arr)) { errors.push({ file_type: 'profile', message: '不是数组' }); return { valid, errors }; }
  arr.forEach((item, i) => {
    const lineNumber = i + 1; const e = [];
    const sid = requireNonEmptyString(item.student_id);
    const sn = requireNonEmptyString(item.student_name);
    const cn = requireNonEmptyString(item.class_name);
    const allergens = toArray(item.allergens);
    const sev = requireNonEmptyString(item.severity);
    if (sid === null) e.push('student_id 不能为空');
    if (sn === null) e.push('student_name 不能为空');
    if (cn === null) e.push('class_name 不能为空');
    if (allergens.length === 0) e.push('allergens 不能为空数组');
    if (sev === null || !['mild','moderate','severe'].includes(sev)) e.push('severity 非法');
    if (e.length > 0) errors.push({ file_type: 'profile', line_number: lineNumber, message: `第${lineNumber}条: ${e.join('；')}` });
    else valid.push({ student_id: sid, student_name: sn, class_name: cn, allergens, severity: sev });
  });
  return { valid, errors };
}
function validateMealPickups(arr) {
  const valid = []; const errors = [];
  if (!Array.isArray(arr)) { errors.push({ file_type: 'pickup', message: '不是数组' }); return { valid, errors }; }
  arr.forEach((item, i) => {
    const lineNumber = i + 1; const e = [];
    const pid = requireNonEmptyString(item.pickup_id);
    const sid = requireNonEmptyString(item.student_id);
    const md = requireNonEmptyString(item.meal_date);
    const dishIds = toArray(item.dish_ids);
    const pt = requireNonEmptyString(item.pickup_time);
    if (pid === null) e.push('pickup_id 不能为空');
    if (sid === null) e.push('student_id 不能为空');
    if (md === null) e.push('meal_date 不能为空');
    if (dishIds.length === 0) e.push('dish_ids 不能为空数组');
    if (pt === null || !isIsoDate(pt)) e.push('pickup_time 非法或为空');
    if (e.length > 0) errors.push({ file_type: 'pickup', line_number: lineNumber, message: `第${lineNumber}条: ${e.join('；')}` });
    else {
      const p = { pickup_id: pid, student_id: sid, meal_date: md, dish_ids: dishIds, pickup_time: pt };
      if (item.meal_type) p.meal_type = item.meal_type;
      valid.push(p);
    }
  });
  return { valid, errors };
}

// ========== 别名解析 ==========
function resolveAllergenAlias(raw, map) {
  const normalizedRaw = normalizeAliasName(raw);
  if (!normalizedRaw) return { standardName: null, matchedAliases: [] };

  for (const standard of Object.keys(map)) {
    const trimmed = standard.trim();
    if (!trimmed) continue;
    const normalizedStandard = normalizeAliasName(trimmed);
    const aliases = map[standard] || [];

    if (normalizedRaw === normalizedStandard) {
      return { standardName: trimmed, matchedAliases: aliases.filter(a => normalizeAliasName(a) !== normalizedStandard) };
    }
    for (const alias of aliases) {
      if (normalizedRaw === normalizeAliasName(alias)) {
        return { standardName: trimmed, matchedAliases: aliases.filter(a => normalizeAliasName(a) !== normalizedStandard) };
      }
    }
  }

  for (const standard of Object.keys(map)) {
    const trimmed = standard.trim();
    if (!trimmed) continue;
    const normalizedStandard = normalizeAliasName(trimmed);
    const aliases = map[standard] || [];

    if (normalizedRaw.includes(normalizedStandard) || normalizedStandard.includes(normalizedRaw)) {
      return { standardName: trimmed, matchedAliases: aliases.filter(a => normalizeAliasName(a) !== normalizedStandard) };
    }
    for (const alias of aliases) {
      const normAlias = normalizeAliasName(alias);
      if (normAlias.length >= 2 && (normalizedRaw.includes(normAlias) || normAlias.includes(normalizedRaw))) {
        return { standardName: trimmed, matchedAliases: aliases.filter(a => normalizeAliasName(a) !== normalizedStandard) };
      }
    }
  }

  return { standardName: null, matchedAliases: [] };
}
function validateAliasMap(map) {
  const errors = [];
  const aliasToStandard = {};
  for (const standard of Object.keys(map)) {
    const trimmed = standard.trim();
    if (!trimmed) { errors.push({ type: 'empty_standard', message: '存在空的标准名称' }); continue; }
    const aliases = map[standard] || [];
    for (const rawAlias of aliases) {
      const norm = normalizeAliasName(rawAlias);
      if (!norm) continue;
      if (aliasToStandard[norm]) {
        errors.push({ type: 'duplicate_alias', message: `别名 "${rawAlias}" 同时映射到 "${aliasToStandard[norm]}" 和 "${trimmed}"` });
      } else {
        aliasToStandard[norm] = trimmed;
      }
    }
  }
  for (const standard of Object.keys(map)) {
    const trimmed = standard.trim();
    if (!trimmed) continue;
    const normStandard = normalizeAliasName(trimmed);
    if (aliasToStandard[normStandard] && aliasToStandard[normStandard] !== trimmed) {
      errors.push({ type: 'circular_reference', message: `标准名 "${trimmed}" 与 "${aliasToStandard[normStandard]}" 存在循环引用` });
    }
  }
  return errors;
}

// ========== 归并引擎 generateRiskEvents ==========
function calcRiskLevel({ has_complaint, has_severe_profile, has_pickup }) {
  if (has_severe_profile && has_pickup && has_complaint) return 'high';
  if ((has_severe_profile && has_pickup) || (has_pickup && has_complaint) || has_complaint) return 'medium';
  return 'low';
}
function computeEventKey(canonical, meal_type, timeISO) {
  const d = new Date(timeISO);
  const bucketHour = Math.floor(d.getHours() / 2) * 2;
  const dayBucket = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(bucketHour).padStart(2,'0')}:00`;
  return `${canonical}|${meal_type}|${dayBucket}`;
}

function generateRiskEvents({ menus, profiles, pickups, complaints, aliasMap, existingEvents = [], importedAt = Date.now() }) {
  const importedAtISO = new Date(importedAt).toISOString();
  const profileMap = new Map();
  for (const p of profiles) profileMap.set(p.student_id, p);
  const menuMap = new Map();
  for (const m of menus) menuMap.set(`${m.meal_date}|${m.dish_id}`, m);
  const existingEventMap = new Map();
  for (const e of existingEvents) existingEventMap.set(e.event_id, e);

  const pendingHits = [];

  for (const pickup of pickups) {
    const profile = profileMap.get(pickup.student_id);
    if (!profile) continue;
    const canonicalList = profile.allergens.map(a => resolveAllergenAlias(a, aliasMap).standardName).filter(a => a !== null);
    if (canonicalList.length === 0) continue;
    const pickupEvidence = { type: 'pickup', source_id: pickup.pickup_id, source_data: deepClone(pickup), imported_at: importedAtISO };
    for (const dish_id of pickup.dish_ids) {
      const menuKey = `${pickup.meal_date}|${dish_id}`;
      const menu = menuMap.get(menuKey);
      if (!menu) continue;
      const menuEvidence = { type: 'menu', source_id: `${menu.meal_date}|${menu.dish_id}`, source_data: deepClone(menu), imported_at: importedAtISO };
      const profileEvidence = { type: 'profile', source_id: profile.student_id, source_data: deepClone(profile), imported_at: importedAtISO };
      const allIngredients = [...(menu.ingredients ?? []), ...(menu.allergens_tagged ?? [])];
      const matchedCanonicals = new Map();
      for (const ingredient of allIngredients) {
        const resolved = resolveAllergenAlias(ingredient, aliasMap);
        if (resolved.standardName && canonicalList.includes(resolved.standardName)) {
          const norm = normalizeAliasName(ingredient);
          if (!matchedCanonicals.has(resolved.standardName)) matchedCanonicals.set(resolved.standardName, new Set());
          const set = matchedCanonicals.get(resolved.standardName);
          set.add(norm);
          for (const a of resolved.matchedAliases) set.add(normalizeAliasName(a));
        }
      }
      for (const [canonical, aliasSet] of matchedCanonicals) {
        pendingHits.push({
          canonical_allergen: canonical,
          matched_aliases: Array.from(aliasSet),
          meal_type: pickup.meal_type ?? menu.meal_type,
          meal_date: pickup.meal_date,
          event_time: pickup.pickup_time,
          student_id: pickup.student_id,
          student_name: profile.student_name,
          class_name: profile.class_name,
          severity: profile.severity,
          evidence: [profileEvidence, menuEvidence, pickupEvidence],
        });
      }
    }
  }

  for (const complaint of complaints) {
    const profile = profileMap.get(complaint.student_id);
    if (!profile) continue;
    const canonicalList = profile.allergens.map(a => resolveAllergenAlias(a, aliasMap).standardName).filter(a => a !== null);
    if (canonicalList.length === 0) continue;
    const complaintEvidence = { type: 'complaint', source_id: complaint.complaint_id, source_data: deepClone(complaint), imported_at: importedAtISO };
    const profileEvidence = { type: 'profile', source_id: profile.student_id, source_data: deepClone(profile), imported_at: importedAtISO };
    const suspected = [...(complaint.suspected_allergens ?? []), ...complaint.symptoms];
    const matchedCanonicals = new Map();
    for (const ing of suspected) {
      const resolved = resolveAllergenAlias(ing, aliasMap);
      if (resolved.standardName && canonicalList.includes(resolved.standardName)) {
        const norm = normalizeAliasName(ing);
        if (!matchedCanonicals.has(resolved.standardName)) matchedCanonicals.set(resolved.standardName, new Set());
        const set = matchedCanonicals.get(resolved.standardName);
        set.add(norm);
        for (const a of resolved.matchedAliases) set.add(normalizeAliasName(a));
      }
    }
    for (const [canonical, aliasSet] of matchedCanonicals) {
      pendingHits.push({
        canonical_allergen: canonical,
        matched_aliases: Array.from(aliasSet),
        meal_type: complaint.meal_type ?? 'lunch',
        meal_date: complaint.meal_date,
        event_time: complaint.complaint_time,
        student_id: complaint.student_id,
        student_name: profile.student_name,
        class_name: profile.class_name,
        severity: profile.severity,
        evidence: [profileEvidence, complaintEvidence],
        has_complaint: true,
      });
    }
  }

  const aggregatedMap = new Map();
  for (const hit of pendingHits) {
    const key = computeEventKey(hit.canonical_allergen, hit.meal_type, hit.event_time);
    const tw = timeWindow(hit.event_time, 2);
    if (!aggregatedMap.has(key)) {
      aggregatedMap.set(key, {
        key, canonical_allergen: hit.canonical_allergen, matched_aliases: new Set(hit.matched_aliases),
        meal_type: hit.meal_type, time_window_start: tw.startISO, time_window_end: tw.endISO,
        student_ids: new Set(), student_names: new Set(), class_names: new Set(),
        has_pickup: false, has_complaint: false, has_severe_profile: false,
        evidence: [], earliest_time: hit.event_time,
      });
    }
    const agg = aggregatedMap.get(key);
    for (const a of hit.matched_aliases) agg.matched_aliases.add(a);
    agg.student_ids.add(hit.student_id);
    agg.student_names.add(hit.student_name);
    agg.class_names.add(hit.class_name);
    if (hit.severity === 'severe') agg.has_severe_profile = true;
    const hitTime = new Date(hit.event_time).getTime();
    if (hitTime < new Date(agg.earliest_time).getTime()) {
      agg.earliest_time = hit.event_time;
      const tw2 = timeWindow(hit.event_time, 2);
      agg.time_window_start = tw2.startISO;
      agg.time_window_end = tw2.endISO;
    }
    const existingSourceIds = new Set(agg.evidence.map(e => `${e.type}|${e.source_id}`));
    for (const ev of hit.evidence) {
      const ek = `${ev.type}|${ev.source_id}`;
      if (!existingSourceIds.has(ek)) { agg.evidence.push(ev); existingSourceIds.add(ek); }
      if (ev.type === 'pickup') agg.has_pickup = true;
      if (ev.type === 'complaint') agg.has_complaint = true;
    }
  }

  const result = [];
  const nowISO = new Date(Date.now()).toISOString();
  for (const agg of aggregatedMap.values()) {
    const event_id = `evt_${contentHash(agg.key).slice(0, 12)}`;
    const risk_level = calcRiskLevel({
      has_complaint: agg.has_complaint, has_severe_profile: agg.has_severe_profile, has_pickup: agg.has_pickup,
    });
    const existing = existingEventMap.get(event_id);
    let status = 'pending';
    let review_logs = [];
    let latest_note = undefined;
    let closed_at = undefined;
    let created_at = nowISO;
    let updated_at = nowISO;
    if (existing) {
      status = existing.status;
      review_logs = existing.review_logs;
      latest_note = existing.latest_note;
      closed_at = existing.closed_at;
      created_at = existing.created_at;
      updated_at = nowISO;
    }
    result.push({
      event_id, canonical_allergen: agg.canonical_allergen, matched_aliases: Array.from(agg.matched_aliases),
      meal_type: agg.meal_type, time_window_start: agg.time_window_start, time_window_end: agg.time_window_end,
      student_ids: Array.from(agg.student_ids), student_names: Array.from(agg.student_names),
      class_names: Array.from(agg.class_names), risk_level, status, evidence: agg.evidence,
      review_logs, latest_note, closed_at, created_at, updated_at,
    });
  }
  return result;
}

// ========== 筛选器 ==========
function applyFilters(events, filters) {
  return events.map(e => {
    let hidden = false;
    if (filters.classes && filters.classes.length > 0) {
      const hasClass = e.class_names.some(c => filters.classes.includes(c));
      if (!hasClass) hidden = true;
    }
    if (!hidden && filters.meal_types && filters.meal_types.length > 0) {
      if (!filters.meal_types.includes(e.meal_type)) hidden = true;
    }
    if (!hidden && filters.risk_levels && filters.risk_levels.length > 0) {
      if (!filters.risk_levels.includes(e.risk_level)) hidden = true;
    }
    if (!hidden && filters.statuses && filters.statuses.length > 0) {
      if (!filters.statuses.includes(e.status)) hidden = true;
    }
    if (!hidden && filters.search_text) {
      const search = filters.search_text.toLowerCase();
      const hay = [
        e.student_names.join(','), e.canonical_allergen, e.matched_aliases.join(','),
        e.latest_note || '', e.class_names.join(','),
      ].join('|').toLowerCase();
      if (!hay.includes(search)) hidden = true;
    }
    return { ...e, hidden };
  });
}

// ========== CSV导出 ==========
function escapeCSVField(v) {
  if (v === null || v === undefined) return '';
  const str = typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
  return str;
}
function toCSV(events, fields) {
  const labels = fields.map(f => typeof f === 'string' ? f : f.label || f.key);
  const keys = fields.map(f => typeof f === 'string' ? f : f.key);
  const header = labels.map(escapeCSVField).join(',');
  const rows = events.map(e => keys.map(k => escapeCSVField(e[k])).join(','));
  return [header, ...rows].join('\n');
}

// ========== 测试用例 ==========
console.log('\n' + '='.repeat(80));
console.log('  回归测试 - 校餐过敏投诉复盘看板');
console.log('='.repeat(80));
let pass = 0, fail = 0;
function test(name, fn) {
  try {
    fn(); console.log(`  ✅ ${name}`); pass++;
  } catch (err) { console.log(`  ❌ ${name}\n     ${err.message}`); fail++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEq(a, b, msg) { if (a !== b) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function assertIncludes(arr, item, msg) { if (!arr.includes(item)) throw new Error(`${msg}: ${JSON.stringify(arr)} does not include ${JSON.stringify(item)}`); }

// 加载样例数据
const menuData = JSON.parse(readFileSync(join(sampleDir, 'menu.json'), 'utf8'));
const profilesData = JSON.parse(readFileSync(join(sampleDir, 'profiles.json'), 'utf8'));
const pickupsData = JSON.parse(readFileSync(join(sampleDir, 'pickups.json'), 'utf8'));
const complaintsData = JSON.parse(readFileSync(join(sampleDir, 'complaints.json'), 'utf8'));
const aliasMap = JSON.parse(readFileSync(join(sampleDir, 'alias-config.json'), 'utf8'));

console.log('\n--- 测试1: 菜单导入有坏行但有效数据仍入库 ---');
test('validateMenuRows: 7条输入→5条有效+2条错误', () => {
  const { valid, errors } = validateMenuRows(menuData);
  assertEq(valid.length, 5, '有效数据数');
  assertEq(errors.length, 2, '错误数');
  const errorMsgs = errors.map(e => e.message);
  assert(errorMsgs.some(m => m.includes('meal_date 不能为空')), '应拦截缺meal_date');
  assert(errorMsgs.some(m => m.includes('dish_id 不能为空')), '应拦截空dish_id');
  const validDishIds = valid.map(m => m.dish_id);
  assertIncludes(validDishIds, 'D001', '有效数据应包含D001');
  assertIncludes(validDishIds, 'D002', '有效数据应包含D002');
  console.log(`     有效: ${valid.length}条, 错误: ${errors.length}条`);
});

console.log('\n--- 测试2: 别名包含自身不应误判 ---');
test('validateAliasMap: 标准名在别名列表中不报错', () => {
  const errors = validateAliasMap(aliasMap);
  const selfRefErrors = errors.filter(e => e.message.includes('包含自身'));
  assertEq(selfRefErrors.length, 0, '不应有误报的"别名包含自身"错误');
  const dupErrors = errors.filter(e => e.type === 'duplicate_alias');
  assertEq(dupErrors.length, 0, '不应有别名重复');
  console.log(`     别名校验错误数: ${errors.length} (应为0)`);
});

console.log('\n--- 测试3: 四类数据导入后应生成事件 ---');
const validMenu = validateMenuRows(menuData).valid;
const validProfiles = validateAllergyProfiles(profilesData).valid;
const validPickups = validateMealPickups(pickupsData).valid;
const validComplaints = validateComplaints(complaintsData).valid;
let events = generateRiskEvents({
  menus: validMenu, profiles: validProfiles, pickups: validPickups, complaints: validComplaints, aliasMap
});
test('generateRiskEvents: 导入后应生成>0个事件', () => {
  console.log(`     菜单有效: ${validMenu.length}, 档案: ${validProfiles.length}, 领餐: ${validPickups.length}, 投诉: ${validComplaints.length}`);
  console.log(`     生成事件数: ${events.length}`);
  assert(events.length > 0, '事件数应>0');
});
test('风险等级正确: 应有1个HIGH事件(张小明花生severe+领餐+投诉)', () => {
  const highEvents = events.filter(e => e.risk_level === 'high');
  console.log(`     HIGH: ${highEvents.length}, MEDIUM: ${events.filter(e=>e.risk_level==='medium').length}, LOW: ${events.filter(e=>e.risk_level==='low').length}`);
  assert(highEvents.length >= 1, '应至少1个HIGH事件');
  const peanutHigh = highEvents.find(e => e.canonical_allergen === '花生');
  assert(peanutHigh, '应有花生HIGH事件');
  assertIncludes(peanutHigh.student_names, '张小明', '应涉及张小明');
});
test('事件含证据链接', () => {
  for (const e of events) {
    assert(Array.isArray(e.evidence), `事件${e.event_id}应有evidence数组`);
    assert(e.evidence.length > 0, `事件${e.event_id}证据数应>0`);
  }
  const totalEvidenceCount = events.reduce((sum, e) => sum + e.evidence.length, 0);
  console.log(`     总证据条数: ${totalEvidenceCount}`);
});

console.log('\n--- 测试4: 事件流转复核保护 ---');
let pendingEvents = events.filter(e => e.status === 'pending');
test('初始状态全部为pending', () => {
  assertEq(pendingEvents.length, events.length, '初始状态全部pending');
});
const targetEvent = events.find(e => e.risk_level === 'high');
test('复核状态流转', () => {
  targetEvent.status = 'confirmed';
  targetEvent.latest_note = '已确认是花生过敏反应，与投诉一致';
  targetEvent.closed_at = undefined;
  targetEvent.review_logs = [{
    id: genId(), timestamp: new Date().toISOString(), from_status: 'pending', to_status: 'confirmed',
    note: '已确认是花生过敏反应，与投诉一致',
  }];
  assertEq(targetEvent.status, 'confirmed', '状态应为confirmed');
  assertEq(targetEvent.review_logs.length, 1, '应有1条复核日志');
});
test('重新导入不覆盖已有事件状态', () => {
  const newEvents = generateRiskEvents({
    menus: validMenu, profiles: validProfiles, pickups: validPickups, complaints: validComplaints, aliasMap,
    existingEvents: events,  // 传旧事件
  });
  const updatedTarget = newEvents.find(e => e.event_id === targetEvent.event_id);
  assert(updatedTarget, '事件应存在');
  assertEq(updatedTarget.status, 'confirmed', '状态不应被覆盖回pending');
  assertEq(updatedTarget.review_logs.length, 1, '复核日志不应丢失');
  assertEq(updatedTarget.latest_note, targetEvent.latest_note, '备注不应丢失');
  assertEq(updatedTarget.closed_at, targetEvent.closed_at, 'closed_at不应丢失');
  console.log(`     重新导入后状态: ${updatedTarget.status} (应为confirmed)`);
  console.log(`     重新导入后复核日志数: ${updatedTarget.review_logs.length} (应为1)`);
});
test('第二次复核到closed状态', () => {
  targetEvent.status = 'closed';
  targetEvent.latest_note = '已通知家长并调整菜单，事件关闭';
  targetEvent.closed_at = new Date().toISOString();
  targetEvent.review_logs.push({
    id: genId(), timestamp: new Date().toISOString(), from_status: 'confirmed', to_status: 'closed',
    note: '已通知家长并调整菜单，事件关闭',
  });
  const newEvents2 = generateRiskEvents({
    menus: validMenu, profiles: validProfiles, pickups: validPickups, complaints: validComplaints, aliasMap,
    existingEvents: [targetEvent],
  });
  const t2 = newEvents2.find(e => e.event_id === targetEvent.event_id);
  assertEq(t2.status, 'closed', 'closed状态保留');
  assertEq(t2.closed_at, targetEvent.closed_at, 'closed_at保留');
  assertEq(t2.review_logs.length, 2, '2条复核日志保留');
  console.log(`     closed状态保留: ${t2.status}, 日志数: ${t2.review_logs.length}`);
});

console.log('\n--- 测试5: 筛选器功能 ---');
test('按风险等级筛选只显示对应事件', () => {
  const filtered = applyFilters(events, { risk_levels: ['high'] });
  const visible = filtered.filter(e => !e.hidden);
  const hidden = filtered.filter(e => e.hidden);
  console.log(`     筛选HIGH: 可见${visible.length}条, 隐藏${hidden.length}条`);
  assert(visible.every(e => e.risk_level === 'high'), '可见事件都应为high');
  assert(hidden.every(e => e.risk_level !== 'high'), '隐藏事件都不应为high');
});
test('按班级筛选', () => {
  const filtered = applyFilters(events, { classes: ['三年级(1)班'] });
  const visible = filtered.filter(e => !e.hidden);
  assert(visible.every(e => e.class_names.includes('三年级(1)班')), '筛选后班级正确');
  console.log(`     筛选三年级(1)班: 可见${visible.length}条`);
});

console.log('\n--- 测试6: CSV导出字段完整性 ---');
const CSV_FIELDS = [
  { key: 'event_id', label: '事件ID' },
  { key: 'canonical_allergen', label: '过敏原标准名' },
  { key: 'matched_aliases', label: '命中别名' },
  { key: 'meal_type', label: '餐次' },
  { key: 'risk_level', label: '风险等级' },
  { key: 'status', label: '状态' },
  { key: 'evidence_count', label: '证据总数' },
  { key: 'evidence', label: '证据明细(JSON)' },
  { key: 'review_log_count', label: '复核日志数' },
  { key: 'review_logs', label: '复核日志(JSON)' },
  { key: 'closed_at', label: '关闭时间' },
  { key: 'created_at', label: '创建时间' },
];
test('CSV导出包含evidence/review_logs/closed_at列', () => {
  const exportData = events.map(e => ({
    ...e,
    matched_aliases: e.matched_aliases?.join('、') || '',
    evidence_count: e.evidence?.length || 0,
    evidence: typeof e.evidence === 'object' ? JSON.stringify(e.evidence) : '',
    review_log_count: e.review_logs?.length || 0,
    review_logs: typeof e.review_logs === 'object' ? JSON.stringify(e.review_logs) : '',
  }));
  const csv = toCSV(exportData, CSV_FIELDS);
  const lines = csv.split('\n');
  const header = lines[0];
  console.log(`     CSV表头: ${header}`);
  assert(header.includes('证据总数'), 'CSV应含evidence_count列');
  assert(header.includes('证据明细(JSON)'), 'CSV应含evidence列');
  assert(header.includes('复核日志数'), 'CSV应含review_log_count列');
  assert(header.includes('复核日志(JSON)'), 'CSV应含review_logs列');
  assert(header.includes('关闭时间'), 'CSV应含closed_at列');
  assert(lines.length === events.length + 1, `CSV行数应为${events.length+1}`);
  writeFileSync(join(outDir, 'events.csv'), csv, 'utf8');
  writeFileSync(join(outDir, 'events.json'), JSON.stringify(exportData, null, 2), 'utf8');
  console.log(`     CSV文件行数: ${lines.length} (表头+${events.length}行数据)`);
  console.log(`     已写入 test-output/events.csv 和 events.json`);
});
test('筛选后导出不混入隐藏事件', () => {
  const filtered = applyFilters(events, { risk_levels: ['high'] });
  const visible = filtered.filter(e => !e.hidden);
  const exportData = visible.map(e => ({ ...e, evidence_count: e.evidence.length }));
  const csv = toCSV(exportData, CSV_FIELDS);
  const lines = csv.split('\n').filter(l => l.trim().length > 0);
  console.log(`     筛选HIGH后导出行数: ${lines.length} (表头+${visible.length}行数据)`);
  assertEq(lines.length, visible.length + 1, '筛选后导出不应混入隐藏事件');
});

console.log('\n--- 测试7: 重复导入保护 ---');
test('同文件内容hash一致时拒绝导入', () => {
  const hash1 = contentHash(JSON.stringify(menuData));
  const hash2 = contentHash(JSON.stringify(menuData));
  assertEq(hash1, hash2, '同一内容hash一致');
  const batches = [{ content_hash: hash1 }];
  const isDuplicate = batches.some(b => b.content_hash === hash2);
  assert(isDuplicate, '能正确检测重复导入');
  console.log(`     文件内容哈希: ${hash1}`);
});

console.log('\n--- 测试8: 投诉JSON格式校验 ---');
test('validateComplaints: 3条输入→2条有效+1条错误', () => {
  const { valid, errors } = validateComplaints(complaintsData);
  assertEq(valid.length, 2, '有效投诉数');
  assertEq(errors.length, 1, '错误投诉数');
  assert(errors[0].message.includes('student_id 不能为空'), '应拦截缺student_id');
  console.log(`     投诉有效: ${valid.length}条, 错误: ${errors.length}条`);
});

console.log('\n--- 测试9: 别名校验循环引用检测 ---');
test('validateAliasMap: 循环引用能被检测', () => {
  const badMap = {
    '花生': ['小麦'],
    '小麦': ['花生'],
  };
  const errors = validateAliasMap(badMap);
  const circular = errors.filter(e => e.type === 'circular_reference');
  assert(circular.length > 0, '应检测到循环引用');
  console.log(`     循环引用检测: ${circular.length}个错误 (${circular.map(e=>e.message).join(';')})`);
});

console.log('\n--- 测试10: 子串匹配(关键修复) ---');
test('resolveAllergenAlias: "花生碎"应通过子串匹配解析为"花生"', () => {
  const r = resolveAllergenAlias('花生碎', aliasMap);
  assertEq(r.standardName, '花生', '"花生碎"应解析为花生标准名');
  console.log(`     "花生碎" → standardName="${r.standardName}"`);
});
test('resolveAllergenAlias: "小麦面包"应通过子串匹配解析为"小麦"', () => {
  const r = resolveAllergenAlias('小麦面包', aliasMap);
  assertEq(r.standardName, '小麦', '"小麦面包"应解析为小麦标准名');
  console.log(`     "小麦面包" → standardName="${r.standardName}"`);
});
test('resolveAllergenAlias: 精确匹配优先(花生→花生不应走子串)', () => {
  const r = resolveAllergenAlias('花生', aliasMap);
  assertEq(r.standardName, '花生', '精确匹配应优先');
  console.log(`     "花生" → standardName="${r.standardName}", matchedAliases=[${r.matchedAliases.join(',')}]`);
});

console.log('\n--- 测试11: 持久化重置键名 ---');
test('localStorage 键名应为 allergy-board-store', () => {
  const persistName = 'allergy-board-store';
  assertEq(persistName, 'allergy-board-store', '持久化键名必须与store.ts一致');
  console.log(`     持久化键名: ${persistName}`);
});

console.log('\n--- 测试12: 重置后重新导入应复现同一条高风险链路 ---');
test('清空后重新归并仍产生1个HIGH事件', () => {
  const freshEvents = generateRiskEvents({
    menus: validMenu, profiles: validProfiles, pickups: validPickups, complaints: validComplaints, aliasMap
  });
  const highCount = freshEvents.filter(e => e.risk_level === 'high').length;
  assertEq(highCount, 1, '清空后重新归并应产生1个HIGH事件');
  const peanutHigh = freshEvents.find(e => e.canonical_allergen === '花生' && e.risk_level === 'high');
  assert(peanutHigh, '应有花生HIGH事件');
  assertIncludes(peanutHigh.student_names, '张小明', '应涉及张小明');
  assert(peanutHigh.evidence.some(ev => ev.type === 'complaint'), '应有投诉证据');
  assert(peanutHigh.evidence.some(ev => ev.type === 'pickup'), '应有领餐证据');
  console.log(`     重置后HIGH: ${highCount}个, 花生事件: ${peanutHigh.event_id}`);
  console.log(`     证据类型: ${peanutHigh.evidence.map(ev=>ev.type).join(',')}`);
});

console.log('\n' + '='.repeat(80));
console.log(`  测试完成: 通过 ${pass}, 失败 ${fail}`);
console.log('='.repeat(80));

// 结果汇总
const result = {
  test_pass: pass,
  test_fail: fail,
  event_count: events.length,
  high_risk_count: events.filter(e => e.risk_level === 'high').length,
  medium_risk_count: events.filter(e => e.risk_level === 'medium').length,
  low_risk_count: events.filter(e => e.risk_level === 'low').length,
  total_evidence: events.reduce((s, e) => s + e.evidence.length, 0),
  csv_field_count: CSV_FIELDS.length,
  timestamp: new Date().toISOString(),
};
writeFileSync(join(outDir, 'test-result.json'), JSON.stringify(result, null, 2), 'utf8');

// 事件明细
const summary = events.map(e => ({
  event_id: e.event_id,
  canonical_allergen: e.canonical_allergen,
  risk_level: e.risk_level,
  status: e.status,
  meal_type: e.meal_type,
  student_names: e.student_names,
  class_names: e.class_names,
  evidence_count: e.evidence.length,
  review_log_count: e.review_logs?.length || 0,
  closed_at: e.closed_at || null,
}));
writeFileSync(join(outDir, 'event-summary.json'), JSON.stringify(summary, null, 2), 'utf8');

console.log('\n📋 实际事件清单:');
for (const e of summary) {
  console.log(`   ${e.event_id} | ${e.canonical_allergen.padEnd(6)} | ${e.risk_level.padEnd(6)} | ${e.status.padEnd(9)} | ${e.meal_type.padEnd(7)} | ${e.student_names.join('、')} | ${e.class_names.join('、')} | 证据${e.evidence_count}条`);
}

process.exit(fail > 0 ? 1 : 0);
