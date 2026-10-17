import * as React from "react";
import { ExternalLink } from "lucide-react";
import { AppSwitcher, Button, NotificationPanel, useLocale, useTheme } from "@ui";
import { SWITCHER_SECTIONS, seedNotifications, workspaceLogo } from "../../../playground/src/demo/sear-demo";
import { Example, Props, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";

export function AppShellPage() {
  const tr = useTr();
  const { theme } = useTheme();
  const { language } = useLocale();
  return (
    <div className="space-y-12">
      <Section title={l("Sear Studio's shell", "هيكل استوديو سير")} description={l("Collapse the sidebar rail, open the app switcher (the grid button) and the notifications, switch language and theme in the top bar, and narrow the window for the mobile bottom navigation.", "اطوِ الشريط الجانبي، وافتح مبدّل التطبيقات (زر الشبكة) والإشعارات، وبدّل اللغة والسمة من الشريط العلوي، وضيّق النافذة لترى تنقّل الجوال السفلي.")}>
        <div className="flex justify-end">
          <Button asChild variant="outline" size="sm" className="gap-1.5"><a href="#/demo/app-shell"><ExternalLink className="h-4 w-4" />{tr(l("Open full screen", "فتح بملء الشاشة"))}</a></Button>
        </div>
        <Example className="p-0" code={`<AppShell
  brand={{ name: "Sayr Studio", logoSrc, href: "/workspace" }}
  items={NAV_ITEMS}                       // NavItem[]: { id, href, icon, label: { en, ar }, children? }
  currentPath={path}
  onNavigate={(href) => router.push(href)}
  switcher={{ sections, currentAppId: "sear-studio", home: { href: "/workspace" }, exit: { href: "/workspace" } }}
  notifications={{ items, onItemClick, onMarkAllRead }}
  mobile={{ exit: { href: "/workspace" } }}
>
  {page}
</AppShell>`}>
          {/* keyed so the frame reloads with the showcase's theme and language */}
          <iframe key={`${theme}-${language}`} src="./#/demo/app-shell" title={tr(l("App shell demo", "عرض هيكل التطبيق"))} className="block h-[640px] w-full" />
        </Example>
        <Props rows={[
          ["brand · items · currentPath · onNavigate", "", l("Identity, navigation tree, the active path, and your router. The shell never navigates by itself.", "الهوية وشجرة التنقّل والمسار النشط والموجّه الخاص بك. الهيكل لا ينتقل من تلقاء نفسه.")],
          ["switcher", "{ sections, currentAppId, home, exit }", l("The app switcher in the sidebar header.", "مبدّل التطبيقات في رأس الشريط الجانبي.")],
          ["notifications", "{ items, onItemClick, onMarkAllRead }", l("The bell and its panel.", "الجرس ولوحته.")],
          ["collapsed · defaultCollapsed · collapsedStorageKey", "", l("Rail state, controlled or remembered.", "حالة الشريط، متحكَّم بها أو محفوظة.")],
          ["title · sidebarBody · search · help · actions", "", l("Override the page title, replace the nav list, and add top-bar parts.", "تجاوز عنوان الصفحة واستبدال قائمة التنقّل وإضافة أجزاء للشريط العلوي.")],
        ]} />
      </Section>
    </div>
  );
}

export function ShellPartsPage() {
  const tr = useTr();
  const [went, setWent] = React.useState("");
  const [items, setItems] = React.useState(() => seedNotifications());
  return (
    <div className="space-y-12">
      <Section title={l("App switcher", "مبدّل التطبيقات")} description={l("Grouped apps, the current one marked, a home row, the theme item and an exit row. It reports the chosen href; your app navigates.", "تطبيقات مجمّعة مع تمييز الحالي، وصف للرئيسية وعنصر السمة وصف للخروج. يُبلغ بالرابط المختار؛ وتطبيقك ينتقل.")}>
        <Example center code={`<AppSwitcher sections={sections} currentAppId="sear-studio"
  home={{ href: "/workspace" }} exit={{ href: "/workspace", iconSrc }}
  onNavigate={(href) => router.push(href)} />`}>
          <AppSwitcher sections={SWITCHER_SECTIONS} currentAppId="sear-studio" home={{ href: "/workspace" }} exit={{ href: "/workspace", iconSrc: workspaceLogo }} onNavigate={setWent} />
          <span className="font-mono text-xs text-muted-foreground" dir="ltr">{went ? `onNavigate("${went}")` : ""}</span>
        </Example>
      </Section>
      <Section title={l("Notification panel", "لوحة الإشعارات")} description={l("Unread count on the bell; the panel groups by time (today, yesterday, earlier), filters unread, and marks all read.", "عدد غير المقروء على الجرس؛ اللوحة تجمّع حسب الوقت (اليوم، أمس، سابقاً)، وتصفّي غير المقروء، وتعلّم الكل كمقروء.")}>
        <Example center code={`<NotificationPanel items={items} top={80}
  onItemClick={(n) => markRead(n.id)} onMarkAllRead={markAllRead} />`}>
          <NotificationPanel items={items} top={80}
            onItemClick={(n) => setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read: true } : x)))}
            onMarkAllRead={() => setItems((xs) => xs.map((x) => ({ ...x, read: true })))} />
          <Button variant="ghost" size="xs" onClick={() => setItems(seedNotifications())}>{tr(l("Reset", "إعادة الضبط"))}</Button>
        </Example>
      </Section>
    </div>
  );
}
