import { motion } from "framer-motion";
import { type ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "right" | "center";
  render: (row: T) => ReactNode;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  emptyHint?: string;
  rowKey: (row: T) => string;
}

export function XTable<T>({ rows, columns, emptyHint, rowKey }: Props<T>) {
  const gridStyle = {
    gridTemplateColumns: columns.map((c) => c.width || "1fr").join(" "),
  };

  if (!rows.length) {
    return (
      <div className="text-center text-[13px] text-ink-2 py-10 border border-line rounded-card bg-bg-card">
        {emptyHint || "Пусто"}
      </div>
    );
  }

  const alignClass = (a?: "left" | "right" | "center") =>
    a === "right" ? "text-right justify-end" : a === "center" ? "text-center justify-center" : "text-left";

  return (
    <div className="border border-line rounded-card bg-bg-card overflow-hidden">
      <div
        className="grid text-[11px] uppercase tracking-[0.08em] text-ink-2 px-3 py-2.5 gap-3 bg-bg-secondary/40 border-b border-line"
        style={gridStyle}
      >
        {columns.map((c) => (
          <div key={c.key} className={["min-w-0 truncate", alignClass(c.align)].join(" ")}>
            {c.header}
          </div>
        ))}
      </div>
      <div className="divide-y divide-line">
        {rows.map((row, i) => (
          <motion.div
            key={rowKey(row)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: { delay: i * 0.015 } }}
            className="grid items-center px-3 py-2.5 gap-3 text-[13px] hover:bg-ink-0/[0.03] transition-colors"
            style={gridStyle}
          >
            {columns.map((c) => (
              <div key={c.key} className="min-w-0 overflow-hidden">
                {/* Внутренний block-div с truncate — это где реально работает
                    text-overflow:ellipsis, потому что block-уровень + nowrap
                    + overflow:hidden даёт корректный line-box для ellipsis,
                    в отличие от truncate на inline span внутри ячейки. */}
                <div className={["truncate flex items-center", alignClass(c.align)].join(" ")}>
                  {c.render(row)}
                </div>
              </div>
            ))}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
