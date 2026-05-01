import { motion } from "framer-motion";
import { useI18n, useT, type Lang } from "../lib/i18n";

const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: "ru", label: "Русский", flag: "RU" },
  { code: "en", label: "English", flag: "EN" },
];

export function LanguageSwitcher() {
  const lang = useI18n((s) => s.lang);
  const setLang = useI18n((s) => s.setLang);
  const t = useT();
  return (
    <section className="bg-bg-card border border-line rounded-card p-5 flex flex-col gap-3">
      <div>
        <div className="text-[14px] font-medium text-ink-0">{t("settings.lang")}</div>
        <div className="text-[12px] text-ink-2 mt-0.5">{t("settings.langDesc")}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 relative">
        {LANGS.map((l) => {
          const active = lang === l.code;
          return (
            <motion.button
              key={l.code}
              type="button"
              onClick={() => setLang(l.code)}
              whileTap={{ scale: 0.97 }}
              className="relative rounded-card px-4 py-3 text-left no-select overflow-hidden"
            >
              {active ? (
                <motion.span
                  layoutId="lang-active"
                  className="absolute inset-0 bg-ink-0/[0.07] border border-line-strong rounded-card"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              ) : null}
              <div className="relative flex items-center gap-3">
                <span
                  className={[
                    "shrink-0 w-9 h-9 grid place-items-center rounded-full border text-[10px] font-bold tracking-wider",
                    active ? "bg-ink-0 text-black border-ink-0" : "border-line text-ink-2",
                  ].join(" ")}
                >
                  {l.flag}
                </span>
                <div className="min-w-0">
                  <div
                    className={[
                      "text-[14px] font-medium leading-tight",
                      active ? "text-ink-0" : "text-ink-1",
                    ].join(" ")}
                  >
                    {l.label}
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
