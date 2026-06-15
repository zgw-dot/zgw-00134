import { useState, useRef, useCallback } from 'react';
import { FileType, ImportError } from '@/types';
import { cn } from '@/lib/utils';
import { useBoardStore } from '@/store';
import {
  X,
  Upload,
  FileJson,
  ClipboardList,
  User,
  ShoppingBag,
  MessageSquareWarning,
  Check,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileWarning,
} from 'lucide-react';

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
}

const TABS: {
  value: FileType;
  label: string;
  icon: React.ReactNode;
  hint: string;
}[] = [
  {
    value: 'menu',
    label: '菜单',
    icon: <ClipboardList className="h-4 w-4" />,
    hint: '选择 menu.json 文件',
  },
  {
    value: 'profile',
    label: '过敏档案',
    icon: <User className="h-4 w-4" />,
    hint: '选择 profiles.json 文件',
  },
  {
    value: 'pickup',
    label: '领餐记录',
    icon: <ShoppingBag className="h-4 w-4" />,
    hint: '选择 pickups.json 文件',
  },
  {
    value: 'complaint',
    label: '投诉',
    icon: <MessageSquareWarning className="h-4 w-4" />,
    hint: '选择 complaints.json 文件',
  },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface TabImportState {
  file: File | null;
  importing: boolean;
  result: {
    ok: boolean;
    duplicate: boolean;
    imported: number;
    errors: string[];
  } | null;
  errorsExpanded: boolean;
}

const initialTabState = (): TabImportState => ({
  file: null,
  importing: false,
  result: null,
  errorsExpanded: false,
});

export default function ImportModal({ open, onClose }: ImportModalProps) {
  const importData = useBoardStore((s) => s.importData);
  const [activeTab, setActiveTab] = useState<FileType>('menu');
  const tabStatesRef = useRef<Record<FileType, TabImportState>>({
    menu: initialTabState(),
    profile: initialTabState(),
    pickup: initialTabState(),
    complaint: initialTabState(),
  });
  const [, forceUpdate] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getState = (type: FileType) => tabStatesRef.current[type];
  const setState = (type: FileType, patch: Partial<TabImportState>) => {
    tabStatesRef.current[type] = { ...tabStatesRef.current[type], ...patch };
    forceUpdate((n) => n + 1);
  };

  const handleFileSelect = useCallback(
    async (type: FileType, file: File) => {
      setState(type, { file, result: null, errorsExpanded: false });
    },
    []
  );

  const handleImport = useCallback(
    async (type: FileType) => {
      const state = getState(type);
      if (!state.file || state.importing) return;

      setState(type, { importing: true });

      try {
        const content = await state.file.text();
        let parsed: any[];
        try {
          parsed = JSON.parse(content);
          if (!Array.isArray(parsed)) {
            throw new Error('文件内容必须是数组');
          }
        } catch (e) {
          setState(type, {
            importing: false,
            result: {
              ok: false,
              duplicate: false,
              imported: 0,
              errors: [`JSON 解析失败: ${(e as Error).message}`],
            },
          });
          return;
        }

        const result = importData(type, state.file.name, parsed);

        setState(type, {
          importing: false,
          result: {
            ok: result.ok,
            duplicate: !result.ok && result.errors.some((e) => e.includes('已导入过')),
            imported: result.imported,
            errors: result.errors,
          },
        });
      } catch (e) {
        setState(type, {
          importing: false,
          result: {
            ok: false,
            duplicate: false,
            imported: 0,
            errors: [`读取文件失败: ${(e as Error).message}`],
          },
        });
      }
    },
    [importData]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, type: FileType) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.name.endsWith('.json')) {
          handleFileSelect(type, file);
        }
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const resetTab = (type: FileType) => {
    tabStatesRef.current[type] = initialTabState();
    if (fileInputRef.current) fileInputRef.current.value = '';
    forceUpdate((n) => n + 1);
  };

  const handleClose = () => {
    tabStatesRef.current = {
      menu: initialTabState(),
      profile: initialTabState(),
      pickup: initialTabState(),
      complaint: initialTabState(),
    };
    onClose();
  };

  if (!open) return null;

  const currentTab = TABS.find((t) => t.value === activeTab)!;
  const state = getState(activeTab);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={cn(
            'flex w-full max-w-2xl flex-col rounded-md shadow-2xl',
            'bg-slate-800 border border-slate-700'
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-100">数据导入</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                选择对应类型的 JSON 文件进行导入
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className={cn(
                'flex h-8 w-8 flex-none items-center justify-center rounded-md',
                'text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors'
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex border-b border-slate-700 bg-slate-800/60 px-5">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.value;
              const tabState = getState(tab.value);
              const hasSuccess = tabState.result && tabState.result.ok && tabState.result.imported > 0;
              const hasErrors =
                tabState.result && tabState.result.errors.length > 0 && !tabState.result.duplicate;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    'relative flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'text-teal-300'
                      : 'text-slate-500 hover:text-slate-300'
                  )}
                >
                  {tab.icon}
                  {tab.label}
                  {hasSuccess && (
                    <Check className="h-3 w-3 text-emerald-400" />
                  )}
                  {!hasSuccess && hasErrors && (
                    <FileWarning className="h-3 w-3 text-amber-400" />
                  )}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {!state.file && (
              <div
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, activeTab)}
                className={cn(
                  'flex flex-col items-center justify-center gap-4 rounded-md border-2 border-dashed',
                  'border-slate-600 bg-slate-800/30 p-8 text-center cursor-pointer',
                  'hover:border-teal-500/50 hover:bg-slate-800/60 transition-colors'
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-700/60">
                  <Upload className="h-6 w-6 text-slate-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-200 mb-1">
                    {currentTab.hint}
                  </div>
                  <div className="text-xs text-slate-500">
                    点击选择或拖拽文件到此区域（仅支持 .json 格式）
                  </div>
                </div>
                <FileJson className="h-4 w-4 text-slate-600" />
              </div>
            )}

            {state.file && !state.result && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-md border border-slate-700 bg-slate-800/60 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-teal-500/10">
                      <FileJson className="h-5 w-5 text-teal-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-200 truncate">
                        {state.file.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatFileSize(state.file.size)}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    <button
                      type="button"
                      onClick={() => resetTab(activeTab)}
                      className={cn(
                        'flex items-center gap-1 rounded-md border border-slate-600',
                        'px-3 py-1.5 text-xs text-slate-400',
                        'hover:bg-slate-700 hover:text-slate-200 transition-colors'
                      )}
                    >
                      <X className="h-3 w-3" />
                      移除
                    </button>
                    <button
                      type="button"
                      onClick={() => handleImport(activeTab)}
                      disabled={state.importing}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-medium text-white transition-colors',
                        state.importing
                          ? 'bg-teal-600 cursor-not-allowed'
                          : 'bg-teal-500 hover:bg-teal-600 active:bg-teal-700'
                      )}
                    >
                      {state.importing ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          导入中...
                        </>
                      ) : (
                        <>
                          <Upload className="h-3.5 w-3.5" />
                          导入
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {state.result && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-md border border-slate-700 bg-slate-800/60 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 flex-none items-center justify-center rounded-md',
                        state.result.duplicate
                          ? 'bg-amber-500/10'
                          : state.result.ok
                          ? 'bg-emerald-500/10'
                          : 'bg-rose-500/10'
                      )}
                    >
                      {state.result.duplicate ? (
                        <AlertCircle className="h-5 w-5 text-amber-400" />
                      ) : state.result.ok ? (
                        <Check className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <XCircle className="h-5 w-5 text-rose-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-200 truncate">
                        {state.file?.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {state.file ? formatFileSize(state.file.size) : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    <button
                      type="button"
                      onClick={() => resetTab(activeTab)}
                      className={cn(
                        'flex items-center gap-1 rounded-md border border-slate-600',
                        'px-3 py-1.5 text-xs text-slate-400',
                        'hover:bg-slate-700 hover:text-slate-200 transition-colors'
                      )}
                    >
                      重新选择
                    </button>
                  </div>
                </div>

                <div className="space-y-2 rounded-md border border-slate-700 bg-slate-800/40 p-4">
                  {state.result.duplicate ? (
                    <div className="flex items-center gap-2 text-sm text-amber-300 bg-amber-500/10 rounded-md px-3 py-2 border border-amber-500/30">
                      <AlertCircle className="h-4 w-4 flex-none" />
                      <span>该文件已导入过，跳过</span>
                    </div>
                  ) : (
                    <>
                      {state.result.ok && state.result.imported > 0 && (
                        <div className="flex items-center gap-2 text-sm text-emerald-300 bg-emerald-500/10 rounded-md px-3 py-2 border border-emerald-500/30">
                          <Check className="h-4 w-4 flex-none" />
                          <span>
                            <span className="font-semibold">
                              ✓ {state.result.imported}
                            </span>
                            条记录导入成功
                          </span>
                        </div>
                      )}

                      {state.result.errors.length > 0 && (
                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              setState(activeTab, {
                                errorsExpanded: !state.errorsExpanded,
                              })
                            }
                            className={cn(
                              'flex w-full items-center justify-between gap-2 text-sm',
                              'text-rose-300 bg-rose-500/10 rounded-md px-3 py-2 border border-rose-500/30'
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <XCircle className="h-4 w-4 flex-none" />
                              <span>
                                <span className="font-semibold">
                                  ✗ {state.result.errors.length}
                                </span>
                                条错误
                              </span>
                            </span>
                            {state.errorsExpanded ? (
                              <ChevronUp className="h-4 w-4 flex-none" />
                            ) : (
                              <ChevronDown className="h-4 w-4 flex-none" />
                            )}
                          </button>

                          {state.errorsExpanded && (
                            <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-rose-500/20 bg-slate-900/50">
                              {state.result.errors.map((err, idx) => (
                                <div
                                  key={idx}
                                  className={cn(
                                    'px-3 py-2 text-xs',
                                    idx !== state.result!.errors.length - 1 &&
                                      'border-b border-slate-700/60'
                                  )}
                                >
                                  <div className="flex items-start gap-2">
                                    <AlertCircle className="h-3 w-3 flex-none text-rose-400 mt-0.5" />
                                    <span className="text-slate-400 break-all">
                                      {err}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileSelect(activeTab, file);
                }
              }}
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-700 px-5 py-3">
            <button
              type="button"
              onClick={handleClose}
              className={cn(
                'flex items-center gap-1.5 rounded-md border border-slate-600',
                'px-4 py-2 text-sm font-medium text-slate-300',
                'hover:bg-slate-700 hover:text-slate-100 transition-colors'
              )}
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
