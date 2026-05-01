import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";
import { continents, countryCenter, MAP_H, MAP_W, project } from "../lib/world-data";
import type { Server } from "../types";

interface Props {
  servers: Server[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

interface Point {
  server: Server;
  x: number;
  y: number;
}

export function WorldMap({ servers, selectedId, onSelect }: Props) {
  const [hover, setHover] = useState<string | null>(null);

  const continentPaths = useMemo(
    () =>
      continents.map((c) => {
        const d = c.points
          .map(([lng, lat], i) => {
            const p = project(lat, lng);
            return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
          })
          .join(" ") + " Z";
        return { name: c.name, d };
      }),
    []
  );

  const points = useMemo<Point[]>(() => {
    const grouped = new Map<string, Point[]>();
    for (const s of servers) {
      const cc = s.countryCode.toUpperCase();
      const center = countryCenter[cc];
      if (!center) continue;
      const p = project(center.lat, center.lng);
      const list = grouped.get(cc) || [];
      // Точки одной страны кучкуются — разбрасываем по кругу
      const offsetIdx = list.length;
      const angle = offsetIdx * (Math.PI * 0.6);
      const r = offsetIdx === 0 ? 0 : 9;
      list.push({
        server: s,
        x: p.x + Math.cos(angle) * r,
        y: p.y + Math.sin(angle) * r,
      });
      grouped.set(cc, list);
    }
    return Array.from(grouped.values()).flat();
  }, [servers]);

  const selectedPoint = points.find((p) => p.server.id === selectedId);

  return (
    <div className="w-full bg-bg-card border border-line rounded-card overflow-hidden">
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="block w-full h-auto"
        style={{ aspectRatio: `${MAP_W}/${MAP_H}` }}
      >
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.6" fill="rgba(255,255,255,0.04)" />
          </pattern>
          <radialGradient id="dotGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        <rect width={MAP_W} height={MAP_H} fill="url(#grid)" />

        {/* Континенты */}
        {continentPaths.map((c) => (
          <path
            key={c.name}
            d={c.d}
            fill="rgba(255,255,255,0.08)"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="0.6"
            strokeLinejoin="round"
          />
        ))}

        {/* Соединительные линии от выбранной точки */}
        {selectedPoint
          ? points
              .filter((p) => p.server.id !== selectedPoint.server.id)
              .slice(0, 10)
              .map((p) => (
                <line
                  key={`l-${p.server.id}`}
                  x1={selectedPoint.x}
                  y1={selectedPoint.y}
                  x2={p.x}
                  y2={p.y}
                  stroke="rgba(255,255,255,0.07)"
                  strokeWidth="0.5"
                  strokeDasharray="2 3"
                />
              ))
          : null}

        {/* Точки серверов */}
        {points.map((p) => {
          const isSelected = p.server.id === selectedId;
          const isHover = p.server.id === hover;
          return (
            <g
              key={p.server.id}
              transform={`translate(${p.x}, ${p.y})`}
              style={{ cursor: "pointer" }}
              onClick={() => onSelect(p.server.id)}
              onMouseEnter={() => setHover(p.server.id)}
              onMouseLeave={() => setHover(null)}
            >
              {/* Свечение для выбранного */}
              {isSelected ? (
                <>
                  <motion.circle
                    r={18}
                    fill="url(#dotGlow)"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                  />
                  <motion.circle
                    r={9}
                    fill="none"
                    stroke="rgba(255,255,255,0.5)"
                    strokeWidth="1"
                    animate={{ scale: [1, 1.7, 1.7], opacity: [0.7, 0, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                  />
                </>
              ) : null}

              {/* Hover hit-area + подложка */}
              <circle r={10} fill="transparent" />
              <circle
                r={isSelected || isHover ? 4.5 : 3}
                fill={isSelected ? "#ffffff" : isHover ? "#ffffff" : "rgba(255,255,255,0.85)"}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth={isSelected ? 1.5 : 0.8}
                style={{ transition: "r 0.18s, fill 0.15s" }}
              />
              {isSelected ? (
                <circle
                  r={1.4}
                  fill="#000"
                />
              ) : null}
            </g>
          );
        })}
      </svg>

      {/* Тултип-плашка снизу */}
      <AnimatePresence mode="wait">
        {(() => {
          const showId = hover ?? selectedId;
          const p = points.find((q) => q.server.id === showId);
          if (!p) return null;
          const center = countryCenter[p.server.countryCode.toUpperCase()];
          return (
            <motion.div
              key={p.server.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="px-4 py-2.5 border-t border-line bg-bg-card/80 backdrop-blur flex items-center gap-3"
            >
              <span className="w-2 h-2 rounded-full bg-ink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-ink-0 truncate">{p.server.name}</div>
                <div className="text-[11px] text-ink-2">
                  {center?.name ?? p.server.countryCode} · {p.server.protocol.toUpperCase()} · нагрузка {p.server.loadPercent}%
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
