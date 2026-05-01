import { api } from "./client";

export type RuleKind = "process" | "ip" | "domain" | "regex";
export type RuleAction = "proxy" | "direct" | "block";

export interface RoutingRule {
  id: string;
  kind: RuleKind;
  value: string;
  action: RuleAction;
  sortOrder: number;
  enabled: boolean;
}

export interface RoutingState {
  defaultAction: "proxy" | "direct";
  rules: RoutingRule[];
}

export const Routing = {
  get: () => api<RoutingState>("/user/routing"),
  setDefault: (defaultAction: "proxy" | "direct") =>
    api<{ ok: true }>("/user/routing/default", {
      method: "PUT",
      body: JSON.stringify({ defaultAction }),
    }),
  addRule: (rule: Omit<RoutingRule, "id" | "sortOrder" | "enabled">) =>
    api<{ id: string }>("/user/routing/rules", {
      method: "POST",
      body: JSON.stringify(rule),
    }),
  patchRule: (id: string, patch: Partial<Omit<RoutingRule, "id">>) =>
    api<{ ok: true }>(`/user/routing/rules/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteRule: (id: string) =>
    api<{ ok: true }>(`/user/routing/rules/${id}`, { method: "DELETE" }),
  reorder: (ids: string[]) =>
    api<{ ok: true }>("/user/routing/rules/order", {
      method: "PUT",
      body: JSON.stringify({ ids }),
    }),
};
