import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "react-hot-toast";
import { ShieldCheck, Smartphone } from "lucide-react";
import api from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ContentPanel } from "@/components/shared/PremiumUI";

type PanelStatus = "loading" | "disabled" | "setup" | "enabled";

const onlyDigits = (value: string) => value.replace(/\D/g, "").slice(0, 6);

export default function TwoFactorPanel() {
  const [status, setStatus] = useState<PanelStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const refreshStatus = async () => {
    try {
      const { data } = await api.get("/auth/me");
      setStatus(data?.totp_enabled ? "enabled" : "disabled");
    } catch {
      setStatus((prev) => (prev === "loading" ? "disabled" : prev));
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  const startSetup = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/auth/2fa/setup");
      setSecret(data.secret as string);
      setQr(await QRCode.toDataURL(data.otpauth_url as string));
      setCode("");
      setStatus("setup");
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "تعذر بدء الإعداد");
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async () => {
    if (code.trim().length !== 6) {
      toast.error("أدخل الرمز المكوّن من 6 أرقام");
      return;
    }
    setBusy(true);
    try {
      await api.post("/auth/2fa/enable", { code: code.trim() });
      toast.success("تم تفعيل المصادقة الثنائية بنجاح");
      setQr("");
      setSecret("");
      setCode("");
      await refreshStatus();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "رمز التحقق غير صحيح");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!password) {
      toast.error("أدخل كلمة المرور للتأكيد");
      return;
    }
    setBusy(true);
    try {
      await api.post("/auth/2fa/disable", { password });
      toast.success("تم إيقاف المصادقة الثنائية");
      setPassword("");
      await refreshStatus();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "تعذر الإيقاف");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ContentPanel
      title="المصادقة الثنائية (TOTP)"
      subtitle="طبقة حماية إضافية عند تسجيل الدخول عبر تطبيقات المصادقة."
    >
      <div className="space-y-5 max-w-xl">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center text-primary">
            <Smartphone size={18} />
          </span>
          {status === "loading" && <Badge variant="secondary">جارٍ التحقق…</Badge>}
          {status === "enabled" && (
            <Badge variant="success">
              <ShieldCheck size={12} /> مفعّلة
            </Badge>
          )}
          {status !== "enabled" && status !== "loading" && (
            <Badge variant="secondary">غير مفعّلة</Badge>
          )}
        </div>

        {status === "disabled" && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-muted leading-relaxed">
              فعّلها لطلب رمز من تطبيق المصادقة (Google Authenticator ونحوه) مع كل دخول.
            </p>
            <Button onClick={startSetup} loading={busy} className="h-11 rounded-xl px-8 text-xs font-black">
              بدء الإعداد
            </Button>
          </div>
        )}

        {status === "setup" && (
          <div className="space-y-4">
            {qr && (
              <img
                src={qr}
                alt="رمز QR للمصادقة الثنائية"
                loading="lazy"
                decoding="async"
                className="h-44 w-44 rounded-2xl border border-border bg-white p-2"
              />
            )}
            {secret && (
              <p className="text-[11px] font-bold text-muted leading-relaxed">
                أو أدخل المفتاح يدويًا: <span dir="ltr" className="text-main tabular-nums">{secret}</span>
              </p>
            )}
            <div className="space-y-1.5">
              <label htmlFor="totp-setup-code" className="text-[10px] font-black tracking-widest text-muted uppercase mr-1">
                رمز التحقق (6 أرقام)
              </label>
              <Input
                id="totp-setup-code"
                value={code}
                onChange={(e) => setCode(onlyDigits(e.target.value))}
                className="h-11 rounded-xl bg-soft border-border/60 font-bold text-center tracking-[0.5em]"
                placeholder="••••••"
                autoComplete="one-time-code"
                inputMode="numeric"
                dir="ltr"
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={confirmEnable} loading={busy} className="h-11 rounded-xl px-8 text-xs font-black">
                تفعيل
              </Button>
              <Button variant="outline" onClick={() => { setStatus("disabled"); setQr(""); setSecret(""); setCode(""); }} className="h-11 rounded-xl px-8 text-xs font-black">
                إلغاء
              </Button>
            </div>
          </div>
        )}

        {status === "enabled" && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-muted leading-relaxed">
              لإيقافها أدخل كلمة المرور الحالية للتأكيد.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="totp-disable-password" className="text-[10px] font-black tracking-widest text-muted uppercase mr-1">
                كلمة المرور الحالية
              </label>
              <Input
                id="totp-disable-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-11 rounded-xl bg-soft border-border/60 font-bold"
              />
            </div>
            <Button variant="danger" onClick={disable} loading={busy} className="h-11 rounded-xl px-8 text-xs font-black">
              إيقاف المصادقة الثنائية
            </Button>
          </div>
        )}
      </div>
    </ContentPanel>
  );
}
