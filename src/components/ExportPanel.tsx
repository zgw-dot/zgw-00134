import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useBoardStore } from '@/store';
import { exportEvents, downloadBlob, CSVField } from '@/utils/exporters';
import {
  Download,
  ChevronDown,
  FileSpreadsheet,
  FileJson,
  Check,
} from 'lucide-react';

const CSV_FIELDS: (string | CSVField)[] = [
  { key: 'event_id', label: '事件ID' },
  { key: 'canonical_allergen', label: '过敏原标准名' },
  { key: 'matched_aliases', label: '命中别名' },
  { key: 'meal_type', label: '餐次' },
  { key: 'risk_level', label: '风险等级' },
  { key: 'status', label: '状态' },
  { key: 'time_window_start', label: '时间窗开始' },
  { key: 'time_window_end', label: '时间窗结束' },
  { key: 'student_names', label: '学生姓名' },
  { key: 'student_ids', label: '学生ID' },
  { key: 'class_names', label: '班级' },
  { key: 'latest_note', label: '最新备注' },
  { key: 'created_at', label: '创建时间' },
  { key: 'updated_at', label: '更新时间' },
];

function formatTimestamp(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '-' +
    pad(d.getHours()) +
    pad(d.getMinutes())
  );
}

export default function ExportPanel() {
  const getVisibleEvents = useBoardStore((s) => s.getVisibleEvents);
  const [open, setOpen] = useState(false);
  const [exported, setExported] = useState<'csv' | 'json' | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = (format: 'csv' | 'json') => {
    const events = getVisibleEvents();
    const timestamp = formatTimestamp(new Date());
    const fileName = `allergen-events-${timestamp}.${format}`;

    const exportData = events.map((e) => ({
      ...e,
      student_names: e.student_names?.join('、') || '',
      student_ids: e.student_ids?.join('、') || '',
      class_names: e.class_names?.join('、') || '',
      matched_aliases: e.matched_aliases?.join('、') || '',
    }));

    const blob =
      format === 'csv'
        ? exportEvents(exportData, 'csv', CSV_FIELDS)
        : exportEvents(exportData, 'json');

    downloadBlob(blob, fileName);

    setExported(format);
    setTimeout(() => setExported(null), 1500);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border border-slate-600',
          'bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300',
          'hover:bg-slate-700 hover:text-slate-100 hover:border-slate-500 transition-colors',
          open && 'bg-slate-700 border-slate-500'
        )}
      >
        <Download className="h-4 w-4" />
        导出
        <ChevronDown
          className={cn(
            'h-4 w-4 text-slate-400 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            'absolute right-0 z-30 mt-1.5 min-w-[180px] overflow-hidden rounded-md',
            'border border-slate-700 bg-slate-800 py-1 shadow-lg'
          )}
        >
          <button
            type="button"
            onClick={() => handleExport('csv')}
            className={cn(
              'flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors',
              exported === 'csv'
                ? 'bg-teal-500/10 text-teal-300'
                : 'text-slate-300 hover:bg-slate-700'
            )}
          >
            <div
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md',
                exported === 'csv'
                  ? 'bg-teal-500/20 text-teal-300'
                  : 'bg-emerald-500/10 text-emerald-400'
              )}
            >
              {exported === 'csv' ? (
                <Check className="h-4 w-4" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
            </div>
            <div className="flex flex-col items-start text-left">
              <span className="font-medium">导出 CSV</span>
              <span className="text-[11px] text-slate-500">明细表格</span>
            </div>
          </button>

          <div className="border-t border-slate-700/60" />

          <button
            type="button"
            onClick={() => handleExport('json')}
            className={cn(
              'flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors',
              exported === 'json'
                ? 'bg-teal-500/10 text-teal-300'
                : 'text-slate-300 hover:bg-slate-700'
            )}
          >
            <div
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md',
                exported === 'json'
                  ? 'bg-teal-500/20 text-teal-300'
                  : 'bg-sky-500/10 text-sky-400'
              )}
            >
              {exported === 'json' ? (
                <Check className="h-4 w-4" />
              ) : (
                <FileJson className="h-4 w-4" />
              )}
            </div>
            <div className="flex flex-col items-start text-left">
              <span className="font-medium">导出 JSON</span>
              <span className="text-[11px] text-slate-500">原始数据</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
