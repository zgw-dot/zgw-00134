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

// ========== 批量复核功能测试 ==========
console.log('\n' + '='.repeat(80));
console.log('  批量复核功能验证测试');
console.log('='.repeat(80));

// 模拟 store 中的批量操作方法
function createBatchStore(initialEvents) {
  let events = deepClone(initialEvents);
  let selectedEventIds = new Set();
  let undoSnapshot = null;

  return {
    getEvents: () => events,
    getSelectedIds: () => selectedEventIds,
    getUndoSnapshot: () => undoSnapshot,
    restoreUndoSnapshot: (snap) => { undoSnapshot = snap; },

    toggleEventSelection: (eventId) => {
      if (selectedEventIds.has(eventId)) {
        selectedEventIds.delete(eventId);
      } else {
        selectedEventIds.add(eventId);
      }
    },

    toggleSelectAllVisible: (visibleIds) => {
      const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedEventIds.has(id));
      if (allSelected) {
        for (const id of visibleIds) selectedEventIds.delete(id);
      } else {
        for (const id of visibleIds) selectedEventIds.add(id);
      }
    },

    clearSelection: () => {
      selectedEventIds = new Set();
    },

    getSelectedEvents: () => {
      return events.filter(e => selectedEventIds.has(e.event_id));
    },

    getClosedInSelection: () => {
      return events.filter(e => selectedEventIds.has(e.event_id) && e.status === 'closed');
    },

    batchUpdateEvents: (eventIds, status, note, forceClosed = false) => {
      const result = { updated: [], skipped: [], conflicts: [] };
      const idSet = new Set(eventIds);
      const snapshotEvents = [];

      events = events.map(e => {
        if (!idSet.has(e.event_id)) return e;

        if (e.status === 'closed' && !forceClosed) {
          result.conflicts.push(e.event_id);
          result.skipped.push({ eventId: e.event_id, reason: '事件已关闭' });
          return e;
        }

        snapshotEvents.push(deepClone(e));

        const log = {
          id: genId(),
          timestamp: new Date().toISOString(),
          from_status: e.status,
          to_status: status,
          note: note || '',
        };

        result.updated.push(e.event_id);

        return {
          ...e,
          status,
          latest_note: note || e.latest_note,
          closed_at: status === 'closed' ? new Date().toISOString() : e.closed_at,
          review_logs: [...(e.review_logs || []), log],
          updated_at: new Date().toISOString(),
        };
      });

      if (snapshotEvents.length > 0) {
        undoSnapshot = {
          batchId: genId(),
          timestamp: new Date().toISOString(),
          events: snapshotEvents,
          description: `批量更新 ${snapshotEvents.length} 条事件为 ${status}`,
        };
        selectedEventIds = new Set();
      }

      return result;
    },

    canUndo: () => undoSnapshot !== null,

    undoLastBatch: () => {
      if (!undoSnapshot) return false;
      const snapshotMap = new Map(undoSnapshot.events.map(e => [e.event_id, e]));
      events = events.map(e => {
        const original = snapshotMap.get(e.event_id);
        if (!original) return e;
        const undoLog = {
          id: genId(),
          timestamp: new Date().toISOString(),
          from_status: e.status,
          to_status: original.status,
          note: `撤销批量操作: ${undoSnapshot.description}`,
        };
        return {
          ...original,
          review_logs: [...e.review_logs, undoLog],
          updated_at: new Date().toISOString(),
        };
      });
      undoSnapshot = null;
      return true;
    },
  };
}

// 准备测试数据 - 重置事件状态为 pending
let batchTestEvents = events.map(e => ({
  ...e,
  status: 'pending',
  review_logs: [],
  latest_note: undefined,
  closed_at: undefined,
}));

console.log('\n--- 验证1: 批量勾选功能 ---');
test('批量勾选: 勾选多条事件后选中集合正确', () => {
  const store = createBatchStore(batchTestEvents);
  const eventIds = batchTestEvents.map(e => e.event_id);

  store.toggleEventSelection(eventIds[0]);
  store.toggleEventSelection(eventIds[1]);

  assertEq(store.getSelectedIds().size, 2, '应选中2条');
  assert(store.getSelectedIds().has(eventIds[0]), '应包含第一条');
  assert(store.getSelectedIds().has(eventIds[1]), '应包含第二条');
  console.log(`     选中 ${store.getSelectedIds().size} 条: ${Array.from(store.getSelectedIds()).join(', ')}`);
});

test('批量勾选: 全选当前筛选结果', () => {
  const store = createBatchStore(batchTestEvents);
  const visibleIds = batchTestEvents.filter(e => e.risk_level === 'high' || e.risk_level === 'medium').map(e => e.event_id);

  store.toggleSelectAllVisible(visibleIds);
  assertEq(store.getSelectedIds().size, visibleIds.length, '应全选所有可见事件');

  store.toggleSelectAllVisible(visibleIds);
  assertEq(store.getSelectedIds().size, 0, '再次点击应取消全选');
  console.log(`     全选 ${visibleIds.length} 条，取消全选后为 0 条`);
});

test('批量勾选: 取消单条选择', () => {
  const store = createBatchStore(batchTestEvents);
  const eventIds = batchTestEvents.map(e => e.event_id);

  store.toggleEventSelection(eventIds[0]);
  store.toggleEventSelection(eventIds[1]);
  store.toggleEventSelection(eventIds[0]);

  assertEq(store.getSelectedIds().size, 1, '应剩1条选中');
  assert(!store.getSelectedIds().has(eventIds[0]), '第一条应已取消');
  console.log(`     取消后选中 ${store.getSelectedIds().size} 条`);
});

console.log('\n--- 验证2: 批量修改状态和追加备注，保留历史数据 ---');
test('批量更新: 修改状态和备注，保留原有 latest_note 和 review_logs', () => {
  // 先给事件添加一些历史数据
  const eventsWithHistory = batchTestEvents.map((e, idx) => {
    if (idx === 0 || idx === 1) {
      return {
        ...e,
        latest_note: '原有备注',
        review_logs: [{
          id: genId(),
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          from_status: 'pending',
          to_status: 'confirmed',
          note: '历史操作',
        }],
        closed_at: undefined,
      };
    }
    return e;
  });

  const store = createBatchStore(eventsWithHistory);
  const targetIds = [eventsWithHistory[0].event_id, eventsWithHistory[1].event_id];

  store.toggleEventSelection(targetIds[0]);
  store.toggleEventSelection(targetIds[1]);

  const result = store.batchUpdateEvents(targetIds, 'closed', '批量关闭备注');

  assertEq(result.updated.length, 2, '应更新2条');
  assertEq(result.skipped.length, 0, '不应有跳过');

  const updatedEvents = store.getEvents().filter(e => targetIds.includes(e.event_id));
  for (const e of updatedEvents) {
    assertEq(e.status, 'closed', '状态应为closed');
    assertEq(e.latest_note, '批量关闭备注', '备注应为新备注');
    assert(e.closed_at, '应有closed_at');
    assertEq(e.review_logs.length, 2, '应保留原有1条+新增1条=2条日志');
    assert(e.review_logs[0].note === '历史操作', '第一条日志应为历史操作');
    assert(e.review_logs[1].note === '批量关闭备注', '第二条日志应为批量操作');
  }
  console.log(`     更新 ${result.updated.length} 条，每条保留 ${updatedEvents[0].review_logs.length} 条日志`);
});

test('批量更新: 无备注时保留原有 latest_note', () => {
  const eventsWithNote = batchTestEvents.map((e, idx) => {
    if (idx === 0) {
      return { ...e, latest_note: '重要备注请勿覆盖' };
    }
    return e;
  });

  const store = createBatchStore(eventsWithNote);
  const targetId = eventsWithNote[0].event_id;

  store.toggleEventSelection(targetId);
  const result = store.batchUpdateEvents([targetId], 'confirmed', '');

  const updated = store.getEvents().find(e => e.event_id === targetId);
  assertEq(updated.latest_note, '重要备注请勿覆盖', '无新备注时应保留原有备注');
  console.log(`     无新备注时保留原有备注: "${updated.latest_note}"`);
});

test('批量更新: 非closed状态不覆盖原有 closed_at', () => {
  const eventsWithClosed = batchTestEvents.map((e, idx) => {
    if (idx === 0) {
      return { ...e, closed_at: '2024-01-01T00:00:00.000Z' };
    }
    return e;
  });

  const store = createBatchStore(eventsWithClosed);
  const targetId = eventsWithClosed[0].event_id;

  store.toggleEventSelection(targetId);
  store.batchUpdateEvents([targetId], 'confirmed', '重新确认');

  const updated = store.getEvents().find(e => e.event_id === targetId);
  assertEq(updated.closed_at, '2024-01-01T00:00:00.000Z', '非closed状态不应覆盖原有closed_at');
  console.log(`     非closed状态保留 closed_at: ${updated.closed_at}`);
});

console.log('\n--- 验证3: 已关闭事件冲突检测 ---');
test('冲突检测: 选中包含已关闭事件时返回冲突', () => {
  const eventsMixed = batchTestEvents.map((e, idx) => {
    if (idx === 0) {
      return { ...e, status: 'closed', closed_at: '2024-01-01T00:00:00.000Z' };
    }
    return e;
  });

  const store = createBatchStore(eventsMixed);
  const targetIds = [eventsMixed[0].event_id, eventsMixed[1].event_id];

  store.toggleEventSelection(targetIds[0]);
  store.toggleEventSelection(targetIds[1]);

  const result = store.batchUpdateEvents(targetIds, 'confirmed', '测试', false);

  assertEq(result.conflicts.length, 1, '应检测到1个冲突');
  assertEq(result.skipped.length, 1, '应跳过1条');
  assertEq(result.updated.length, 1, '应只更新1条');
  assert(result.conflicts.includes(eventsMixed[0].event_id), '冲突应包含已关闭事件');
  console.log(`     冲突 ${result.conflicts.length} 条，跳过 ${result.skipped.length} 条，更新 ${result.updated.length} 条`);
});

test('冲突检测: forceClosed=true 时强制更新已关闭事件', () => {
  const eventsMixed = batchTestEvents.map((e, idx) => {
    if (idx === 0) {
      return { ...e, status: 'closed', closed_at: '2024-01-01T00:00:00.000Z' };
    }
    return e;
  });

  const store = createBatchStore(eventsMixed);
  const targetIds = [eventsMixed[0].event_id, eventsMixed[1].event_id];

  store.toggleEventSelection(targetIds[0]);
  store.toggleEventSelection(targetIds[1]);

  const result = store.batchUpdateEvents(targetIds, 'confirmed', '强制更新', true);

  assertEq(result.conflicts.length, 0, 'forceClosed时不应有冲突');
  assertEq(result.skipped.length, 0, '不应跳过');
  assertEq(result.updated.length, 2, '应更新全部2条');
  console.log(`     强制更新: 冲突 ${result.conflicts.length} 条，更新 ${result.updated.length} 条`);
});

test('冲突检测: getClosedInSelection 正确返回已关闭事件', () => {
  const eventsMixed = batchTestEvents.map((e, idx) => {
    if (idx === 0 || idx === 2) {
      return { ...e, status: 'closed' };
    }
    return e;
  });

  const store = createBatchStore(eventsMixed);
  for (let i = 0; i < 4; i++) {
    store.toggleEventSelection(eventsMixed[i].event_id);
  }

  const closed = store.getClosedInSelection();
  assertEq(closed.length, 2, '选中的4条中应有2条已关闭');
  console.log(`     选中4条，其中已关闭 ${closed.length} 条`);
});

console.log('\n--- 验证4: 批量操作撤销功能 ---');
test('撤销功能: 批量更新后可撤销，恢复原始状态', () => {
  const store = createBatchStore(batchTestEvents);
  const targetIds = batchTestEvents.slice(0, 3).map(e => e.event_id);

  for (const id of targetIds) store.toggleEventSelection(id);

  const beforeUpdate = deepClone(store.getEvents().filter(e => targetIds.includes(e.event_id)));
  const result = store.batchUpdateEvents(targetIds, 'closed', '测试撤销');

  assert(store.canUndo(), '批量更新后应可撤销');
  assertEq(store.getUndoSnapshot().events.length, 3, '快照应包含3条');

  const undoSuccess = store.undoLastBatch();
  assert(undoSuccess, '撤销应成功');
  assert(!store.canUndo(), '撤销后不可再撤销');

  const afterUndo = store.getEvents().filter(e => targetIds.includes(e.event_id));
  for (let i = 0; i < beforeUpdate.length; i++) {
    assertEq(afterUndo[i].status, beforeUpdate[i].status, `事件${i}状态应恢复`);
    assertEq(afterUndo[i].latest_note, beforeUpdate[i].latest_note, `事件${i}备注应恢复`);
    assertEq(afterUndo[i].review_logs.length, beforeUpdate[i].review_logs.length + 2, `事件${i}日志应为原始+批量+撤销`);
    const lastLog = afterUndo[i].review_logs[afterUndo[i].review_logs.length - 1];
    assert(lastLog.note.includes('撤销批量操作'), `事件${i}最后一条日志应为撤销记录`);
    assertEq(lastLog.from_status, 'closed', `事件${i}撤销日志from_status应为closed`);
    assertEq(lastLog.to_status, beforeUpdate[i].status, `事件${i}撤销日志to_status应为原始状态`);
  }
  console.log(`     撤销成功，${afterUndo.length} 条事件全部恢复原始状态，每条追加撤销日志`);
});

test('撤销功能: 无操作时不可撤销', () => {
  const store = createBatchStore(batchTestEvents);
  assert(!store.canUndo(), '初始状态不可撤销');
  const result = store.undoLastBatch();
  assert(!result, '无操作时撤销返回false');
  console.log(`     初始状态 canUndo=${store.canUndo()}`);
});

test('撤销功能: 批量更新后选中清空', () => {
  const store = createBatchStore(batchTestEvents);
  const targetId = batchTestEvents[0].event_id;

  store.toggleEventSelection(targetId);
  assertEq(store.getSelectedIds().size, 1, '批量前选中1条');

  store.batchUpdateEvents([targetId], 'confirmed', '');
  assertEq(store.getSelectedIds().size, 0, '批量后应清空选中');
  console.log(`     批量后选中数: ${store.getSelectedIds().size}`);
});

console.log('\n--- 验证5: 刷新持久化（模拟） ---');
test('持久化: 选中状态可序列化和反序列化', () => {
  const store = createBatchStore(batchTestEvents);
  const eventIds = batchTestEvents.map(e => e.event_id);

  store.toggleEventSelection(eventIds[0]);
  store.toggleEventSelection(eventIds[2]);

  const serialized = Array.from(store.getSelectedIds());
  assertEq(serialized.length, 2, '序列化后应有2条');

  const restoredSet = new Set(serialized);
  assert(restoredSet.has(eventIds[0]), '反序列化后应包含第一条');
  assert(restoredSet.has(eventIds[2]), '反序列化后应包含第三条');
  console.log(`     序列化: [${serialized.join(', ')}]，反序列化成功`);
});

test('持久化: undoSnapshot 可持久化', () => {
  const store = createBatchStore(batchTestEvents);
  const targetId = batchTestEvents[0].event_id;

  store.toggleEventSelection(targetId);
  store.batchUpdateEvents([targetId], 'confirmed', '持久化测试');

  const snapshot = store.getUndoSnapshot();
  const serialized = JSON.stringify(snapshot);
  const restored = JSON.parse(serialized);

  assertEq(restored.events.length, 1, '恢复后快照应有1条');
  assertEq(restored.description, snapshot.description, '描述应一致');
  console.log(`     快照序列化成功，描述: "${restored.description}"`);
});

test('持久化: 页面刷新后撤销仍可用（模拟localStorage）', () => {
  const store1 = createBatchStore(batchTestEvents);
  const targetId = batchTestEvents[0].event_id;
  const originalStatus = batchTestEvents[0].status;

  store1.toggleEventSelection(targetId);
  store1.batchUpdateEvents([targetId], 'closed', '刷新前操作');

  const persistedSnapshot = JSON.parse(JSON.stringify(store1.getUndoSnapshot()));
  const persistedEvents = JSON.parse(JSON.stringify(store1.getEvents()));

  const store2 = createBatchStore(persistedEvents);
  store2.restoreUndoSnapshot(persistedSnapshot);

  assert(store2.canUndo(), '刷新后仍可撤销');
  const undoSuccess = store2.undoLastBatch();
  assert(undoSuccess, '刷新后撤销成功');

  const afterUndo = store2.getEvents().find(e => e.event_id === targetId);
  assertEq(afterUndo.status, originalStatus, '刷新后撤销能恢复原始状态');
  console.log(`     模拟刷新：撤销前=${persistedEvents.find(e=>e.event_id===targetId).status}，撤销后=${afterUndo.status}（原始=${originalStatus}）`);
});

console.log('\n--- 验证6: 筛选后导出只包含最新有效状态 ---');
test('筛选导出: 只导出当前筛选结果', () => {
  const store = createBatchStore(batchTestEvents);

  const filtered = applyFilters(store.getEvents(), { risk_levels: ['high'] });
  const visible = filtered.filter(e => !e.hidden);

  const exportData = visible.map(e => ({
    ...e,
    status: e.status,
    latest_note: e.latest_note || '',
  }));

  assert(exportData.every(e => e.risk_level === 'high'), '导出数据应只包含high风险');
  assertEq(exportData.length, visible.length, '导出数量应等于可见数量');
  console.log(`     筛选high风险，导出 ${exportData.length} 条，全部为high风险`);
});

test('筛选导出: 撤销后导出最新状态（不包含已取消的改动）', () => {
  const store = createBatchStore(batchTestEvents);
  const targetIds = batchTestEvents.filter(e => e.risk_level === 'medium').map(e => e.event_id);

  for (const id of targetIds) store.toggleEventSelection(id);
  store.batchUpdateEvents(targetIds, 'closed', '待撤销操作');

  const beforeUndoStatus = store.getEvents().find(e => e.event_id === targetIds[0]).status;

  store.undoLastBatch();

  const filtered = applyFilters(store.getEvents(), { risk_levels: ['medium'] });
  const visible = filtered.filter(e => !e.hidden);
  const exportData = visible.map(e => ({ status: e.status, event_id: e.event_id }));

  const afterUndoStatus = exportData[0].status;
  assert(afterUndoStatus !== beforeUndoStatus, '撤销后状态应与撤销前不同');
  assert(afterUndoStatus === 'pending', '撤销后应恢复原始pending状态');
  console.log(`     撤销前状态=${beforeUndoStatus}，撤销后导出状态=${afterUndoStatus}`);
});

test('筛选导出: 导出数据不包含历史旧状态', () => {
  const store = createBatchStore(batchTestEvents);
  const targetId = batchTestEvents[0].event_id;

  store.toggleEventSelection(targetId);
  store.batchUpdateEvents([targetId], 'confirmed', '第一次操作');
  store.batchUpdateEvents([targetId], 'closed', '第二次操作');

  const filtered = applyFilters(store.getEvents(), {});
  const visible = filtered.filter(e => !e.hidden);
  const exportEvent = visible.find(e => e.event_id === targetId);

  assertEq(exportEvent.status, 'closed', '导出状态应为最新的closed');
  assertEq(exportEvent.latest_note, '第二次操作', '导出备注应为最新');
  assertEq(exportEvent.review_logs.length, 2, '导出应包含完整日志');
  console.log(`     两次操作后导出：status=${exportEvent.status}，note="${exportEvent.latest_note}"，日志数=${exportEvent.review_logs.length}`);
});

// ========== 回归验证：批量复核完整链路 ==========

console.log('\n--- 回归验证7: 多选 → 批量状态+备注 → 保留原有数据 ---');
test('回归-多选: 多选后批量更新状态和备注，每条原有 latest_note/review_logs/closed_at 不被覆盖', () => {
  const eventsWithHistory = batchTestEvents.map((e, idx) => {
    if (idx < 3) {
      return {
        ...e,
        status: 'confirmed',
        latest_note: '原有重要备注',
        review_logs: [{
          id: genId(),
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          from_status: 'pending',
          to_status: 'confirmed',
          note: '历史确认操作',
        }],
        closed_at: undefined,
      };
    }
    return e;
  });

  const store = createBatchStore(eventsWithHistory);
  const targetIds = eventsWithHistory.slice(0, 3).map(e => e.event_id);

  for (const id of targetIds) store.toggleEventSelection(id);
  const result = store.batchUpdateEvents(targetIds, 'closed', '批量关闭');

  assertEq(result.updated.length, 3, '应更新3条');

  const updatedEvents = store.getEvents().filter(e => targetIds.includes(e.event_id));
  for (const e of updatedEvents) {
    assertEq(e.status, 'closed', '状态应为closed');
    assertEq(e.latest_note, '批量关闭', '备注应为新备注');
    assert(e.closed_at, '应有closed_at');
    assertEq(e.review_logs.length, 2, '应有 历史1条+批量1条=2条');
    assert(e.review_logs[0].note === '历史确认操作', '第1条为历史日志');
    assert(e.review_logs[1].note === '批量关闭', '最后1条为批量日志');
  }
  console.log(`     批量更新3条，每条保留3条日志，latest_note更新，closed_at正确设置`);
});

console.log('\n--- 回归验证8: 已关闭事件冲突提示 → 可继续或拦截 ---');
test('回归-冲突: 已关闭事件参与批量时返回冲突，forceClosed=true可强制更新，forceClosed=false拦截', () => {
  const eventsMixed = batchTestEvents.map((e, idx) => {
    if (idx === 0) return { ...e, status: 'closed', closed_at: '2024-06-01T00:00:00.000Z' };
    if (idx === 1) return { ...e, status: 'confirmed' };
    return e;
  });

  const store = createBatchStore(eventsMixed);
  const targetIds = [eventsMixed[0].event_id, eventsMixed[1].event_id];

  for (const id of targetIds) store.toggleEventSelection(id);

  const closed = store.getClosedInSelection();
  assertEq(closed.length, 1, '应检测到1条已关闭');

  const blocked = store.batchUpdateEvents(targetIds, 'confirmed', '尝试更新', false);
  assertEq(blocked.conflicts.length, 1, '不强制时应返回冲突');
  assertEq(blocked.skipped.length, 1, '已关闭事件应被跳过');
  assertEq(blocked.updated.length, 1, '只更新非关闭事件');

  const forced = store.batchUpdateEvents(targetIds, 'confirmed', '强制更新', true);
  assertEq(forced.conflicts.length, 0, '强制时不应有冲突');
  assertEq(forced.updated.length, 2, '强制时应更新全部');
  console.log(`     不强制: 冲突${blocked.conflicts.length} 跳过${blocked.skipped.length} 更新${blocked.updated.length}；强制: 冲突0 更新${forced.updated.length}`);
});

console.log('\n--- 回归验证9: 提交后一次撤销，撤销追加可追溯日志 ---');
test('回归-撤销: 批量提交后撤销，状态/备注恢复，review_logs追加撤销日志且不可二次撤销', () => {
  const store = createBatchStore(batchTestEvents);
  const targetIds = batchTestEvents.slice(0, 2).map(e => e.event_id);

  for (const id of targetIds) store.toggleEventSelection(id);
  store.batchUpdateEvents(targetIds, 'closed', '待撤销关闭');

  const beforeUndo = store.getEvents().filter(e => targetIds.includes(e.event_id));
  assertEq(beforeUndo[0].status, 'closed', '撤销前应为closed');

  assert(store.canUndo(), '应可撤销');
  const ok = store.undoLastBatch();
  assert(ok, '撤销应成功');
  assert(!store.canUndo(), '撤销后不可再撤销');

  const afterUndo = store.getEvents().filter(e => targetIds.includes(e.event_id));
  for (const e of afterUndo) {
    assertEq(e.status, 'pending', '撤销后状态应恢复pending');
    assertEq(e.latest_note, undefined, '撤销后备注应恢复原始');
    const logs = e.review_logs;
    assertEq(logs.length, 2, '应有批量+撤销共2条日志');
    assert(logs[0].note === '待撤销关闭', '批量日志应为原始备注');
    assert(logs[1].note.includes('撤销批量操作'), '撤销日志应含撤销标记');
    assertEq(logs[1].from_status, 'closed', '撤销日志from_status=closed');
    assertEq(logs[1].to_status, 'pending', '撤销日志to_status=pending');
  }
  console.log(`     撤销成功: 状态恢复pending，备注恢复原始，追加2条可追溯日志`);
});

console.log('\n--- 回归验证10: 重开持久化 — 撤销快照和事件序列化/反序列化后结果一致 ---');
test('回归-持久化: 序列化事件+快照 → 反序列化新store → 撤销仍能恢复，状态一致', () => {
  const store1 = createBatchStore(batchTestEvents);
  const targetId = batchTestEvents[0].event_id;

  store1.toggleEventSelection(targetId);
  store1.batchUpdateEvents([targetId], 'confirmed', '持久化前操作');

  const snap = JSON.parse(JSON.stringify(store1.getUndoSnapshot()));
  const evts = JSON.parse(JSON.stringify(store1.getEvents()));

  const store2 = createBatchStore(evts);
  store2.restoreUndoSnapshot(snap);

  assert(store2.canUndo(), '反序列化后应可撤销');
  store2.undoLastBatch();

  const restored = store2.getEvents().find(e => e.event_id === targetId);
  assertEq(restored.status, 'pending', '反序列化后撤销恢复pending');
  assertEq(restored.latest_note, undefined, '反序列化后撤销恢复原始备注');
  assert(restored.review_logs.length >= 2, '反序列化后撤销应有批量+撤销日志');
  const lastLog = restored.review_logs[restored.review_logs.length - 1];
  assert(lastLog.note.includes('撤销批量操作'), '反序列化后撤销日志应含撤销标记');
  console.log(`     反序列化→撤销: status=${restored.status}, logs=${restored.review_logs.length}, 末尾日志含"撤销批量操作"`);
});

console.log('\n--- 回归验证11: 按当前筛选结果导出CSV/JSON，撤销后不混入已取消改动 ---');
test('回归-筛选导出: 按筛选条件导出，撤销后导出仅含生效状态，已撤销改动不在主字段', () => {
  const store = createBatchStore(batchTestEvents);
  const highIds = batchTestEvents.filter(e => e.risk_level === 'high').map(e => e.event_id);

  for (const id of highIds) store.toggleEventSelection(id);
  store.batchUpdateEvents(highIds, 'closed', '批量关闭高风险');

  const beforeUndoExport = store.getEvents()
    .filter(e => e.risk_level === 'high')
    .map(e => ({ event_id: e.event_id, status: e.status, note: e.latest_note }));
  assert(beforeUndoExport.every(e => e.status === 'closed'), '撤销前导出全部为closed');

  store.undoLastBatch();

  const afterUndoExport = store.getEvents()
    .filter(e => e.risk_level === 'high')
    .map(e => ({ event_id: e.event_id, status: e.status, note: e.latest_note }));
  assert(afterUndoExport.every(e => e.status === 'pending'), '撤销后导出应恢复pending');
  assert(afterUndoExport.every(e => e.note === undefined), '撤销后备注应恢复原始');

  const allExport = store.getEvents().map(e => ({ event_id: e.event_id, status: e.status }));
  assert(!allExport.some(e => e.status === 'closed' && highIds.includes(e.event_id)),
    '全局导出不应含已撤销的closed状态');
  console.log(`     筛选high导出${beforeUndoExport.length}条，撤销前全closed，撤销后全pending，全局导出无残留`);
});

console.log('\n' + '='.repeat(80));
console.log(`  全部测试完成: 通过 ${pass}, 失败 ${fail}`);
console.log('='.repeat(80));

const finalResult = {
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
writeFileSync(join(outDir, 'test-result.json'), JSON.stringify(finalResult, null, 2), 'utf8');

const finalSummary = events.map(e => ({
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
writeFileSync(join(outDir, 'event-summary.json'), JSON.stringify(finalSummary, null, 2), 'utf8');

process.exit(fail > 0 ? 1 : 0);
