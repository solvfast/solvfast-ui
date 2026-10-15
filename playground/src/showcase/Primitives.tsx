/**
 * Primitive showcase — rendered by BOTH the playground (@ui = this package) and tools/parity (@ui = Sear's real
 * components + CSS), so every pixel difference between the two screenshots is a real difference.
 * Keep it deterministic: no animation-dependent content, no random data, fixed dates.
 */
import * as React from "react";
import { Bell, Globe, Moon, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import {
  Avatar, AvatarFallback, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox,
  DateField, DateTimeField, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  Input, Label, Popover, PopoverContent, PopoverTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Separator, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, Skeleton, Switch, Tabs,
  TabsContent, TabsList, TabsTrigger, Textarea, TimeField, Command, CommandInput, CommandList, CommandItem, CommandGroup,
} from "@ui";

const VARIANTS = ["default", "secondary", "outline", "ghost", "destructive", "ai-outline"] as const;
const SIZES = ["xs", "sm", "default"] as const;

export function Primitives({ isAr }: { isAr: boolean }) {
  // Today, so the calendar opens on the same month in both builds (the package also opens on the selected
  // date's month — PMO behaviour — which would otherwise show as a parity difference).
  const today = React.useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }, []);
  const [date, setDate] = React.useState(today);
  const [time, setTime] = React.useState("09:30");
  const [dt, setDt] = React.useState(`${today}T09:30`);
  const L = (en: string, ar: string) => (isAr ? ar : en);

  return (
    <div className="space-y-6 p-8" data-testid="showcase">
      <section className="space-y-3" data-testid="buttons">
        <h2 className="text-xl font-bold">{L("Buttons", "الأزرار")}</h2>
        {SIZES.map((size) => (
          <div key={size} className="flex flex-wrap items-center gap-3">
            {VARIANTS.map((v) => (
              <Button key={v} variant={v} size={size}>{v === "ai-outline" ? <Sparkles /> : null}{L(v, `زر ${v}`)}</Button>
            ))}
            <Button size={size} disabled>{L("Disabled", "معطّل")}</Button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <Button size="icon"><Plus /></Button>
          <Button variant="outline" size="icon-sm"><Search /></Button>
          {/* the Sear shell icon-button treatment */}
          <Button variant="ghost" size="icon-sm" className="!rounded-lg text-muted-foreground hover:bg-muted" aria-label="bell"><Bell className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon-sm" className="!rounded-lg text-muted-foreground hover:bg-muted" aria-label="globe"><Globe className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon-sm" className="!rounded-lg text-muted-foreground hover:bg-muted" aria-label="moon"><Moon className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon-sm" className="!rounded-lg !border-destructive/25 text-destructive" aria-label="delete"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-6" data-testid="fields">
        <div className="space-y-2">
          <Label htmlFor="sc-name">{L("Name", "الاسم")}</Label>
          <Input id="sc-name" placeholder={L("Type a name…", "اكتب اسماً…")} />
          <Input defaultValue={L("Field Library", "مكتبة الحقول")} />
          <Textarea placeholder={L("Description", "الوصف")} />
        </div>
        <div className="space-y-2">
          <Label>{L("Status", "الحالة")}</Label>
          <Select defaultValue="open">
            <SelectTrigger data-testid="select-trigger"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">{L("Open", "مفتوح")}</SelectItem>
              <SelectItem value="closed">{L("Closed", "مغلق")}</SelectItem>
              <SelectItem value="draft">{L("Draft", "مسودة")}</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2"><Checkbox id="c1" defaultChecked /><Label htmlFor="c1">{L("Checked", "محدد")}</Label></div>
          <div className="flex items-center gap-2"><Checkbox id="c2" /><Label htmlFor="c2">{L("Unchecked", "غير محدد")}</Label></div>
          <div className="flex items-center gap-2"><Switch defaultChecked /><Switch /></div>
        </div>
        <div className="space-y-2">
          <Label>{L("Date", "التاريخ")}</Label>
          <div data-testid="date-field"><DateField value={date} onChange={setDate} /></div>
          <Label>{L("Time", "الوقت")}</Label>
          <TimeField value={time} onChange={setTime} />
          <Label>{L("Date & time", "التاريخ والوقت")}</Label>
          <DateTimeField value={dt} onChange={setDt} />
        </div>
      </section>

      <section className="grid grid-cols-3 gap-6" data-testid="surfaces">
        <Card>
          <CardHeader>
            <CardTitle>{L("Card title", "عنوان البطاقة")}</CardTitle>
            <CardDescription>{L("Glass pane, airy tier.", "زجاج شفاف.")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge>{L("Default", "افتراضي")}</Badge>
              <Badge variant="secondary">{L("Secondary", "ثانوي")}</Badge>
              <Badge variant="outline">{L("Outline", "محدد")}</Badge>
              <Badge variant="destructive">{L("Error", "خطأ")}</Badge>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <Avatar><AvatarFallback>SF</AvatarFallback></Avatar>
              <Skeleton className="h-4 w-32" />
            </div>
          </CardContent>
        </Card>
        <Card className="p-4">
          <Tabs defaultValue="a">
            <TabsList>
              <TabsTrigger value="a">{L("Overview", "نظرة عامة")}</TabsTrigger>
              <TabsTrigger value="b">{L("Fields", "الحقول")}</TabsTrigger>
            </TabsList>
            <TabsContent value="a" className="pt-3 text-sm text-muted-foreground">{L("Tab content", "محتوى التبويب")}</TabsContent>
          </Tabs>
        </Card>
        <Card className="p-4">
          <Command className="rounded-xl">
            <CommandInput placeholder={L("Search…", "بحث...")} />
            <CommandList>
              <CommandGroup heading={L("Suggestions", "اقتراحات")}>
                <CommandItem>{L("Calendar", "التقويم")}</CommandItem>
                <CommandItem>{L("Settings", "الإعدادات")}</CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </Card>
      </section>

      <section className="flex flex-wrap items-start gap-3" data-testid="overlays">
        <Popover>
          <PopoverTrigger asChild><Button variant="outline" data-testid="popover-trigger">{L("Popover", "منبثق")}</Button></PopoverTrigger>
          <PopoverContent>
            <p className="text-sm font-medium">{L("Popover title", "عنوان")}</p>
            <p className="text-sm text-muted-foreground">{L("Liquid glass surface.", "سطح زجاجي.")}</p>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild><Button variant="outline" data-testid="popover-command-trigger">{L("Picker", "منتقي")}</Button></PopoverTrigger>
          <PopoverContent className="w-64 p-0">
            <Command>
              <CommandInput placeholder={L("Search…", "بحث...")} />
              <CommandList>
                <CommandGroup>
                  <CommandItem>{L("Alpha", "ألفا")}</CommandItem>
                  <CommandItem>{L("Beta", "بيتا")}</CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" data-testid="menu-trigger">{L("Menu", "قائمة")}</Button></DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>{L("Actions", "إجراءات")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>{L("Edit", "تعديل")}</DropdownMenuItem>
            <DropdownMenuItem>{L("Duplicate", "تكرار")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog>
          <DialogTrigger asChild><Button variant="outline" data-testid="dialog-trigger">{L("Dialog", "حوار")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{L("Dialog title", "عنوان الحوار")}</DialogTitle>
              <DialogDescription>{L("Dialog description.", "وصف الحوار.")}</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
        <Sheet>
          <SheetTrigger asChild><Button variant="outline" data-testid="sheet-trigger">{L("Sheet", "لوحة")}</Button></SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{L("Sheet title", "عنوان اللوحة")}</SheetTitle>
              <SheetDescription>{L("Sheet description.", "وصف اللوحة.")}</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      </section>
    </div>
  );
}
