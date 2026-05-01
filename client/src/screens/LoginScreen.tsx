import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { XField } from "../components/XField";
import { XPasswordField } from "../components/XPasswordField";
import { XButton } from "../components/XButton";
import { useAuth } from "../store/auth";
import { useToast } from "../store/toast";
import { useT } from "../lib/i18n";

type Mode = "login" | "register";

export function LoginScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [key, setKey] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; key?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  const login = useAuth((s) => s.login);
  const register = useAuth((s) => s.register);
  const toast = useToast((s) => s.push);
  const t = useT();

  async function onSubmit() {
    setErrors({});
    const e: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) e.email = t("login.errEmail");
    if (password.length < 8) e.password = t("login.errPwd");
    if (mode === "register" && !/^XTHING(-[A-Z0-9]{4}){3}$/.test(key.trim())) {
      e.key = t("login.errKey");
    }
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, key.trim().toUpperCase());
      toast({ kind: "success", title: mode === "login" ? t("login.welcome") : t("login.created") });
    } catch (err: any) {
      const msg = err?.message || t("common.error");
      setErrors({ form: msg });
      toast({ kind: "error", title: t("common.error"), message: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="w-full max-w-sm"
      layout
    >
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="text-center mb-7"
      >
        <div className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-bg-card border border-line-strong mb-3 shadow-glow">
          <span className="text-[28px] font-semibold">X</span>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <h1 className="text-[24px] font-semibold tracking-tight">
              {mode === "login" ? t("login.title") : t("register.title")}
            </h1>
            <p className="text-[13px] text-ink-2 mt-1">
              {mode === "login" ? t("login.subtitle") : t("register.subtitle")}
            </p>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <motion.div className="flex flex-col gap-3" layout>
        <XField
          label={t("login.email")}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <XPasswordField
          label={t("login.password")}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />

        <AnimatePresence initial={false}>
          {mode === "register" ? (
            <motion.div
              key="key-field"
              initial={{ opacity: 0, height: 0, marginTop: -12 }}
              animate={{ opacity: 1, height: "auto", marginTop: 0 }}
              exit={{ opacity: 0, height: 0, marginTop: -12 }}
              transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
              style={{ overflow: "hidden" }}
            >
              <XField
                label={t("login.key")}
                autoCapitalize="characters"
                spellCheck={false}
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                placeholder="XTHING-XXXX-XXXX-XXXX"
                error={errors.key}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {errors.form ? (
            <motion.div
              key="form-err"
              initial={{ opacity: 0, y: -4, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="text-[12px] text-ink-1 flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-ink-0" /> {errors.form}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <XButton fullWidth loading={loading} onClick={onSubmit} className="mt-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={mode}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.12 }}
            >
              {mode === "login" ? t("login.submitLogin") : t("login.submitRegister")}
            </motion.span>
          </AnimatePresence>
        </XButton>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setErrors({});
          }}
          className="text-[13px] text-ink-2 hover:text-ink-0 mt-1 transition-colors"
        >
          {mode === "login" ? t("login.toRegister") : t("login.toLogin")}
        </button>
      </motion.div>
    </motion.div>
  );
}
