"use client";
import { useActionState, useEffect, useState } from "react";
import { Globe2, Sparkles } from "lucide-react";
import { signIn } from "@/app/actions";
import { Button } from "./ui/button";

export function Login({ supabase }: { supabase: boolean }) {
  const [error, action, pending] = useActionState(signIn, "");
  const [ar, setAr] = useState(false);
  useEffect(() => {
    try {
      setAr(localStorage.getItem("hayati-lang") === "ar");
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = ar ? "ar" : "en";
    document.documentElement.dir = ar ? "rtl" : "ltr";
  }, [ar]);
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  return (
    <main className="login">
      <form action={action} className="card stack">
        <div className="login-header">
          <div className="brand-icon">
            <Sparkles size={22} />
          </div>
          <button
            type="button"
            className="language"
            onClick={() => {
              setAr(!ar);
              try {
                localStorage.setItem("hayati-lang", ar ? "en" : "ar");
              } catch {}
            }}
          >
            <Globe2 size={16} />
            {t("العربية", "English")}
          </button>
        </div>
        <h1>Hayati OS</h1>
        <p>
          {t(
            "Sign in to your personal workspace.",
            "سجّلي الدخول إلى مساحة عملك الشخصية.",
          )}
        </p>
        {supabase && (
          <label>
            {t("Email", "البريد الإلكتروني")}
            <input
              name="email"
              type="email"
              autoComplete="username"
              dir="ltr"
              required
            />
          </label>
        )}
        <label>
          {t("Password", "كلمة المرور")}
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p role="alert">
            {t(
              "Could not sign in. Check your credentials and try again.",
              "تعذّر تسجيل الدخول. تحقّقي من بياناتك وحاولي مجددًا.",
            )}
          </p>
        )}
        <Button className="primary" disabled={pending}>
          {t("Sign in", "تسجيل الدخول")}
        </Button>
      </form>
    </main>
  );
}
