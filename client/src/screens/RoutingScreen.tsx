import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Routing, type RoutingRule, type RoutingState, type RuleAction, type RuleKind } from "../api/routing";
import { XSegmented } from "../components/XSegmented";
import { XField } from "../components/XField";
import { XButton } from "../components/XButton";
import { PageHeader } from "../components/PageHeader";
import { useToast } from "../store/toast";
import { useT } from "../lib/i18n";

interface Props {
  onBack: () => void;
}

export function RoutingScreen({ onBack }: Props) {
  const [state, setState] = useState<RoutingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newKind, setNewKind] = useState<RuleKind>("domain");
  const [newValue, setNewValue] = useState("");
  const [newAction, setNewAction] = useState<RuleAction>("direct");
  const [busy, setBusy] = useState(false);
  const toast = useToast((s) => s.push);
  const t = useT();

  const KINDS: { value: RuleKind; labelKey: string; hintKey: string; placeholder: string }[] = [
    { value: "domain", labelKey: "routing.kindDomain", hintKey: "routing.hintDomain", placeholder: "*.youtube.com" },
    { value: "ip", labelKey: "routing.kindIp", hintKey: "routing.hintIp", placeholder: "8.8.8.8" },
    { value: "process", labelKey: "routing.kindProcess", hintKey: "routing.hintProcess", placeholder: "chrome.exe" },
    { value: "regex", labelKey: "routing.kindRegex", hintKey: "routing.hintRegex", placeholder: ".*\\.ru$" },
  ];

  const ACTIONS: { value: RuleAction; labelKey: string }[] = [
    { value: "proxy", labelKey: "routing.actionProxy" },
    { value: "direct", labelKey: "routing.actionDirect" },
    { value: "block", labelKey: "routing.actionBlock" },
  ];

  const load = () =>
    Routing.get()
      .then(setState)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  async function changeDefault(v: "proxy" | "direct") {
    if (!state) return;
    setState({ ...state, defaultAction: v });
    try {
      await Routing.setDefault(v);
    } catch (e: any) {
      toast({ kind: "error", title: t("common.error"), message: e?.message });
      load();
    }
  }

  async function addRule() {
    if (!newValue.trim()) {
      toast({ kind: "error", title: t("routing.enterValue") });
      return;
    }
    setBusy(true);
    try {
      await Routing.addRule({ kind: newKind, value: newValue.trim(), action: newAction });
      toast({ kind: "success", title: t("routing.added") });
      setNewValue("");
      setAdding(false);
      load();
    } catch (e: any) {
      toast({ kind: "error", title: t("common.error"), message: e?.message });
    } finally {
      setBusy(false);
    }
  }

  async function deleteRule(id: string) {
    try {
      await Routing.deleteRule(id);
      load();
    } catch (e: any) {
      toast({ kind: "error", title: t("common.error"), message: e?.message });
    }
  }

  async function move(id: string, dir: -1 | 1) {
    if (!state) return;
    const idx = state.rules.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= state.rules.length) return;
    const arr = [...state.rules];
    [arr[idx], arr[next]] = [arr[next]!, arr[idx]!];
    setState({ ...state, rules: arr });
    try {
      await Routing.reorder(arr.map((r) => r.id));
    } catch (e: any) {
      toast({ kind: "error", title: t("common.error"), message: e?.message });
      load();
    }
  }

  return (
    <div className="flex flex-col gap-5 p-5 max-w-2xl mx-auto">
      <PageHeader>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 grid place-items-center rounded-full bg-bg-card border border-line hover:border-line-strong"
            aria-label={t("common.back")}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <div className="text-[11px] text-ink-2 uppercase tracking-[0.1em]">{t("settings.title")}</div>
            <h2 className="text-[22px] font-semibold tracking-tight">{t("routing.title")}</h2>
          </div>
        </div>
      </PageHeader>

      <section className="bg-bg-card border border-line rounded-card p-5 flex flex-col gap-3">
        <div>
          <div className="text-[14px] font-medium text-ink-0">{t("routing.default")}</div>
          <div className="text-[12px] text-ink-2 mt-0.5">{t("routing.defaultDesc")}</div>
        </div>
        <XSegmented<"proxy" | "direct">
          value={state?.defaultAction ?? "proxy"}
          onChange={changeDefault}
          options={[
            { value: "proxy", label: t("routing.allViaVpn") },
            { value: "direct", label: t("routing.allDirect") },
          ]}
          fullWidth
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] font-medium text-ink-0">{t("routing.rules")}</div>
            <div className="text-[12px] text-ink-2">{t("routing.rulesDesc")}</div>
          </div>
          {!adding ? <XButton onClick={() => setAdding(true)}>{t("common.add")}</XButton> : null}
        </div>

        <AnimatePresence initial={false}>
          {adding ? (
            <motion.div
              key="add"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="bg-bg-card border border-line rounded-card p-4 flex flex-col gap-3">
                <div>
                  <div className="text-[11px] text-ink-2 uppercase tracking-[0.08em] mb-2">{t("routing.kind")}</div>
                  <XSegmented<RuleKind>
                    value={newKind}
                    onChange={setNewKind}
                    options={KINDS.map((k) => ({ value: k.value, label: t(k.labelKey) }))}
                    fullWidth
                    size="sm"
                  />
                </div>
                <XField
                  label={t("routing.value")}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={KINDS.find((k) => k.value === newKind)?.placeholder}
                  spellCheck={false}
                  autoCapitalize="none"
                />
                <div className="text-[11px] text-ink-3 -mt-1.5">
                  {t(KINDS.find((k) => k.value === newKind)?.hintKey ?? "")}
                </div>
                <div>
                  <div className="text-[11px] text-ink-2 uppercase tracking-[0.08em] mb-2">{t("routing.action")}</div>
                  <XSegmented<RuleAction>
                    value={newAction}
                    onChange={setNewAction}
                    options={ACTIONS.map((a) => ({ value: a.value, label: t(a.labelKey) }))}
                    fullWidth
                    size="sm"
                  />
                </div>
                <div className="flex gap-2">
                  <XButton variant="secondary" fullWidth onClick={() => { setAdding(false); setNewValue(""); }}>
                    {t("common.cancel")}
                  </XButton>
                  <XButton fullWidth onClick={addRule} loading={busy}>{t("common.add")}</XButton>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {loading ? (
          <div className="text-center text-ink-2 text-[13px] py-6">{t("common.loading")}</div>
        ) : !state || state.rules.length === 0 ? (
          <div className="text-center text-ink-2 text-[13px] py-10 border border-line rounded-card bg-bg-card border-dashed">
            {t("routing.empty")}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {state.rules.map((r, i) => (
                <RuleCard
                  key={r.id}
                  rule={r}
                  isFirst={i === 0}
                  isLast={i === state.rules.length - 1}
                  onMoveUp={() => move(r.id, -1)}
                  onMoveDown={() => move(r.id, 1)}
                  onDelete={() => deleteRule(r.id)}
                  t={t}
                  KINDS={KINDS}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      <div className="text-[11px] text-ink-3 leading-relaxed">{t("routing.note")}</div>
    </div>
  );
}

function RuleCard({
  rule,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
  t,
  KINDS,
}: {
  rule: RoutingRule;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  t: (k: string) => string;
  KINDS: { value: RuleKind; labelKey: string }[];
}) {
  const actionStyle: Record<RuleAction, { labelKey: string; className: string }> = {
    proxy: { labelKey: "routing.actionShortProxy", className: "bg-ink-0 text-black" },
    direct: { labelKey: "routing.actionShortDirect", className: "border border-line-strong text-ink-1" },
    block: { labelKey: "routing.actionShortBlock", className: "border border-ink-0 [border-style:dashed] text-ink-0" },
  };
  const kindLabel = t(KINDS.find((k) => k.value === rule.kind)?.labelKey ?? rule.kind);
  const a = actionStyle[rule.action];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="bg-bg-card border border-line rounded-card p-3 flex items-center gap-3"
    >
      <div className="flex flex-col gap-0.5">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="w-5 h-5 grid place-items-center text-ink-2 hover:text-ink-0 disabled:opacity-20"
          aria-label={t("common.up")}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 6l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="w-5 h-5 grid place-items-center text-ink-2 hover:text-ink-0 disabled:opacity-20"
          aria-label={t("common.down")}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className={["px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-[0.08em] min-w-[52px] text-center", a.className].join(" ")}>
        {t(a.labelKey)}
      </div>
      <div className="text-[10px] uppercase tracking-[0.08em] text-ink-2 w-16">{kindLabel}</div>
      <div className="flex-1 min-w-0 text-[13px] font-mono text-ink-0 truncate">{rule.value}</div>
      <button
        onClick={onDelete}
        className="text-ink-2 hover:text-ink-0 w-7 h-7 grid place-items-center rounded hover:bg-ink-0/5"
        aria-label={t("common.delete")}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </motion.div>
  );
}
