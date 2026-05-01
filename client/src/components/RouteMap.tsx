import { motion } from "framer-motion";
import { useEffect, useMemo } from "react";
import { countryCenter } from "../lib/world-data";
import { countries, countryPath, iso2ToNumeric, MAP_H, MAP_W, project } from "../lib/world-geo";
import { useUserGeo } from "../store/userGeo";
import { useVpn } from "../store/vpn";
import type { Server, VpnState } from "../types";
import { useT } from "../lib/i18n";

interface Props {
  server: Server | null;
  state: VpnState;
}

function UserLocationLabel() {
  const userGeo = useUserGeo((s) => s.geo);
  const loading = useUserGeo((s) => s.loading);
  const error = useUserGeo((s) => s.error);
  const reset = useUserGeo((s) => s.reset);
  const refresh = useUserGeo((s) => s.forceRefresh);
  const vpnState = useVpn((s) => s.status.state);
  const vpnOn = vpnState === "connected" || vpnState === "connecting";
  const t = useT();

  if (loading) return <span className="text-ink-3">{t("map.detecting")}</span>;

  if (userGeo) {
    const parts = [userGeo.city, userGeo.country].filter(Boolean);
    return (
      <span className="inline-flex items-center gap-1.5">
        <span>{parts.join(", ") || "—"}</span>
        {!vpnOn ? (
          <button
            onClick={async () => {
              reset();
              await refresh();
            }}
            className="text-ink-3 hover:text-ink-0 transition-colors"
            title={t("map.refresh")}
            aria-label={t("map.refresh")}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 6a4 4 0 0 1 7-2.6M10 6a4 4 0 0 1-7 2.6M9 1.5V4H6.5M3 10.5V8H5.5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
      </span>
    );
  }
  if (error) {
    return (
      <button
        onClick={refresh}
        className="text-ink-3 hover:text-ink-1 underline-offset-2 hover:underline"
      >
        {t("map.unknown")}
      </button>
    );
  }
  return <span>—</span>;
}

export function RouteMap({ server, state }: Props) {
  const userGeo = useUserGeo((s) => s.geo);
  const fetchIfNeeded = useUserGeo((s) => s.fetchIfNeeded);
  const t = useT();

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  // ISO numeric коды стран user'а и сервера — для подсветки на карте
  const userCountryNum = useMemo(
    () => (userGeo?.country ? iso2ToNumeric(userGeo.country) : undefined),
    [userGeo]
  );
  const serverCountryNum = useMemo(
    () => (server?.countryCode ? iso2ToNumeric(server.countryCode) : undefined),
    [server]
  );

  const userPoint = userGeo ? project(userGeo.lat, userGeo.lng) : null;

  const serverPoint = useMemo(() => {
    if (!server) return null;
    const center = countryCenter[server.countryCode.toUpperCase()];
    if (!center) return null;
    return project(center.lat, center.lng);
  }, [server]);

  const isConnected = state === "connected";
  const isBusy = state === "connecting" || state === "disconnecting";

  // Кривая Безье: control point поднят над серединой пропорционально расстоянию
  const arcPath = useMemo(() => {
    if (!userPoint || !serverPoint) return null;
    const dx = serverPoint.x - userPoint.x;
    const dy = serverPoint.y - userPoint.y;
    const dist = Math.hypot(dx, dy);
    const mx = (userPoint.x + serverPoint.x) / 2;
    const my = (userPoint.y + serverPoint.y) / 2;
    const lift = Math.min(140, dist * 0.45);
    const cx = mx;
    const cy = my - lift;
    return `M${userPoint.x.toFixed(1)},${userPoint.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${serverPoint.x.toFixed(1)},${serverPoint.y.toFixed(1)}`;
  }, [userPoint, serverPoint]);

  const lineStroke = isConnected ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.32)";
  const lineWidth = isConnected ? 1.8 : 1.2;

  // Пред-рендер всех путей стран — один раз, не зависит от state
  const countryRender = useMemo(
    () =>
      countries.map((f, i) => {
        const id = String(f.id ?? "");
        const d = countryPath(f);
        if (!d) return null;
        return { key: i, id, d };
      }),
    []
  );

  return (
    <div className="w-full bg-bg-card border border-line rounded-card overflow-hidden">
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="block w-full h-auto"
        style={{ aspectRatio: `${MAP_W}/${MAP_H}` }}
      >
        <defs>
          <pattern id="rmgrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.6" fill="rgba(255,255,255,0.04)" />
          </pattern>
          <radialGradient id="serverGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        <rect width={MAP_W} height={MAP_H} fill="url(#rmgrid)" />

        {/* Все страны мира — реальная геометрия из Natural Earth.
            Страны user'а и сервера подсвечиваются ярче. */}
        {countryRender.map((c) => {
          if (!c) return null;
          const isUser = userCountryNum && c.id === userCountryNum;
          const isServer = serverCountryNum && c.id === serverCountryNum;
          const highlighted = isUser || isServer;
          return (
            <path
              key={c.key}
              d={c.d}
              fill={highlighted ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.05)"}
              stroke={highlighted ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.12)"}
              strokeWidth={highlighted ? 0.6 : 0.3}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {/* Маршрут: дуга от пользователя к серверу */}
        {arcPath ? (
          <>
            <path
              d={arcPath}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={3}
              strokeLinecap="round"
            />
            {isConnected ? (
              <motion.path
                d={arcPath}
                fill="none"
                stroke={lineStroke}
                strokeWidth={lineWidth}
                strokeLinecap="round"
                strokeDasharray="6 10"
                animate={{ strokeDashoffset: [0, -32] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.4))" }}
              />
            ) : isBusy ? (
              <motion.path
                d={arcPath}
                fill="none"
                stroke={lineStroke}
                strokeWidth={lineWidth}
                strokeLinecap="round"
                strokeDasharray="3 6"
                animate={{ strokeDashoffset: [0, -18] }}
                transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
              />
            ) : (
              <path
                d={arcPath}
                fill="none"
                stroke={lineStroke}
                strokeWidth={lineWidth}
                strokeLinecap="round"
                strokeDasharray="2 5"
              />
            )}
          </>
        ) : null}

        {/* Точка пользователя */}
        {userPoint ? (
          <g transform={`translate(${userPoint.x}, ${userPoint.y})`}>
            <motion.circle
              r={3.5}
              fill="rgba(255,255,255,0.85)"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="0.8"
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <text
              x="0"
              y="-9"
              textAnchor="middle"
              fontSize="9"
              fill="rgba(255,255,255,0.5)"
              fontFamily="Inter"
              letterSpacing="0.5"
            >
              {t("map.you")}
            </text>
          </g>
        ) : null}

        {/* Точка сервера */}
        {serverPoint ? (
          <g transform={`translate(${serverPoint.x}, ${serverPoint.y})`}>
            {(isConnected || isBusy) ? (
              <>
                <circle r={20} fill="url(#serverGlow)" />
                <motion.circle
                  r={6}
                  fill="none"
                  stroke="rgba(255,255,255,0.5)"
                  strokeWidth="1"
                  animate={{ scale: [1, 2.2, 2.2], opacity: [0.7, 0, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                />
              </>
            ) : null}
            <circle
              r={isConnected ? 5.5 : 4.5}
              fill="#ffffff"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="1"
            />
            <circle r={1.6} fill="#000" />
            <text
              x="0"
              y={-12}
              textAnchor="middle"
              fontSize="9"
              fill="rgba(255,255,255,0.7)"
              fontFamily="Inter"
              letterSpacing="0.5"
            >
              {server?.countryCode.toUpperCase()}
            </text>
          </g>
        ) : null}
      </svg>

      {/* Подпись внизу */}
      <div className="px-4 py-2.5 border-t border-line bg-bg-card/80 backdrop-blur flex items-center justify-between gap-3 text-[12px]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-ink-0/80" />
          <span className="text-ink-2 truncate">
            <UserLocationLabel />
          </span>
        </div>

        <span className="text-ink-3">
          {isConnected ? t("map.tunnelActive") : isBusy ? t("map.connectingDots") : t("map.notConnected")}
        </span>

        <div className="flex items-center gap-2 min-w-0 justify-end">
          <span className="text-ink-2 truncate">
            {server ? (
              <>
                {server.city ? `${server.city}, ` : ""}
                {countryCenter[server.countryCode.toUpperCase()]?.name ?? server.countryCode}
              </>
            ) : (
              "—"
            )}
          </span>
          <span className="w-2 h-2 rounded-full bg-ink-0" />
        </div>
      </div>
    </div>
  );
}
