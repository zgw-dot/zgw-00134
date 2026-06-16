import { RiskEvent, EventStatus, RiskLevel, MealType, EvidenceLink } from '@/types';
import { cn } from '@/lib/utils';
import { formatTime } from '@/utils/date';
import {
  Coffee,
  Sun,
  UtensilsCrossed,
  Cookie,
  ClipboardList,
  User,
  HandHeart,
  ShoppingBag,
  MessageSquareWarning,
  StickyNote,
  CheckSquare,
  Square,
} from 'lucide-react';

interface EventCardProps {
  event: RiskEvent;
  onClick: () => void;
  selected: boolean;
  batchSelected: boolean;
  onBatchSelect: (checked: boolean) => void;
}

const STATUS_STYLES: Record<EventStatus, { bg: string; text: string; border: string; label: string }> = {
  pending: {
    bg: 'bg-sky-500/15',
    text: 'text-sky-300',
    border: 'border-sky-500/40',
    label: '待复核',
  },
  confirmed: {
    bg: 'bg-teal-500/15',
    text: 'text-teal-300',
    border: 'border-teal-500/40',
    label: '已确认',
  },
  false_alarm: {
    bg: 'bg-rose-500/15',
    text: 'text-rose-300',
    border: 'border-rose-500/40',
    label: '误报',
  },
  closed: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-300',
    border: 'border-emerald-500/40',
    label: '已关闭',
  },
};

const RISK_BAR_COLORS: Record<RiskLevel, string> = {
  high: 'bg-amber-500',
  medium: 'bg-sky-500',
  low: 'bg-slate-500',
};

const MEAL_ICONS: Record<MealType, React.ReactNode> = {
  breakfast: <Coffee className="h-3.5 w-3.5" />,
  lunch: <Sun className="h-3.5 w-3.5" />,
  dinner: <UtensilsCrossed className="h-3.5 w-3.5" />,
  snack: <Cookie className="h-3.5 w-3.5" />,
};

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '点心',
};

const EVIDENCE_ICON_MAP: Record<EvidenceLink['type'], React.ReactNode> = {
  menu: <ClipboardList className="h-3.5 w-3.5" />,
  profile: <User className="h-3.5 w-3.5" />,
  pickup: <ShoppingBag className="h-3.5 w-3.5" />,
  complaint: <MessageSquareWarning className="h-3.5 w-3.5" />,
};

const EVIDENCE_LABEL_MAP: Record<EvidenceLink['type'], string> = {
  menu: '菜单',
  profile: '档案',
  pickup: '领餐',
  complaint: '投诉',
};

function formatStudentDisplay(names: string[], classes: string[]): string {
  if (!names || names.length === 0) return '暂无学生';
  if (names.length <= 2) {
    const parts = names.map((n, i) => {
      const cls = classes?.[i];
      return cls ? `${n}(${cls})` : n;
    });
    return parts.join('、');
  }
  const firstTwo = names.slice(0, 2).map((n, i) => {
    const cls = classes?.[i];
    return cls ? `${n}(${cls})` : n;
  });
  return `${firstTwo.join('、')} 等${names.length}人`;
}

export default function EventCard({ event, onClick, selected, batchSelected, onBatchSelect }: EventCardProps) {
  const statusStyle = STATUS_STYLES[event.status];
  const riskBarColor = RISK_BAR_COLORS[event.risk_level];

  const evidenceCounts: Record<EvidenceLink['type'], number> = {
    menu: 0,
    profile: 0,
    pickup: 0,
    complaint: 0,
  };
  for (const ev of event.evidence || []) {
    evidenceCounts[ev.type]++;
  }

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onBatchSelect(!batchSelected);
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-md shadow-sm transition-all duration-200',
        'border bg-slate-800',
        selected
          ? 'border-teal-500 shadow-lg shadow-teal-500/10 ring-1 ring-teal-500/30'
          : batchSelected
          ? 'border-teal-400/60 shadow-md shadow-teal-500/5'
          : 'border-slate-700 hover:border-slate-600 hover:shadow-md'
      )}
    >
      <div className={cn('absolute left-0 top-0 h-full w-1', riskBarColor)} />

      <div className="p-4 pl-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCheckboxClick}
              className={cn(
                'flex h-5 w-5 flex-none items-center justify-center rounded transition-colors',
                batchSelected
                  ? 'text-teal-400'
                  : 'text-slate-500 hover:text-slate-300'
              )}
              title={batchSelected ? '取消选择' : '批量选择'}
            >
              {batchSelected ? (
                <CheckSquare className="h-5 w-5 fill-teal-500/20" />
              ) : (
                <Square className="h-5 w-5" />
              )}
            </button>
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                statusStyle.bg,
                statusStyle.text,
                statusStyle.border
              )}
            >
              {statusStyle.label}
            </span>
            {event.risk_level === 'high' && (
              <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300 border border-amber-500/40">
                高风险
              </span>
            )}
          </div>
          <span className="font-mono text-[11px] text-slate-500 truncate max-w-[100px]">
            {event.event_id}
          </span>
        </div>

        <div className="mb-3">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <h3 className="text-base font-semibold text-slate-100 group-hover:text-teal-300 transition-colors">
              {event.canonical_allergen}
            </h3>
            {event.matched_aliases?.slice(0, 2).map((alias) => (
              <span
                key={alias}
                className="inline-flex items-center rounded bg-slate-700/70 px-1.5 py-0.5 text-[11px] text-slate-400"
              >
                {alias}
              </span>
            ))}
            {event.matched_aliases && event.matched_aliases.length > 2 && (
              <span className="inline-flex items-center rounded bg-slate-700/70 px-1.5 py-0.5 text-[11px] text-slate-500">
                +{event.matched_aliases.length - 2}
              </span>
            )}
          </div>
        </div>

        <div className="mb-3 flex items-center gap-1.5 text-sm text-slate-300">
          <HandHeart className="h-3.5 w-3.5 flex-none text-slate-500" />
          <span className="truncate">{formatStudentDisplay(event.student_names, event.class_names)}</span>
        </div>

        <div className="mb-3 flex items-center gap-2 text-sm text-slate-400">
          {event.meal_type && (
            <>
              <span className="inline-flex items-center gap-1 text-slate-300">
                {MEAL_ICONS[event.meal_type]}
                <span>{MEAL_LABELS[event.meal_type]}</span>
              </span>
              <span className="text-slate-600">·</span>
            </>
          )}
          <span className="font-mono text-xs">
            {formatTime(event.time_window_start, 'datetime')}
            {' ~ '}
            {formatTime(event.time_window_end, 'time')}
          </span>
        </div>

        <div className="flex items-start justify-between gap-3 border-t border-slate-700/60 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(evidenceCounts) as EvidenceLink['type'][]).map((type) => {
              const count = evidenceCounts[type];
              return (
                <div
                  key={type}
                  className={cn(
                    'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]',
                    count > 0
                      ? 'bg-slate-700/60 text-slate-300'
                      : 'bg-slate-700/20 text-slate-500'
                  )}
                  title={`${EVIDENCE_LABEL_MAP[type]}: ${count}条`}
                >
                  {EVIDENCE_ICON_MAP[type]}
                  <span>{count}</span>
                </div>
              );
            })}
          </div>

          {event.latest_note && (
            <div className="flex min-w-0 flex-1 items-start gap-1 text-xs text-slate-500">
              <StickyNote className="mt-0.5 h-3 w-3 flex-none text-slate-600" />
              <span className="truncate italic" title={event.latest_note}>
                {event.latest_note.split('\n')[0]}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
