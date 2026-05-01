import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export function WindowTitlebar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const w = window.xthing?.window;
    if (!w) return;
    w.isMaximized().then(setMaximized);
    const off = w.onMaximizeChange(setMaximized);
    return () => off();
  }, []);

  const minimize = () => window.xthing?.window.minimize();
  const maximize = () => window.xthing?.window.maximize();
  const close = () => window.xthing?.window.close();

  return (
    <div
      className="relative h-9 flex items-center justify-between border-b border-line bg-bg-primary/95 backdrop-blur select-none"
      style={{ WebkitAppRegion: "drag" } as any}
    >
      <div className="flex items-center gap-2 px-3">
        <div
          className="w-4 h-4 rounded-sm grid place-items-center bg-ink-0/[0.06] border border-line-strong"
          aria-hidden
        >
          <span className="text-[9px] font-bold text-ink-0">X</span>
        </div>
        <span className="text-[11px] tracking-[0.18em] uppercase text-ink-2">
          XThing VPN
        </span>
      </div>

      <div
        className="flex items-stretch h-full"
        style={{ WebkitAppRegion: "no-drag" } as any}
      >
        <TitlebarButton onClick={minimize} ariaLabel="Свернуть">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          </svg>
        </TitlebarButton>
        <TitlebarButton onClick={maximize} ariaLabel="Развернуть">
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="2.5" y="0.5" width="6" height="6" stroke="currentColor" strokeWidth="0.9" />
              <rect x="0.5" y="2.5" width="6" height="6" fill="#000" stroke="currentColor" strokeWidth="0.9" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="0.9" />
            </svg>
          )}
        </TitlebarButton>
        <TitlebarButton onClick={close} ariaLabel="Закрыть" danger>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          </svg>
        </TitlebarButton>
      </div>
    </div>
  );
}

function TitlebarButton({
  onClick,
  ariaLabel,
  danger,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      onClick={onClick}
      aria-label={ariaLabel}
      whileTap={{ scale: 0.92 }}
      className={[
        "h-full w-11 grid place-items-center text-ink-2 transition-colors",
        danger
          ? "hover:bg-ink-0 hover:text-black"
          : "hover:bg-ink-0/[0.08] hover:text-ink-0",
      ].join(" ")}
    >
      {children}
    </motion.button>
  );
}
