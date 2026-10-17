import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, useLocale, useTheme } from "@ui";
import { version } from "../../../package.json";
import { Cell, Example, Props, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";

const ENTRY_POINTS: [string, { en: string; ar: string }][] = [
  ["@solvfast/ui", l("ThemeProvider, primitives, AppShell, ListView and its parts", "‏ThemeProvider والمكوّنات الأساسية و AppShell و ListView وأجزاؤه")],
  ["@solvfast/ui/frappe", l("FrappeListView and the Frappe client — needs @tanstack/react-query 5", "‏FrappeListView وعميل فرابيه — يتطلّب ‎@tanstack/react-query 5‎")],
  ["@solvfast/ui/tailwind-preset", l("Tailwind 3 preset (apps with Tailwind)", "إعداد Tailwind 3 المسبق (للتطبيقات التي تستخدم Tailwind)")],
  ["@solvfast/ui/theme.css · glass.css · base.css", l("Styles for apps with Tailwind", "الأنماط للتطبيقات التي تستخدم Tailwind")],
  ["@solvfast/ui/full.css · full-base.css", l("Precompiled styles for apps without Tailwind", "أنماط مسبقة الترجمة للتطبيقات دون Tailwind")],
];

export function Overview() {
  const tr = useTr();
  return (
    <div className="space-y-12">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardDescription className="font-mono text-xs uppercase tracking-[0.14em]">{tr(l("SOLV FAST product UI kit", "مجموعة واجهات منتجات SOLV FAST"))}</CardDescription>
          <CardTitle className="font-brand text-3xl"><span dir="ltr">@solvfast/ui</span></CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p className="max-w-2xl">{tr(l(
            "Sear's design, packaged: theme, primitives, the app shell and the List View, with an optional Frappe layer. React 18 · Tailwind 3 (or precompiled CSS) · Radix. Every example on this site is the real component.",
            "تصميم سير في حزمة: السمة والمكوّنات الأساسية وهيكل التطبيق وعرض القائمة، مع طبقة فرابيه اختيارية. React 18 · Tailwind 3 (أو CSS مسبق الترجمة) · Radix. كل مثال في هذا الموقع هو المكوّن الحقيقي."))}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="brand" dir="ltr">{version}</Badge>
            <Badge variant="warning">{tr(l("Private package — GitHub Packages", "حزمة خاصة — GitHub Packages"))}</Badge>
            <Badge variant="info">{tr(l("Frappe: simulated-request tests passed; real-site validation deferred", "فرابيه: نجحت اختبارات الطلبات المحاكاة؛ التحقّق على موقع حقيقي مؤجّل"))}</Badge>
          </div>
        </CardContent>
      </Card>

      <Section title={l("Entry points", "نقاط الدخول")} description={l("Import only what you use; the core never imports the Frappe layer.", "استورد ما تحتاجه فقط؛ النواة لا تستورد طبقة فرابيه أبداً.")}>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <tbody>
              {ENTRY_POINTS.map(([name, what]) => (
                <tr key={name} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-foreground" dir="ltr">{name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{tr(what)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={l("Quick start (app with Tailwind 3)", "البدء السريع (تطبيق يستخدم Tailwind 3)")} description={l("The full setup — both CSS paths, existing apps, fonts — is in docs/CONSUMING.md.", "الإعداد الكامل — مساري CSS والتطبيقات القائمة والخطوط — في docs/CONSUMING.md.")}>
        <Example code={`// tailwind.config.js
import sfPreset from "@solvfast/ui/tailwind-preset";
export default {
  presets: [sfPreset],
  content: ["./index.html", "./src/**/*.{ts,tsx}", "./node_modules/@solvfast/ui/dist/**/*.js"],
};

/* src/index.css */
@import "tailwindcss/base.css";
@import "tailwindcss/components.css";
@import "tailwindcss/utilities.css";
@import "@solvfast/ui/theme.css";

// main.tsx — glass after the Tailwind stylesheet
import "./index.css";
import "@solvfast/ui/glass.css";
import { ThemeProvider, Button } from "@solvfast/ui";

<ThemeProvider defaultLanguage="ar">
  <div className="sf-app min-h-screen"><Button>Save</Button></div>
</ThemeProvider>`}>
          <div className="flex flex-wrap items-center gap-3"><Button>{tr(l("Save", "حفظ"))}</Button><span className="text-sm text-muted-foreground">{tr(l("← the result", "← النتيجة"))}</span></div>
        </Example>
      </Section>
    </div>
  );
}

const TOKENS = ["background", "foreground", "card", "primary", "secondary", "muted", "muted-foreground", "accent", "border", "destructive", "success", "warning", "info", "brand-violet", "brand-flame", "brand-sky", "brand-teal"];

export function Theming() {
  const tr = useTr();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, direction } = useLocale();
  return (
    <div className="space-y-12">
      <Section title={l("Switch theme and language", "تبديل السمة واللغة")} description={l("Everything below — and every page — follows these. Arabic switches the whole page to right-to-left.", "كل ما يلي — وكل صفحة — يتبعهما. العربية تقلب الصفحة كلها من اليمين إلى اليسار.")}>
        <Example code={`import { ThemeProvider, useTheme, useLocale } from "@solvfast/ui";

<ThemeProvider defaultTheme="light" defaultLanguage="ar">{app}</ThemeProvider>

const { theme, setTheme, toggleTheme } = useTheme();
const { language, direction, setLanguage, t } = useLocale();`}>
          <div className="flex flex-wrap items-center gap-6">
            <Cell label={`theme: "${theme}"`}>
              <div className="flex gap-2">
                <Button variant={theme === "light" ? "default" : "outline"} size="sm" onClick={() => setTheme("light")}>{tr(l("Light", "فاتح"))}</Button>
                <Button variant={theme === "dark" ? "default" : "outline"} size="sm" onClick={() => setTheme("dark")}>{tr(l("Dark", "داكن"))}</Button>
              </div>
            </Cell>
            <Cell label={`language: "${language}" · direction: "${direction}"`}>
              <div className="flex gap-2">
                <Button variant={language === "en" ? "default" : "outline"} size="sm" onClick={() => setLanguage("en")}>English</Button>
                <Button variant={language === "ar" ? "default" : "outline"} size="sm" onClick={() => setLanguage("ar")}>العربية</Button>
              </div>
            </Cell>
          </div>
        </Example>
        <Props rows={[
          ["defaultTheme / defaultLanguage", '"light" | "dark" · "en" | "ar"', l("Starting values when nothing is stored.", "القيم الابتدائية عند عدم وجود قيم محفوظة.")],
          ["theme / language", "controlled", l("Drive it from your app's own state (with onThemeChange / onLanguageChange).", "تحكّم بها من حالة تطبيقك (مع onThemeChange و onLanguageChange).")],
          ["storageKeys", "{ theme, language } | null", l("Where the choice is remembered; null keeps nothing.", "مكان حفظ الاختيار؛ null لا يحفظ شيئاً.")],
          ["scope", '"document" | "element"', l("Theme the whole page (default) or only a wrapper, with popups inside it.", "تطبيق السمة على الصفحة كلها (افتراضياً) أو على حاوية فقط مع النوافذ المنبثقة بداخلها.")],
          ["messages", "Partial<Messages> per language", l("Override any built-in string.", "استبدال أي نص مدمج.")],
        ]} />
      </Section>

      <Section title={l("Colour tokens", "رموز الألوان")} description={l("Semantic and brand tokens as CSS variables (HSL). Use them through Tailwind classes such as bg-primary or text-muted-foreground; they change with the theme.", "رموز دلالية ورموز العلامة كمتغيّرات CSS ‏(HSL). استخدمها عبر أصناف Tailwind مثل bg-primary و text-muted-foreground؛ تتغيّر مع السمة.")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {TOKENS.map((t) => (
            <div key={t} className="overflow-hidden rounded-xl border border-border">
              <div className="h-14" style={{ background: `hsl(var(--${t}))` }} />
              <div className="px-3 py-2 font-mono text-[11px] text-muted-foreground" dir="ltr">--{t}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={l("Type roles", "أدوار الخطوط")} description={l("Zain for display and headings · Geist for interface text (Arabic falls back to IBM Plex Sans Arabic) · Geist Mono for data. The fonts are not bundled; load them in index.html.", "‏Zain للعناوين والعرض · Geist لنصوص الواجهة (العربية تستخدم IBM Plex Sans Arabic) · Geist Mono للبيانات. الخطوط غير مضمّنة؛ حمّلها في index.html.")}>
        <Example className="space-y-4">
          <p className="font-brand text-4xl font-bold text-foreground">{tr(l("Display — font-brand", "العرض — font-brand"))}</p>
          <p className="font-sans text-base text-foreground">{tr(l("Interface text — font-sans. The quick brown fox jumps over the lazy dog.", "نص الواجهة — font-sans. نص تجريبي لعرض شكل الخط العربي في الواجهة."))}</p>
          <p className="font-mono text-sm text-muted-foreground" dir="ltr">Data — font-mono · 2026-10-17 · 1,234.50</p>
        </Example>
      </Section>
    </div>
  );
}
