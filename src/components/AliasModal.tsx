import { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertCircle, CheckCircle2, Tag } from 'lucide-react';
import type { AllergenAliasMap } from '@/types';
import { cn } from '@/lib/utils';

interface AliasModalProps {
  open: boolean;
  onClose: () => void;
  initialMap: AllergenAliasMap;
  onSave: (map: AllergenAliasMap) => { ok: boolean; errors: string[] };
}

interface AliasRow {
  id: string;
  standard: string;
  aliases: string;
}

function mapToRows(map: AllergenAliasMap): AliasRow[] {
  return Object.entries(map).map(([k, v], i) => ({
    id: `row-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    standard: k,
    aliases: Array.isArray(v) ? v.join(', ') : '',
  }));
}

function rowsToMap(rows: AliasRow[]): AllergenAliasMap {
  const result: AllergenAliasMap = {};
  for (const row of rows) {
    const standard = row.standard.trim();
    if (!standard) continue;
    const aliases = row.aliases
      .split(/[,，、;；\s]+/)
      .map(s => s.trim())
      .filter(Boolean);
    result[standard] = aliases;
  }
  return result;
}

export default function AliasModal({
  open,
  onClose,
  initialMap,
  onSave,
}: AliasModalProps) {
  const [rows, setRows] = useState<AliasRow[]>([]);
  const [result, setResult] = useState<{ ok: boolean; errors: string[] } | null>(null);

  useEffect(() => {
    if (open) {
      setRows(mapToRows(initialMap));
      setResult(null);
    }
  }, [open, initialMap]);

  if (!open) return null;

  const addRow = () => {
    setRows(r => [
      ...r,
      {
        id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        standard: '',
        aliases: '',
      },
    ]);
  };

  const removeRow = (id: string) => {
    setRows(r => r.filter(row => row.id !== id));
  };

  const updateRow = (id: string, key: 'standard' | 'aliases', value: string) => {
    setRows(r =>
      r.map(row => (row.id === id ? { ...row, [key]: value } : row))
    );
  };

  const handleSave = () => {
    const map = rowsToMap(rows);
    const res = onSave(map);
    setResult(res);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-3xl card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">过敏原别名配置</h2>
              <p className="text-xs text-slate-500">
                配置过敏原标准名与别名的对应关系，用于数据归并匹配
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost p-2 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left font-medium text-slate-400 py-2 px-3 w-1/3">
                    标准名称
                  </th>
                  <th className="text-left font-medium text-slate-400 py-2 px-3">
                    别名列表（逗号分隔）
                  </th>
                  <th className="py-2 px-2 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-500 text-sm">
                      暂无配置，点击下方「+ 新增一行」添加
                    </td>
                  </tr>
                )}
                {rows.map(row => (
                  <tr key={row.id} className="group">
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        value={row.standard}
                        onChange={e => updateRow(row.id, 'standard', e.target.value)}
                        placeholder="如：花生"
                        className="input"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        value={row.aliases}
                        onChange={e => updateRow(row.id, 'aliases', e.target.value)}
                        placeholder="如：花生酱, 花生油, 花生米"
                        className="input"
                      />
                    </td>
                    <td className="py-2 pl-1">
                      <button
                        onClick={() => removeRow(row.id)}
                        className={cn(
                          'p-2 rounded-md transition-all',
                          rows.length <= 1
                            ? 'opacity-30 cursor-not-allowed text-slate-500'
                            : 'text-slate-500 hover:text-rose-400 hover:bg-rose-500/10'
                        )}
                        disabled={rows.length <= 1}
                        title="删除此行"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={addRow}
            className="w-full py-2 border border-dashed border-slate-600/70 rounded-md text-sm text-slate-400 hover:text-teal-400 hover:border-teal-500/50 hover:bg-teal-500/5 transition-all flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            新增一行
          </button>

          {result && !result.ok && result.errors.length > 0 && (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-medium text-sm">
                <AlertCircle className="w-4 h-4" />
                校验失败 ({result.errors.length} 个错误)
              </div>
              <ul className="list-disc list-inside space-y-1 text-xs text-rose-300/90">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {result?.ok && (
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-center gap-2 text-emerald-400 font-medium text-sm">
                <CheckCircle2 className="w-4 h-4" />
                保存成功！已重新归并风险事件
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-700/50 bg-slate-800/50">
          <button onClick={onClose} className="btn-secondary">
            {result?.ok ? '关闭' : '取消'}
          </button>
          {!result?.ok && (
            <button onClick={handleSave} className="btn-primary">
              保存配置
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
