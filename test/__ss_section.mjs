
// ========== SnapshotSource 身份一致性回归测试 ==========
console.log('\n' + '='.repeat(80));
console.log('  SnapshotSource 身份一致性回归测试');
console.log('='.repeat(80));

function makeEvent(overrides = {}) {
  return {
    event_id: genId('evt'),
    canonical_allergen: '花生',
    matched_aliases: ['花生碎'],
    meal_type: 'lunch',
    time_window_start: new Date().toISOString(),
    time_window_end: new Date().toISOString(),
    student_ids: ['stu_001'],
    student_names: ['张小明'],
    class_names: ['三年级(1)班'],
    risk_level: 'high',
    status: 'pending',
    evidence: [{ type: 'pickup', source_id: 'p1', source_data: {}, imported_at: new Date().toISOString() }],
    review_logs: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeSnapshot(name, eventList, sourceOverrides = {}) {
  return {
    snapshot_id: genId('snap'),
    name,
    created_at: new Date().toISOString(),
    filters: { classes: [], meal_types: [], risk_levels: [], statuses: [], search_text: '' },
    events: eventList,
    risk_stats: { high: 0, medium: 0, low: 0 },
    import_batches: [],
    source: { original_name: name, current_name: name, branch_source: 'seal', is_original: true, ...sourceOverrides },
  };
}

function makeConclusion(eventId, snapshotId, snapshotName, sourceOverrides = {}) {
  const evt = makeEvent({ event_id: eventId });
  return {
    conclusion_id: genId('conc'),
    event_id: eventId,
    snapshot_id: snapshotId,
    snapshot_name: snapshotName,
    sealed_at: new Date().toISOString(),
    filters_at_seal: { classes: [], meal_types: [], risk_levels: [], statuses: [], search_text: '' },
    risk_level: 'high',
    status: 'pending',
    latest_note: '',
    evidence_summary: { total_evidence: 1, evidence_types: ['pickup'], student_count: 1, canonical_allergen: '花生', matched_aliases: ['花生碎'] },
    event_snapshot: evt,
    source: { original_name: snapshotName, current_name: snapshotName, branch_source: 'seal', is_original: true, ...sourceOverrides },
  };
}

function createSourceStore() {
  let snapshots = [];
  let sealedConclusions = [];
  let provenanceRecords = [];

  function createProvenanceRecord(entityType, entityId, name, method, eventCount, parentId) {
    const record = {
      provenance_id: genId('prov'),
      entity_type: entityType,
      entity_id: entityId,
      original_name: name,
      current_name: name,
      generation_method: method,
      event_count: eventCount,
      conflict_decisions: [],
      parent_provenance_id: parentId || undefined,
      root_provenance_id: parentId
        ? (provenanceRecords.find(r => r.provenance_id === parentId)?.root_provenance_id || parentId)
        : undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_original: method === 'seal' && !parentId,
      branch_depth: parentId
        ? (provenanceRecords.find(r => r.provenance_id === parentId)?.branch_depth || 0) + 1
        : 0,
      identity_signature: `${entityType}:${name}:${eventCount}`,
    };
    if (!record.root_provenance_id) record.root_provenance_id = record.provenance_id;
    provenanceRecords.push(record);
    return record;
  }

  return {
    getSnapshots: () => snapshots,
    getConclusions: () => sealedConclusions,
    getProvenanceRecords: () => provenanceRecords,

    sealSnapshot: (name, eventList) => {
      const snap = makeSnapshot(name, eventList);
      const provenance = createProvenanceRecord('snapshot', snap.snapshot_id, name, 'seal', eventList.length);
      const conclusions = eventList.map(e => {
        const conc = makeConclusion(e.event_id, snap.snapshot_id, name);
        createProvenanceRecord('conclusion', conc.conclusion_id, `${name} - ${e.event_id.slice(0, 8)}`, 'seal', 1);
        return conc;
      });
      snapshots.push(snap);
      sealedConclusions.push(...conclusions);
      return { snapshot: snap, conclusions, provenance };
    },

    branchProvenance: (provenanceId, newName) => {
      const source = provenanceRecords.find(r => r.provenance_id === provenanceId);
      if (!source) return null;
      if (source.entity_type === 'snapshot') {
        const sourceSnap = snapshots.find(s => s.snapshot_id === source.entity_id);
        if (!sourceSnap) return null;
        const newSnapId = genId('snap');
        const originalName = sourceSnap.source?.original_name || sourceSnap.name;
        const newSnap = {
          ...deepClone(sourceSnap),
          snapshot_id: newSnapId,
          name: newName,
          source: { original_name: originalName, current_name: newName, branch_source: 'branch', import_decision: 'branch', is_original: false, parent_snapshot_provenance_id: provenanceId },
        };
        snapshots.push(newSnap);
        const sourceConclusions = sealedConclusions.filter(c => c.snapshot_id === source.entity_id);
        const newConclusions = sourceConclusions.map(c => ({
          ...deepClone(c),
          conclusion_id: genId('conc'),
          snapshot_id: newSnapId,
          snapshot_name: newName,
          sealed_at: new Date().toISOString(),
          source: { original_name: c.source?.original_name || sourceSnap.name, current_name: newName, branch_source: 'branch', import_decision: 'branch', is_original: false, parent_snapshot_provenance_id: provenanceId },
        }));
        sealedConclusions.push(...newConclusions);
        const newProv = createProvenanceRecord('snapshot', newSnapId, newName, 'branch', source.event_count, provenanceId);
        return { snapshot: newSnap, newConclusions, provenance: newProv };
      }
      return null;
    },

    importSnapshot: (incoming, resolution) => {
      if (resolution === 'overwrite') {
        const filtered = snapshots.filter(s => s.name !== incoming.name);
        const toAdd = {
          ...deepClone(incoming),
          source: { ...(incoming.source || {}), current_name: incoming.name, branch_source: 'import_overwrite', import_decision: 'overwrite', is_original: false },
        };
        snapshots = [...filtered, toAdd];
        createProvenanceRecord('snapshot', toAdd.snapshot_id, toAdd.name, 'import_overwrite', toAdd.events.length);
        return { ok: true, snapshot: toAdd };
      }
      if (resolution === 'copy') {
        const baseName = incoming.name;
        const existingNames = new Set(snapshots.map(s => s.name));
        let finalName = baseName;
        let suffix = 1;
        while (existingNames.has(finalName)) {
          finalName = `${baseName} (${suffix})`;
          suffix++;
        }
        const copy = {
          ...deepClone(incoming),
          snapshot_id: genId('snap'),
          name: finalName,
          source: { original_name: incoming.source?.original_name || baseName, current_name: finalName, branch_source: 'import_copy', import_decision: 'copy', is_original: false },
        };
        snapshots.push(copy);
        createProvenanceRecord('snapshot', copy.snapshot_id, finalName, 'import_copy', copy.events.length);
        return { ok: true, snapshot: copy };
      }
      return { ok: false };
    },

    exportSnapshotsJson: (snapshotIds) => {
      const toExport = snapshotIds
        ? snapshots.filter(s => snapshotIds.includes(s.snapshot_id))
        : snapshots;
      return JSON.stringify({ _type: 'review-snapshot-package', _version: 1, exported_at: new Date().toISOString(), snapshots: toExport }, null, 2);
    },

    exportSealedConclusionsJson: (conclusionIds) => {
      const toExport = conclusionIds
        ? sealedConclusions.filter(c => conclusionIds.includes(c.conclusion_id))
        : sealedConclusions;
      const relatedSnapshotIds = new Set(toExport.map(c => c.snapshot_id));
      const relatedSnapshots = snapshots.filter(s => relatedSnapshotIds.has(s.snapshot_id));
      return JSON.stringify({ _type: 'sealed-conclusion-package', _version: 1, exported_at: new Date().toISOString(), conclusions: toExport, snapshots: relatedSnapshots }, null, 2);
    },
  };
}

const ssEvents = Array.from({ length: 12 }, (_, i) => makeEvent({
  event_id: `evt_src_${String(i).padStart(3, '0')}`,
  canonical_allergen: i < 4 ? '花生' : i < 8 ? '牛奶' : '小麦',
  risk_level: i < 4 ? 'high' : i < 8 ? 'medium' : 'low',
}));

console.log('\n--- 回归验证12: Seal创建source正确 ---');
test('SnapshotSource-seal: 封存快照时source应original_name=current_name=seal_name, branch_source=seal, is_original=true', () => {
  const store = createSourceStore();
  const sealName = '2024春季第一周';
  const { snapshot, conclusions } = store.sealSnapshot(sealName, ssEvents);
  assertEq(snapshot.source.original_name, sealName, 'seal source.original_name应=seal_name');
  assertEq(snapshot.source.current_name, sealName, 'seal source.current_name应=seal_name');
  assertEq(snapshot.source.branch_source, 'seal', 'seal source.branch_source应=seal');
  assertEq(snapshot.source.is_original, true, 'seal source.is_original应=true');
  assertEq(conclusions.length, 12, '应生成12条结论');
  for (const c of conclusions) {
    assertEq(c.source.original_name, sealName, `结论${c.conclusion_id.slice(0,12)} source.original_name应=seal_name`);
    assertEq(c.source.current_name, sealName, `结论${c.conclusion_id.slice(0,12)} source.current_name应=seal_name`);
    assertEq(c.source.branch_source, 'seal', `结论${c.conclusion_id.slice(0,12)} source.branch_source应=seal`);
    assertEq(c.source.is_original, true, `结论${c.conclusion_id.slice(0,12)} source.is_original应=true`);
  }
  console.log(`     封存"${sealName}"：snapshot.source正确，${conclusions.length}条结论source全部一致`);
});

console.log('\n--- 回归验证13: Branch所有结论共享同一source.current_name ---');
test('SnapshotSource-branch: 分支快照和所有结论应有source.current_name=branch_name, original_name=original, branch_source=branch, is_original=false', () => {
  const store = createSourceStore();
  const sealName = '2024春季第一周';
  const branchName = '2024春季第一周-复审';
  const { provenance } = store.sealSnapshot(sealName, ssEvents);
  const originalConclusions = store.getConclusions().slice();
  const branchResult = store.branchProvenance(provenance.provenance_id, branchName);
  assert(branchResult !== null, '分支应成功');
  const branchSnap = branchResult.snapshot;
  assertEq(branchSnap.source.current_name, branchName, 'branch snapshot source.current_name应=branch_name');
  assertEq(branchSnap.source.original_name, sealName, 'branch snapshot source.original_name应=original_name');
  assertEq(branchSnap.source.branch_source, 'branch', 'branch snapshot source.branch_source应=branch');
  assertEq(branchSnap.source.import_decision, 'branch', 'branch snapshot source.import_decision应=branch');
  assertEq(branchSnap.source.is_original, false, 'branch snapshot source.is_original应=false');
  const branchConclusions = branchResult.newConclusions;
  assertEq(branchConclusions.length, 12, '分支应产生12条结论');
  for (const c of branchConclusions) {
    assertEq(c.source.current_name, branchName, `分支结论${c.conclusion_id.slice(0,12)} source.current_name应=branch_name`);
    assertEq(c.source.original_name, sealName, `分支结论${c.conclusion_id.slice(0,12)} source.original_name应=original_name`);
    assertEq(c.source.branch_source, 'branch', `分支结论 source.branch_source应=branch`);
    assertEq(c.source.import_decision, 'branch', `分支结论 source.import_decision应=branch`);
    assertEq(c.source.is_original, false, `分支结论 source.is_original应=false`);
  }
  for (const oc of originalConclusions) {
    assertEq(oc.source.current_name, sealName, `原始结论 current_name应不变`);
    assertEq(oc.source.is_original, true, `原始结论 is_original应仍为true`);
  }
  console.log(`     分支"${branchName}"：snapshot+12条结论source一致，原始${originalConclusions.length}条结论不变`);
});

console.log('\n--- 回归验证14: Overwrite导入source获得import_overwrite ---');
test('SnapshotSource-overwrite: 覆盖导入时source应含branch_source=import_overwrite, import_decision=overwrite', () => {
  const store = createSourceStore();
  const sealName = '2024春季第一周';
  store.sealSnapshot(sealName, ssEvents);
  const incoming = makeSnapshot(sealName, ssEvents.slice(0, 6), {
    original_name: sealName, current_name: sealName, branch_source: 'seal', is_original: true,
  });
  const result = store.importSnapshot(incoming, 'overwrite');
  assert(result.ok, '覆盖导入应成功');
  const overwrittenSnap = store.getSnapshots().find(s => s.name === sealName);
  assert(overwrittenSnap, '应找到覆盖后的快照');
  assertEq(overwrittenSnap.source.branch_source, 'import_overwrite', 'overwrite source.branch_source应=import_overwrite');
  assertEq(overwrittenSnap.source.import_decision, 'overwrite', 'overwrite source.import_decision应=overwrite');
  assertEq(overwrittenSnap.source.is_original, false, 'overwrite source.is_original应=false');
  console.log(`     覆盖导入"${sealName}"：source.branch_source=import_overwrite, import_decision=overwrite, is_original=false`);
});

console.log('\n--- 回归验证15: Copy导入source追踪original_name和dedup current_name ---');
test('SnapshotSource-copy: 复制导入时source.original_name来自incoming, current_name为去重后名称', () => {
  const store = createSourceStore();
  const sealName = '2024春季第一周';
  store.sealSnapshot(sealName, ssEvents);
  const incoming = makeSnapshot(sealName, ssEvents.slice(0, 4), {
    original_name: sealName, current_name: sealName, branch_source: 'seal', is_original: true,
  });
  const result = store.importSnapshot(incoming, 'copy');
  assert(result.ok, '复制导入应成功');
  const copySnap = store.getSnapshots().find(s => s.name.includes(sealName) && s.name !== sealName);
  assert(copySnap, '应找到去重后的副本快照');
  assertEq(copySnap.source.original_name, sealName, 'copy source.original_name应=incoming name');
  assert(copySnap.source.current_name.includes(sealName), 'copy source.current_name应包含原始名称');
  assert(copySnap.source.current_name !== sealName, 'copy source.current_name应有去重后缀');
  assertEq(copySnap.source.branch_source, 'import_copy', 'copy source.branch_source应=import_copy');
  assertEq(copySnap.source.import_decision, 'copy', 'copy source.import_decision应=copy');
  assertEq(copySnap.source.is_original, false, 'copy source.is_original应=false');
  console.log(`     复制导入：original_name="${copySnap.source.original_name}", current_name="${copySnap.source.current_name}" (含去重后缀)`);
});

console.log('\n--- 回归验证16: 导出JSON包含source字段 ---');
test('SnapshotSource-export: 导出的snapshot/conclusion JSON应包含source对象', () => {
  const store = createSourceStore();
  const sealName = '2024春季第一周';
  const { snapshot, conclusions } = store.sealSnapshot(sealName, ssEvents);
  const snapJson = JSON.parse(store.exportSnapshotsJson([snapshot.snapshot_id]));
  assert(snapJson.snapshots.length > 0, '导出应包含快照');
  for (const s of snapJson.snapshots) {
    assert(s.source !== undefined, `导出快照"${s.name}"应含source字段`);
    assert(typeof s.source === 'object', 'source应为对象');
    assert('original_name' in s.source, 'source应有original_name');
    assert('current_name' in s.source, 'source应有current_name');
    assert('branch_source' in s.source, 'source应有branch_source');
    assert('is_original' in s.source, 'source应有is_original');
  }
  const concJson = JSON.parse(store.exportSealedConclusionsJson(conclusions.map(c => c.conclusion_id)));
  assert(concJson.conclusions.length > 0, '导出应包含结论');
  for (const c of concJson.conclusions) {
    assert(c.source !== undefined, `导出结论${c.conclusion_id.slice(0,12)}应含source字段`);
    assert(typeof c.source === 'object', '结论source应为对象');
    assert('original_name' in c.source, '结论source应有original_name');
    assert('current_name' in c.source, '结论source应有current_name');
  }
  console.log(`     导出${snapJson.snapshots.length}个快照+${concJson.conclusions.length}条结论，全部含source字段`);
});

console.log('\n--- 回归验证17: Branch后导出所有结论一致source身份 ---');
test('SnapshotSource-branch-export: 分支后导出的所有结论应有一致的source.current_name和source.original_name', () => {
  const store = createSourceStore();
  const sealName = '2024春季第一周';
  const branchName = '2024春季第一周-复审';
  const { provenance } = store.sealSnapshot(sealName, ssEvents);
  const branchResult = store.branchProvenance(provenance.provenance_id, branchName);
  const branchConcIds = branchResult.newConclusions.map(c => c.conclusion_id);
  const concJson = JSON.parse(store.exportSealedConclusionsJson(branchConcIds));
  const exportedConclusions = concJson.conclusions;
  const currentNames = new Set(exportedConclusions.map(c => c.source.current_name));
  const originalNames = new Set(exportedConclusions.map(c => c.source.original_name));
  assertEq(currentNames.size, 1, '所有导出结论source.current_name应唯一');
  assertEq(originalNames.size, 1, '所有导出结论source.original_name应唯一');
  assert(currentNames.has(branchName), 'current_name应为branch_name');
  assert(originalNames.has(sealName), 'original_name应为原始seal_name');
  console.log(`     分支导出${exportedConclusions.length}条结论，current_name一致="${[...currentNames][0]}", original_name一致="${[...originalNames][0]}"`);
});

console.log('\n--- 回归验证18: 原始与分支结论身份永不混淆 ---');
test('SnapshotSource-identity-isolation: 原始与分支结论ID不重叠, 原始is_original=true, 分支is_original=false', () => {
  const store = createSourceStore();
  const sealName = '2024春季第一周';
  const branchName = '2024春季第一周-复审';
  const { provenance } = store.sealSnapshot(sealName, ssEvents);
  const branchResult = store.branchProvenance(provenance.provenance_id, branchName);
  const originalConcIds = new Set(store.getConclusions().filter(c => c.source.is_original === true).map(c => c.conclusion_id));
  const branchConcIds = new Set(branchResult.newConclusions.map(c => c.conclusion_id));
  const overlap = [...originalConcIds].filter(id => branchConcIds.has(id));
  assertEq(overlap.length, 0, '原始与分支结论ID不应重叠');
  const allConclusions = store.getConclusions();
  const originalConcs = allConclusions.filter(c => c.source.is_original === true);
  const branchConcs = allConclusions.filter(c => c.source.is_original === false);
  assert(originalConcs.length > 0, '应有原始结论');
  assert(branchConcs.length > 0, '应有分支结论');
  assert(originalConcs.every(c => c.source.current_name === sealName), '原始结论current_name=seal_name');
  assert(branchConcs.every(c => c.source.current_name === branchName), '分支结论current_name=branch_name');
  console.log(`     原始${originalConcs.length}条(is_original=true), 分支${branchConcs.length}条(is_original=false), ID无重叠`);
});

console.log('\n--- 回归验证19: Rehydrate迁移-快照无source获得默认seal source ---');
test('SnapshotSource-rehydrate-snapshot: 无source的快照迁移后应获得branch_source=seal, is_original=true', () => {
  const oldSnap = makeSnapshot('2024旧数据', ssEvents.slice(0, 3));
  delete oldSnap.source;
  assert(oldSnap.source === undefined, '模拟旧数据应无source字段');
  const migrationSource = { original_name: oldSnap.name, current_name: oldSnap.name, branch_source: 'seal', is_original: true };
  oldSnap.source = migrationSource;
  assertEq(oldSnap.source.original_name, '2024旧数据', '迁移后original_name=快照名');
  assertEq(oldSnap.source.current_name, '2024旧数据', '迁移后current_name=快照名');
  assertEq(oldSnap.source.branch_source, 'seal', '迁移后branch_source=seal');
  assertEq(oldSnap.source.is_original, true, '迁移后is_original=true');
  console.log(`     迁移旧快照"${oldSnap.name}"：source补全为seal身份`);
});

console.log('\n--- 回归验证20: Rehydrate迁移-结论无source从provenance构建 ---');
test('SnapshotSource-rehydrate-conclusion: 无source的结论迁移后应从provenance记录构建source', () => {
  const store = createSourceStore();
  const sealName = '2024春季第一周';
  const { conclusions } = store.sealSnapshot(sealName, ssEvents.slice(0, 3));
  const targetConc = conclusions[0];
  const prov = store.getProvenanceRecords().find(r => r.entity_type === 'conclusion' && r.entity_id === targetConc.conclusion_id);
  const oldConc = deepClone(targetConc);
  delete oldConc.source;
  assert(oldConc.source === undefined, '模拟旧结论应无source字段');
  const migratedSource = {
    original_name: prov?.original_name || oldConc.snapshot_name,
    current_name: prov?.current_name || oldConc.snapshot_name,
    branch_source: prov?.generation_method || 'seal',
    import_decision: prov?.generation_method?.startsWith('import_')
      ? (prov.generation_method === 'import_copy' ? 'copy' : prov.generation_method === 'import_overwrite' ? 'overwrite' : 'skip')
      : undefined,
    is_original: prov?.is_original ?? !prov?.parent_provenance_id,
  };
  oldConc.source = migratedSource;
  assertEq(oldConc.source.original_name, prov.original_name, '迁移后original_name=provenance.original_name');
  assertEq(oldConc.source.current_name, prov.current_name, '迁移后current_name=provenance.current_name');
  assertEq(oldConc.source.branch_source, 'seal', '迁移后branch_source=seal (来自provenance)');
  assertEq(oldConc.source.is_original, true, '迁移后is_original=true');
  console.log(`     迁移旧结论${oldConc.conclusion_id.slice(0,12)}：source从provenance构建，original="${oldConc.source.original_name}", current="${oldConc.source.current_name}"`);
});

console.log('\n--- 回归验证21: 完整round-trip: seal→branch→export→验证命名一致性 ---');
test('SnapshotSource-roundtrip: seal→branch→export完整链路，所有导出结论source身份一致', () => {
  const store = createSourceStore();
  const sealName = '2024春季第一周';
  const branchName = '2024春季第一周-终审';
  const { provenance, snapshot: sealSnap } = store.sealSnapshot(sealName, ssEvents);
  assertEq(sealSnap.source.branch_source, 'seal', 'seal阶段branch_source=seal');
  const branchResult = store.branchProvenance(provenance.provenance_id, branchName);
  assert(branchResult, 'branch应成功');
  assertEq(branchResult.snapshot.source.branch_source, 'branch', 'branch阶段branch_source=branch');
  const branchConcIds = branchResult.newConclusions.map(c => c.conclusion_id);
  const concJson = JSON.parse(store.exportSealedConclusionsJson(branchConcIds));
  const exportedConclusions = concJson.conclusions;
  assertEq(exportedConclusions.length, 12, '导出应有12条结论');
  const currentNames = [...new Set(exportedConclusions.map(c => c.source.current_name))];
  const originalNames = [...new Set(exportedConclusions.map(c => c.source.original_name))];
  const branchSources = [...new Set(exportedConclusions.map(c => c.source.branch_source))];
  const isOriginals = [...new Set(exportedConclusions.map(c => c.source.is_original))];
  assertEq(currentNames.length, 1, '所有导出结论current_name应一致');
  assertEq(currentNames[0], branchName, 'current_name应=branch_name');
  assertEq(originalNames.length, 1, '所有导出结论original_name应一致');
  assertEq(originalNames[0], sealName, 'original_name应=seal_name');
  assertEq(branchSources.length, 1, '所有导出结论branch_source应一致');
  assertEq(branchSources[0], 'branch', 'branch_source应=branch');
  assertEq(isOriginals.length, 1, '所有导出结论is_original应一致');
  assertEq(isOriginals[0], false, 'is_original应=false');
  const snapJson = JSON.parse(store.exportSnapshotsJson([branchResult.snapshot.snapshot_id]));
  const exportedSnap = snapJson.snapshots[0];
  assert(exportedSnap.source, '导出快照应含source');
  assertEq(exportedSnap.source.current_name, branchName, '导出快照source.current_name=branch_name');
  assertEq(exportedSnap.source.original_name, sealName, '导出快照source.original_name=seal_name');
  console.log(`     Round-trip完成: seal"${sealName}"→branch"${branchName}"→export 12条结论，source身份全部一致`);
  console.log(`     current_name="${currentNames[0]}", original_name="${originalNames[0]}", branch_source="branch", is_original=false`);
});
