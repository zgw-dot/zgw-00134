import { useState } from 'react';
import {
  RiskEvent,
  EventStatus,
  RiskLevel,
  MealType,
  EvidenceLink,
} from '@/types';
import { cn } from '@/lib/utils';
import { formatTime } from '@/utils/date';
import { useBoardStore } from '@/store';
import {
  X,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  AlertTriangle,
  Activity,
  Minus,
  Coffee,
  Sun,
  UtensilsCrossed,
  Cookie,
  Clock,
  CheckCircle2,
  XCircle,
  Archive,
  User,
  ClipboardList,
  ShoppingBag,
  MessageSquareWarning,
  HandHeart,
  Save,
  ChevronUp,
} from 'lucide-react';

interface EventDetailDrawerProps {
  event: RiskEvent | null;
  onClose: () => void;
}

const RISK_LABELS: Record<RiskLevel, { label: string; cls: string }> = {
  high: { label: '高风险', cls: 'text-amber-300 bg-amber-500/15 border-amber-500/40' },
  medium: { label: '中风险', cls: 'text-sky-300 bg-sky-500/15 border-sky-500/40' },
  low: { label: '低风险', cls: 'text-slate-300 bg-slate-500/15 border-slate-500/40' },
};

const RISK_ICONS: Record<RiskLevel, React.ReactNode> = {
  high: <AlertTriangle className="h-3.5 w-3.5" />,
  medium: <Activity className="h-3.5 w-3.5" />,
  low: <Minus className="h-3.5 w-3.5" />,
};

const STATUS_LABELS: Record<EventStatus, { label: string; cls: string }> = {
  pending: { label: '待复核', cls: 'text-sky-300 bg-sky-500/15 border-sky-500/40' },
  confirmed: { label: '已确认', cls: 'text-teal-300 bg-teal-500/15 border-teal-500/40' },
  false_alarm: { label: '误报', cls: 'text-rose-300 bg-rose-500/15 border-rose-500/40' },
  closed: { label: '已关闭', cls: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40' },
};

const STATUS_ICONS: Record<EventStatus, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5" />,
  confirmed: <CheckCircle2 className="h-3.5 w-3.5" />,
  false_alarm: <XCircle className="h-3.5 w-3.5" />,
  closed: <Archive className="h-3.5 w-3.5" />,
};

const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: 'pending', label: '待复核' },
  { value: 'confirmed', label: '已确认' },
  { value: 'false_alarm', label: '误报' },
  { value: 'closed', label: '已关闭' },
];

const MEAL_ICONS: Record<MealType, React.ReactNode> = {
  breakfast: <Coffee className="h-4 w-4" />,
  lunch: <Sun className="h-4 w-4" />,
  dinner: <UtensilsCrossed className="h-4 w-4" />,
  snack: <Cookie className="h-4 w-4" />,
};

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '点心',
};

const EVIDENCE_TYPE_INFO: Record<
  EvidenceLink['type'],
  { label: string; icon: React.ReactNode; cls: string }
> = {
  menu: {
    label: '菜单证据',
    icon: <ClipboardList className="h-4 w-4" />,
    cls: 'text-indigo-300',
  },
  profile: {
    label: '过敏档案',
    icon: <User className="h-4 w-4" />,
    cls: 'text-violet-300',
  },
  pickup: {
    label: '领餐记录',
    icon: <ShoppingBag className="h-4 w-4" />,
    cls: 'text-teal-300',
  },
  complaint: {
    label: '投诉记录',
    icon: <MessageSquareWarning className="h-4 w-4" />,
    cls: 'text-rose-300',
  },
};

function SectionTitle({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2 border-b border-slate-700 pb-2">
      {icon}
      <h3 className="text-sm font-semibold text-slate-200">{children}</h3>
    </div>
  );
}

function InfoRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="min-w-[72px] flex-none text-xs text-slate-500 pt-0.5">
        {label}
      </span>
      {value !== undefined ? (
        <div className="flex-1 text-sm text-slate-200 break-all">{value}</div>
      ) : (
        <div className="flex-1">{children}</div>
      )}
    </div>
  );
}

function StudentItem({
  name,
  className,
  studentId,
}: {
  name: string;
  className?: string;
  studentId?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-md border border-slate-700 bg-slate-800/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-700/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-teal-500/15 text-teal-300">
            <User className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-200 truncate">{name}</div>
            {className && (
              <div className="text-xs text-slate-500 truncate">{className}</div>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 flex-none text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 flex-none text-slate-500" />
        )}
      </button>
      {expanded && studentId && (
        <div className="border-t border-slate-700 px-3 py-2 bg-slate-800/80">
          <div className="text-xs text-slate-500">
            学号: <span className="font-mono text-slate-400">{studentId}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function EvidenceAccordion({
  type,
  items,
}: {
  type: EvidenceLink['type'];
  items: EvidenceLink[];
}) {
  const [open, setOpen] = useState(false);
  const info = EVIDENCE_TYPE_INFO[type];
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (sourceId: string, data: any) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopiedId(sourceId);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {}
  };

  return (
    <div className="rounded-md border border-slate-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 bg-slate-800/60 hover:bg-slate-700/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={info.cls}>{info.icon}</span>
          <span className="text-sm font-medium text-slate-200">{info.label}</span>
          <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[11px] text-slate-400">
            {items.length}
          </span>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 flex-none text-slate-500" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-none text-slate-500" />
        )}
      </button>
      {open && items.length > 0 && (
        <div className="border-t border-slate-700 bg-slate-900/30">
          {items.map((item, idx) => {
            const copied = copiedId === item.source_id;
            return (
              <div
                key={`${item.source_id}-${idx}`}
                className={cn(
                  'flex items-center justify-between gap-2 px-3 py-2',
                  idx !== items.length - 1 && 'border-b border-slate-700/60'
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs text-slate-400 truncate">
                    {item.source_id}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {formatTime(item.imported_at, 'datetime')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(item.source_id, item.source_data)}
                  className={cn(
                    'flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors',
                    copied
                      ? 'bg-teal-500/15 text-teal-300'
                      : 'text-slate-500 hover:bg-slate-700 hover:text-slate-300'
                  )}
                  title="复制JSON"
                >
                  {copied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied ? '已复制' : '复制'}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {open && items.length === 0 && (
        <div className="border-t border-slate-700 bg-slate-900/30 px-3 py-3 text-center text-xs text-slate-600">
          暂无此类型证据
        </div>
      )}
    </div>
  );
}

function ReviewTimeline({ event }: { event: RiskEvent }) {
  const logs = [...(event.review_logs || [])].reverse();
  if (logs.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-700 bg-slate-800/30 px-3 py-4 text-center text-xs text-slate-600">
        暂无流转记录
      </div>
    );
  }
  return (
    <div className="relative">
      {logs.map((log, idx) => {
        const isLast = idx === logs.length - 1;
        return (
          <div key={log.id} className="relative flex gap-3 pb-4">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'h-2.5 w-2.5 rounded-full border-2 bg-slate-900',
                  'border-teal-500'
                )}
              />
              {!isLast && (
                <div className="w-px flex-1 bg-slate-700 mt-1" />
              )}
            </div>
            <div className="flex-1 -mt-0.5">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-mono text-[11px] text-slate-500">
                  {formatTime(log.timestamp, 'full')}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mb-1.5 text-xs">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded border px-1.5 py-0.5',
                    STATUS_LABELS[log.from_status].cls
                  )}
                >
                  {STATUS_ICONS[log.from_status]}
                  {STATUS_LABELS[log.from_status].label}
                </span>
                <span className="text-slate-600">→</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded border px-1.5 py-0.5',
                    STATUS_LABELS[log.to_status].cls
                  )}
                >
                  {STATUS_ICONS[log.to_status]}
                  {STATUS_LABELS[log.to_status].label}
                </span>
              </div>
              {log.note && (
                <div className="rounded bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-400 italic">
                  {log.note}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function EventDetailDrawer({
  event,
  onClose,
}: EventDetailDrawerProps) {
  const updateEventStatus = useBoardStore((s) => s.updateEventStatus);
  const [newStatus, setNewStatus] = useState<EventStatus>('pending');
  const [note, setNote] = useState('');

  if (!event) return null;

  const evidenceByType: Record<EvidenceLink['type'], EvidenceLink[]> = {
    menu: [],
    profile: [],
    pickup: [],
    complaint: [],
  };
  for (const ev of event.evidence || []) {
    evidenceByType[ev.type].push(ev);
  }

  const handleSave = () => {
    updateEventStatus(event.event_id, newStatus, note);
    setNote('');
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-full max-w-[520px] flex-col',
          'bg-slate-800 border-l border-slate-700 shadow-2xl'
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-100 truncate">
              事件详情
            </h2>
            <div className="font-mono text-[11px] text-slate-500 truncate">
              {event.event_id}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'flex h-8 w-8 flex-none items-center justify-center rounded-md',
              'text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors'
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6 px-5 py-5">
            <div>
              <SectionTitle icon={<HandHeart className="h-4 w-4 text-teal-400" />}>
                基本信息
              </SectionTitle>
              <InfoRow label="过敏原">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-base font-semibold text-teal-300">
                    {event.canonical_allergen}
                  </span>
                  {event.matched_aliases?.map((a) => (
                    <span
                      key={a}
                      className="inline-flex items-center rounded bg-slate-700 px-1.5 py-0.5 text-[11px] text-slate-400"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </InfoRow>

              <InfoRow label="风险等级">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium',
                    RISK_LABELS[event.risk_level].cls
                  )}
                >
                  {RISK_ICONS[event.risk_level]}
                  {RISK_LABELS[event.risk_level].label}
                </span>
              </InfoRow>

              <InfoRow label="状态">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium',
                    STATUS_LABELS[event.status].cls
                  )}
                >
                  {STATUS_ICONS[event.status]}
                  {STATUS_LABELS[event.status].label}
                </span>
              </InfoRow>

              <InfoRow label="餐次">
                {event.meal_type ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-slate-300">
                    {MEAL_ICONS[event.meal_type]}
                    {MEAL_LABELS[event.meal_type]}
                  </span>
                ) : (
                  <span className="text-slate-600">-</span>
                )}
              </InfoRow>

              <InfoRow label="时间窗">
                <div className="font-mono text-xs text-slate-300">
                  <div>{formatTime(event.time_window_start, 'full')}</div>
                  <div className="text-slate-600">
                    ~ {formatTime(event.time_window_end, 'full')}
                  </div>
                </div>
              </InfoRow>

              <div className="flex items-start gap-3 py-1.5">
                <span className="min-w-[72px] flex-none text-xs text-slate-500 pt-0.5">
                  学生列表
                </span>
                <div className="flex-1 space-y-1.5">
                  {event.student_names?.map((name, idx) => (
                    <StudentItem
                      key={`${name}-${idx}`}
                      name={name}
                      className={event.class_names?.[idx]}
                      studentId={event.student_ids?.[idx]}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <SectionTitle icon={<ClipboardList className="h-4 w-4 text-indigo-400" />}>
                证据链
              </SectionTitle>
              <div className="space-y-2">
                {(['menu', 'profile', 'pickup', 'complaint'] as EvidenceLink['type'][]).map(
                  (type) => (
                    <EvidenceAccordion
                      key={type}
                      type={type}
                      items={evidenceByType[type]}
                    />
                  )
                )}
              </div>
            </div>

            <div>
              <SectionTitle icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}>
                复核工作台
              </SectionTitle>

              <div className="space-y-3 rounded-md border border-slate-700 bg-slate-800/40 p-3 mb-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">
                    切换状态
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as EventStatus)}
                    className={cn(
                      'w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2',
                      'text-sm text-slate-200',
                      'hover:border-slate-500 focus:border-teal-500 focus:outline-none transition-colors'
                    )}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">
                    备注
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="请输入复核备注..."
                    className={cn(
                      'w-full resize-none rounded-md border border-slate-600 bg-slate-800 px-3 py-2',
                      'text-sm text-slate-200 placeholder:text-slate-600',
                      'hover:border-slate-500 focus:border-teal-500 focus:outline-none transition-colors'
                    )}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSave}
                  className={cn(
                    'flex w-full items-center justify-center gap-1.5 rounded-md',
                    'bg-teal-500 px-3 py-2 text-sm font-medium text-white',
                    'hover:bg-teal-600 active:bg-teal-700 transition-colors'
                  )}
                >
                  <Save className="h-4 w-4" />
                  保存状态变更
                </button>
              </div>

              <div>
                <div className="mb-2 text-xs font-medium text-slate-400">
                  流转日志
                </div>
                <ReviewTimeline event={event} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
