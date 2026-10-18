/** Table, RadioGroup, Stepper and a toast, rendered by BOTH the playground (the package) and the Sear reference
 *  (tools/parity: Sear's real components, through the same `@ui` names). Playground only. */
import { Button, Label, RadioGroup, RadioGroupItem, Stepper, Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow, useLocale } from "@ui";
import { Toaster, toast } from "@ui/toast";

export function ExtrasPage() {
  const { isRTL } = useLocale();
  const L = (en: string, ar: string) => (isRTL ? ar : en);
  const rows = [["INV-001", L("Paid", "مدفوعة"), "250.00"], ["INV-002", L("Pending", "معلّقة"), "150.00"], ["INV-003", L("Unpaid", "غير مدفوعة"), "350.00"]];
  return (
    <div className="space-y-8 p-6">
      <div data-testid="table" className="max-w-xl">
        <Table>
          <TableCaption>{L("Recent invoices", "أحدث الفواتير")}</TableCaption>
          <TableHeader>
            <TableRow><TableHead>{L("Invoice", "الفاتورة")}</TableHead><TableHead>{L("Status", "الحالة")}</TableHead><TableHead className="text-end">{L("Amount", "المبلغ")}</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(([id, status, amount]) => (
              <TableRow key={id}><TableCell className="font-medium">{id}</TableCell><TableCell>{status}</TableCell><TableCell className="text-end tabular-nums">{amount}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div data-testid="radio" className="w-64">
        <RadioGroup defaultValue="monthly" aria-label={L("Billing", "الفوترة")}>
          {[["monthly", L("Monthly", "شهري")], ["yearly", L("Yearly", "سنوي")], ["lifetime", L("Lifetime", "مدى الحياة")]].map(([v, label]) => (
            <div key={v} className="flex items-center gap-2">
              <RadioGroupItem value={v} id={`r-${v}`} disabled={v === "lifetime"} />
              <Label htmlFor={`r-${v}`}>{label}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>
      <div data-testid="stepper">
        <Stepper ariaLabel={L("Setup", "الإعداد")} steps={[
          { label: L("Account", "الحساب"), state: "done" },
          { label: L("Channels", "القنوات"), state: "error", note: L("2 fields missing", "حقلان ناقصان"), srNote: L("this step has errors", "هذه الخطوة فيها أخطاء") },
          { label: L("Routing", "التوجيه"), state: "current" },
          { label: L("Review", "المراجعة"), state: "upcoming" },
        ]} />
      </div>
      <Button data-testid="toast-trigger" onClick={() => toast(L("Preset saved", "تم حفظ المجموعة"), { description: L("11 fields in 3 sections.", "11 حقلاً في 3 أقسام."), duration: Infinity })}>
        {L("Show toast", "إظهار تنبيه")}
      </Button>
      <Toaster />
    </div>
  );
}
