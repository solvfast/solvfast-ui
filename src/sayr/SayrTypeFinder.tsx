/**
 * SayrTypeFinder — "Not sure? Find the right type": walks a Sayr decision tree (Routing) one answer at a time, with
 * Back and Start over. When it ends on a type this page offers, "Use this type" picks it; an outcome outside the offered
 * types (another registry, or a type that is not offered here) only warns, and the type stays empty.
 */
import * as React from "react";
import { AlertTriangle, Compass, RotateCcw, Undo2 } from "lucide-react";
import { Button } from "../primitives/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../primitives/dialog";
import { Skeleton } from "../primitives/skeleton";
import { fmt } from "../record/format";
import { useLocale } from "../theme/ThemeProvider";
import { useFrappeApi } from "../frappe/FrappeProvider";
import type { FamilyType } from "../frappe/family/family";
import { WALK_TREE_METHOD, type TreeStep } from "./recordPage";

export interface SayrTypeFinderProps {
  /** The decision tree to walk (`Sear Decision Tree` name). */
  tree: string;
  /** The family's registry: an outcome in another registry is not a type of this page. */
  registry: string;
  /** The types offered here. */
  types: FamilyType[];
  onChoose: (type: string) => void;
}

export function SayrTypeFinder({ tree, registry, types, onChoose }: SayrTypeFinderProps) {
  const { t, language } = useLocale();
  const api = useFrappeApi();
  const [open, setOpen] = React.useState(false);
  const [answers, setAnswers] = React.useState<string[]>([]);
  const [step, setStep] = React.useState<TreeStep | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);
  const text = (en?: string | null, ar?: string | null) => (language === "ar" && ar ? ar : en || ar || "");

  React.useEffect(() => {
    if (!open) return;
    let live = true;
    setStep(null);
    setFailed(null);
    api.call(WALK_TREE_METHOD, { tree, answers: JSON.stringify(answers) }).then(
      (r) => live && setStep(r.message as TreeStep),
      (e) => live && setFailed((e as Error).message),
    );
    return () => { live = false; };
  }, [api, tree, answers, open]);

  const offered = step?.kind === "outcome" && step.registry_doctype === registry ? types.find((x) => x.name === step.type) : undefined;
  const typeLabel = (x: FamilyType) => (typeof x.label === "string" ? x.label : text(x.label.en, x.label.ar));

  return (
    <>
      <button type="button" onClick={() => { setAnswers([]); setOpen(true); }} data-type-finder
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
        <Compass className="h-3.5 w-3.5" aria-hidden />{t("tfNotSure")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("tfTitle")}</DialogTitle>
            <DialogDescription>{t("tfIntro")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4" data-type-finder-step={step?.kind ?? (failed ? "error" : "loading")}>
            {failed ? <p role="alert" className="text-sm text-destructive">{failed}</p>
              : !step ? <Skeleton className="h-24" />
              : step.kind === "question" ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium">{text(step.question_en, step.question_ar)}</p>
                  <div className="grid gap-2">
                    {step.options.map((o) => (
                      <Button key={o.option_id} type="button" variant="outline" className="justify-start"
                        onClick={() => setAnswers((a) => [...a, o.option_id])}>{text(o.label_en, o.label_ar)}</Button>
                    ))}
                  </div>
                </div>
              ) : step.kind === "outcome" ? (offered ? (
                <div className="space-y-3">
                  <p className="text-sm">{fmt(t("tfFound"), typeLabel(offered))}</p>
                  <Button type="button" onClick={() => { onChoose(offered.name); setOpen(false); }}>{t("tfUse")}</Button>
                </div>
              ) : (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm" data-type-finder-warning>
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
                  <span>{fmt(t("tfNotHere"), step.type)}</span>
                </div>
              )) : <p role="alert" className="text-sm text-destructive">{step.message}</p>}
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <Button type="button" variant="ghost" size="sm" className="gap-1.5" disabled={!answers.length}
                onClick={() => setAnswers((a) => a.slice(0, -1))}><Undo2 className="h-3.5 w-3.5" aria-hidden />{t("tfBack")}</Button>
              <Button type="button" variant="ghost" size="sm" className="gap-1.5" disabled={!answers.length}
                onClick={() => setAnswers([])}><RotateCcw className="h-3.5 w-3.5" aria-hidden />{t("tfRestart")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
