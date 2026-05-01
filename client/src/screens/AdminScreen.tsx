import { useState } from "react";
import { XSegmented } from "../components/XSegmented";
import { Stage } from "../components/Stage";
import { PageHeader } from "../components/PageHeader";
import { Dashboard } from "./admin/Dashboard";
import { UsersAdmin } from "./admin/UsersAdmin";
import { KeysAdmin } from "./admin/KeysAdmin";
import { ServersAdmin } from "./admin/ServersAdmin";
import { useT } from "../lib/i18n";

type Section = "dashboard" | "users" | "keys" | "servers";

export function AdminScreen() {
  const [section, setSection] = useState<Section>("dashboard");
  const t = useT();

  const sections: { value: Section; label: string }[] = [
    { value: "dashboard", label: t("admin.tabDashboard") },
    { value: "users", label: t("admin.tabUsers") },
    { value: "keys", label: t("admin.tabKeys") },
    { value: "servers", label: t("admin.tabServers") },
  ];

  const content =
    section === "dashboard" ? <Dashboard /> :
    section === "users" ? <UsersAdmin /> :
    section === "keys" ? <KeysAdmin /> :
    <ServersAdmin />;

  return (
    <div className="flex flex-col gap-4 p-5 max-w-3xl mx-auto">
      <PageHeader>
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-[11px] text-ink-2 uppercase tracking-[0.1em]">{t("admin.subtitle")}</div>
            <h2 className="text-[22px] font-semibold tracking-tight">{t("admin.title")}</h2>
          </div>
          <XSegmented<Section> value={section} onChange={setSection} options={sections} fullWidth size="sm" />
        </div>
      </PageHeader>

      <Stage pageKey={section}>{content}</Stage>
    </div>
  );
}
