import { Search, X, Filter } from 'lucide-react';
import type { FilterState, MealType, RiskLevel, EventStatus } from '@/types';
import { cn } from '@/lib/utils';

interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (f: Partial<FilterState>) => void;
  availableClasses: string[];
}

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: '早餐' },
  { value: 'lunch', label: '午餐' },
  { value: 'dinner', label: '晚餐' },
  { value: 'snack', label: '加餐' },
];

const RISK_LEVELS: { value: RiskLevel; label: string; color: string }[] = [
  { value: 'high', label: '高', color: 'bg-rose-600 hover:bg-rose-500 text-white' },
  { value: 'medium', label: '中', color: 'bg-amber-600 hover:bg-amber-500 text-white' },
  { value: 'low', label: '低', color: 'bg-emerald-600 hover:bg-emerald-500 text-white' },
];

const STATUSES: { value: EventStatus; label: string }[] = [
  { value: 'pending', label: '待处理' },
  { value: 'confirmed', label: '已确认' },
  { value: 'false_alarm', label: '误报' },
  { value: 'closed', label: '已关闭' },
];

function Chip({
  active,
  onClick,
  children,
  className = '',
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 rounded-md text-xs font-medium transition-all',
        active
          ? className || 'bg-teal-600 text-white hover:bg-teal-500'
          : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
      )}
    >
      {children}
    </button>
  );
}

export default function FilterPanel({
  filters,
  onFiltersChange,
  availableClasses,
}: FilterPanelProps) {
  const hasActiveFilters =
    filters.classes.length > 0 ||
    filters.meal_types.length > 0 ||
    filters.risk_levels.length > 0 ||
    filters.statuses.length > 0 ||
    filters.search_text.trim().length > 0;

  const toggle = <T,>(arr: T[], value: T, key: keyof FilterState) => {
    const newArr = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
    onFiltersChange({ [key]: newArr } as Partial<FilterState>);
  };

  const clearAll = () => {
    onFiltersChange({
      classes: [],
      meal_types: [],
      risk_levels: [],
      statuses: [],
      search_text: '',
    });
  };

  return (
    <div className="card p-4 mt-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-200">筛选条件</span>
        </div>
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={filters.search_text}
              onChange={e => onFiltersChange({ search_text: e.target.value })}
              placeholder="搜索学生、过敏原、班级..."
              className="input pl-8"
            />
          </div>
          {hasActiveFilters && (
            <button className="btn-ghost" onClick={clearAll} title="清除筛选">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {availableClasses.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs text-slate-400">班级</div>
          <div className="flex flex-wrap gap-1.5">
            {availableClasses.map(cls => (
              <Chip
                key={cls}
                active={filters.classes.includes(cls)}
                onClick={() => toggle(filters.classes, cls, 'classes')}
              >
                {cls}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="text-xs text-slate-400">餐次</div>
        <div className="flex flex-wrap gap-1.5">
          {MEAL_TYPES.map(mt => (
            <Chip
              key={mt.value}
              active={filters.meal_types.includes(mt.value)}
              onClick={() => toggle(filters.meal_types, mt.value, 'meal_types')}
            >
              {mt.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs text-slate-400">风险等级</div>
        <div className="flex flex-wrap gap-1.5">
          {RISK_LEVELS.map(rl => (
            <Chip
              key={rl.value}
              active={filters.risk_levels.includes(rl.value)}
              onClick={() => toggle(filters.risk_levels, rl.value, 'risk_levels')}
              className={rl.color}
            >
              {rl.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs text-slate-400">处理状态</div>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map(s => (
            <Chip
              key={s.value}
              active={filters.statuses.includes(s.value)}
              onClick={() => toggle(filters.statuses, s.value, 'statuses')}
            >
              {s.label}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}
