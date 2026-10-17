import * as React from "react";
import { Calendar as CalendarIcon, Copy, FileText, LogOut, MoreHorizontal, Pencil, Plus, Settings, Trash2, User } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, Button, Command, CommandDialog, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut, Dialog, DialogClose, DialogContent,
  DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DropdownMenu, DropdownMenuCheckboxItem,
  DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuTrigger, Input, Label, Popover, PopoverContent, PopoverTrigger, Sheet, SheetClose,
  SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from "@ui";
import { Example, Section } from "../doc/Doc";
import { l, useTr } from "../i18n";

export function DialogPage() {
  const tr = useTr();
  return (
    <div className="space-y-12">
      <Section title={l("Dialog", "مربع الحوار")} description={l("For a short, focused task. Focus moves into the dialog and returns when it closes; Escape closes it.", "لمهمة قصيرة مركّزة. ينتقل التركيز إلى الحوار ويعود عند إغلاقه؛ مفتاح Escape يغلقه.")}>
        <Example center code={`<Dialog>
  <DialogTrigger asChild><Button>Rename</Button></DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Rename preset</DialogTitle>
      <DialogDescription>The new name shows everywhere the preset is used.</DialogDescription>
    </DialogHeader>
    <Input defaultValue="Corporate booking" />
    <DialogFooter>
      <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
      <Button>Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>`}>
          <Dialog>
            <DialogTrigger asChild><Button className="gap-2"><Pencil className="h-4 w-4" />{tr(l("Rename", "إعادة التسمية"))}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{tr(l("Rename preset", "إعادة تسمية المجموعة"))}</DialogTitle>
                <DialogDescription>{tr(l("The new name shows everywhere the preset is used.", "يظهر الاسم الجديد أينما استُخدمت المجموعة."))}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-1.5"><Label htmlFor="sc-rename">{tr(l("Name", "الاسم"))}</Label><Input id="sc-rename" defaultValue={tr(l("Corporate booking", "حجز الشركات"))} /></div>
              <DialogFooter className="gap-2">
                <DialogClose asChild><Button variant="outline">{tr(l("Cancel", "إلغاء"))}</Button></DialogClose>
                <DialogClose asChild><Button>{tr(l("Save", "حفظ"))}</Button></DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Example>
      </Section>
    </div>
  );
}

export function AlertDialogPage() {
  const tr = useTr();
  const [deleted, setDeleted] = React.useState(0);
  return (
    <div className="space-y-12">
      <Section title={l("Confirm a destructive action", "تأكيد إجراء هدّام")} description={l("The app does the work in the action's handler; the dialog only asks. Pass the destructive Button with asChild to keep it red.", "ينفّذ التطبيق العمل في معالج الإجراء؛ الحوار يسأل فقط. مرّر زراً destructive مع asChild ليبقى أحمر.")}>
        <Example center code={`<AlertDialog>
  <AlertDialogTrigger asChild><Button variant="destructive">Delete</Button></AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete this preset?</AlertDialogTitle>
      <AlertDialogDescription>Forms that use it keep their fields.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction asChild><Button variant="destructive" onClick={remove}>Delete</Button></AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>`}>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="destructive" className="gap-2"><Trash2 className="h-4 w-4" />{tr(l("Delete", "حذف"))}</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{tr(l("Delete this preset?", "حذف هذه المجموعة؟"))}</AlertDialogTitle>
                <AlertDialogDescription>{tr(l("Forms that use it keep their fields.", "النماذج التي تستخدمها تحتفظ بحقولها."))}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tr(l("Cancel", "إلغاء"))}</AlertDialogCancel>
                <AlertDialogAction asChild><Button variant="destructive" onClick={() => setDeleted((n) => n + 1)}>{tr(l("Delete", "حذف"))}</Button></AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <span className="text-sm text-muted-foreground">{tr(l("Confirmed:", "تم التأكيد:"))} <span dir="ltr">{deleted}</span></span>
        </Example>
      </Section>
    </div>
  );
}

export function SheetPage() {
  const tr = useTr();
  const sides = [
    ["right", l("End", "النهاية")], ["left", l("Start", "البداية")], ["top", l("Top", "الأعلى")], ["bottom", l("Bottom", "الأسفل")],
  ] as const;
  return (
    <div className="space-y-12">
      <Section title={l("Edges", "الحواف")} description={l("Sides are logical: \"right\" is the end edge and \"left\" the start edge, so in Arabic the panels mirror on their own.", "الجوانب منطقية: \"right\" هو حافة النهاية و \"left\" حافة البداية، لذا تنعكس اللوحات تلقائياً في العربية.")}>
        <Example center code={`<Sheet>
  <SheetTrigger asChild><Button variant="outline">Filters</Button></SheetTrigger>
  <SheetContent side="right">   {/* the end edge: right in English, left in Arabic */}
    <SheetHeader><SheetTitle>Filters</SheetTitle><SheetDescription>…</SheetDescription></SheetHeader>
  </SheetContent>
</Sheet>`}>
          {sides.map(([side, name]) => {
            return (
              <Sheet key={side}>
                <SheetTrigger asChild><Button variant="outline">{tr(name)}</Button></SheetTrigger>
                <SheetContent side={side}>
                  <SheetHeader className="text-start">
                    <SheetTitle>{tr(l("Filters", "عوامل التصفية"))}</SheetTitle>
                    <SheetDescription>{tr(l("Narrow the list without leaving the page.", "ضيّق القائمة دون مغادرة الصفحة."))}</SheetDescription>
                  </SheetHeader>
                  <div className="grid gap-1.5 py-4"><Label htmlFor={`sc-sheet-${side}`}>{tr(l("Owner", "المالك"))}</Label><Input id={`sc-sheet-${side}`} placeholder="sara@example.com" /></div>
                  <SheetFooter><SheetClose asChild><Button>{tr(l("Apply", "تطبيق"))}</Button></SheetClose></SheetFooter>
                </SheetContent>
              </Sheet>
            );
          })}
        </Example>
      </Section>
    </div>
  );
}

export function PopoverPage() {
  const tr = useTr();
  return (
    <div className="space-y-12">
      <Section title={l("Popover", "النافذة المنبثقة")} description={l("Glass surface; when the user prefers reduced transparency, the blur is dropped and the surface turns more opaque.", "سطح زجاجي؛ عندما يفضّل المستخدم شفافية أقل يُزال التمويه ويصبح السطح أكثر عتامة.")}>
        <Example center code={`<Popover>
  <PopoverTrigger asChild><Button variant="outline">Dimensions</Button></PopoverTrigger>
  <PopoverContent className="w-72">…</PopoverContent>
</Popover>`}>
          <Popover>
            <PopoverTrigger asChild><Button variant="outline">{tr(l("Dimensions", "الأبعاد"))}</Button></PopoverTrigger>
            <PopoverContent className="w-72 space-y-3">
              <p className="text-sm font-medium">{tr(l("Card size", "حجم البطاقة"))}</p>
              {[l("Width", "العرض"), l("Height", "الارتفاع")].map((x) => (
                <div key={x.en} className="grid grid-cols-3 items-center gap-3"><Label htmlFor={`sc-pop-${x.en}`}>{tr(x)}</Label><Input id={`sc-pop-${x.en}`} className="col-span-2 h-8" defaultValue="320px" dir="ltr" /></div>
              ))}
            </PopoverContent>
          </Popover>
        </Example>
      </Section>
    </div>
  );
}

export function DropdownPage() {
  const tr = useTr();
  const [compact, setCompact] = React.useState(false);
  const [sort, setSort] = React.useState("modified");
  return (
    <div className="space-y-12">
      <Section title={l("Actions, toggles and choices", "إجراءات ومفاتيح واختيارات")}>
        <Example center code={`<DropdownMenu>
  <DropdownMenuTrigger asChild><Button size="icon-sm" aria-label="More"><MoreHorizontal /></Button></DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuLabel>Preset</DropdownMenuLabel>
    <DropdownMenuItem>Duplicate</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuCheckboxItem checked={compact} onCheckedChange={setCompact}>Compact rows</DropdownMenuCheckboxItem>
    <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
      <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  </DropdownMenuContent>
</DropdownMenu>`}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon-sm" aria-label={tr(l("More", "المزيد"))}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{tr(l("Preset", "المجموعة"))}</DropdownMenuLabel>
              <DropdownMenuItem className="gap-2"><Pencil className="h-4 w-4" />{tr(l("Rename", "إعادة التسمية"))}</DropdownMenuItem>
              <DropdownMenuItem className="gap-2"><Copy className="h-4 w-4" />{tr(l("Duplicate", "تكرار"))}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={compact} onCheckedChange={(c) => setCompact(c === true)}>{tr(l("Compact rows", "صفوف مضغوطة"))}</DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{tr(l("Sort by", "ترتيب حسب"))}</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
                <DropdownMenuRadioItem value="name">{tr(l("Name", "الاسم"))}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="modified">{tr(l("Last modified", "آخر تعديل"))}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-destructive"><Trash2 className="h-4 w-4" />{tr(l("Delete", "حذف"))}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-sm text-muted-foreground" dir="ltr">compact: {String(compact)} · sort: {sort}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" className="gap-2"><User className="h-4 w-4" />Sara</Button></DropdownMenuTrigger>
            <DropdownMenuContent className="w-48">
              <DropdownMenuItem className="gap-2"><Settings className="h-4 w-4" />{tr(l("Settings", "الإعدادات"))}</DropdownMenuItem>
              <DropdownMenuItem className="gap-2"><LogOut className="h-4 w-4 rtl:rotate-180" />{tr(l("Sign out", "تسجيل الخروج"))}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Example>
      </Section>
    </div>
  );
}

export function CommandPage() {
  const tr = useTr();
  const [open, setOpen] = React.useState(false);
  const [picked, setPicked] = React.useState("");
  React.useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen((o) => !o); } };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, []);
  const items = (
    <>
      <CommandEmpty>{tr(l("No results.", "لا نتائج."))}</CommandEmpty>
      <CommandGroup heading={tr(l("Create", "إنشاء"))}>
        <CommandItem onSelect={() => { setPicked("new-preset"); setOpen(false); }}><Plus className="me-2 h-4 w-4" />{tr(l("New field preset", "مجموعة حقول جديدة"))}<CommandShortcut>⌘N</CommandShortcut></CommandItem>
        <CommandItem onSelect={() => { setPicked("new-calendar"); setOpen(false); }}><CalendarIcon className="me-2 h-4 w-4" />{tr(l("New calendar", "تقويم جديد"))}</CommandItem>
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading={tr(l("Go to", "انتقال إلى"))}>
        <CommandItem onSelect={() => { setPicked("templates"); setOpen(false); }}><FileText className="me-2 h-4 w-4" />{tr(l("Message templates", "قوالب الرسائل"))}</CommandItem>
        <CommandItem onSelect={() => { setPicked("settings"); setOpen(false); }}><Settings className="me-2 h-4 w-4" />{tr(l("Settings", "الإعدادات"))}</CommandItem>
      </CommandGroup>
    </>
  );
  return (
    <div className="space-y-12">
      <Section title={l("Inline", "مضمّنة")} description={l("Type to filter; arrow keys and Enter choose.", "اكتب للتصفية؛ الأسهم و Enter للاختيار.")}>
        <Example code={`<Command className="rounded-xl border">
  <CommandInput placeholder="Type a command…" />
  <CommandList>
    <CommandEmpty>No results.</CommandEmpty>
    <CommandGroup heading="Create">
      <CommandItem onSelect={create}>New field preset<CommandShortcut>⌘N</CommandShortcut></CommandItem>
    </CommandGroup>
  </CommandList>
</Command>`}>
          <Command className="max-w-md rounded-xl border border-border">
            <CommandInput placeholder={tr(l("Type a command…", "اكتب أمراً…"))} />
            <CommandList>{items}</CommandList>
          </Command>
        </Example>
      </Section>
      <Section title={l("As a dialog (⌘K / Ctrl+K)", "كحوار (‎⌘K‎ / ‎Ctrl+K‎)")}>
        <Example center code={`<CommandDialog open={open} onOpenChange={setOpen}>
  <CommandInput placeholder="Search…" />
  <CommandList>…</CommandList>
</CommandDialog>`}>
          <Button variant="outline" onClick={() => setOpen(true)}>{tr(l("Open the command palette", "فتح لوحة الأوامر"))} <span className="ms-2 font-mono text-xs text-muted-foreground" dir="ltr">⌘K</span></Button>
          <span className="text-sm text-muted-foreground" dir="ltr">{picked ? `picked: ${picked}` : ""}</span>
          <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder={tr(l("Search…", "بحث…"))} />
            <CommandList>{items}</CommandList>
          </CommandDialog>
        </Example>
      </Section>
    </div>
  );
}
