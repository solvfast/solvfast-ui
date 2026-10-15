/** Page body rendered inside the shell by BOTH the playground and the Sear reference (same JSX, `@ui` differs). */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ui";

export function ShellPage({ isAr }: { isAr: boolean }) {
  const L = (en: string, ar: string) => (isAr ? ar : en);
  return (
    <div className="space-y-6 px-6 py-6 md:px-8" data-testid="shell-page">
      <p className="text-sm text-muted-foreground">{L("Configure the building blocks of your workspace.", "اضبط مكوّنات مساحة العمل.")}</p>
      <div className="grid gap-4 md:grid-cols-3">
        {[["Fields", "الحقول", "128"], ["Calendars", "التقاويم", "6"], ["Channels", "القنوات", "4"]].map(([en, ar, n]) => (
          <Card key={en}>
            <CardHeader>
              <CardDescription>{L(en, ar)}</CardDescription>
              <CardTitle className="text-3xl">{n}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{L("Last updated today", "آخر تحديث اليوم")}</CardContent>
          </Card>
        ))}
      </div>
      {Array.from({ length: 8 }, (_, i) => (
        <Card key={i} className="p-4 text-sm">{L(`Row ${i + 1} — content scrolls under the glass header.`, `الصف ${i + 1} — يمر المحتوى تحت الشريط الزجاجي.`)}</Card>
      ))}
    </div>
  );
}
