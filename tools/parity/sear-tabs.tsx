/** Reference Tabs: what Sear renders for a tab strip — Radix Tabs as the content host and Sear's REAL SegmentedTabs as
 *  the strip (the pattern of sear_studio/pages/Routing/DecisionTreeEditorPage.tsx). Same props as the package's Tabs, so
 *  the shared playground pages render unchanged. Read-only. */
import * as React from "react";
import { Tabs as DsTabs, TabsContent } from "@/components/ui/tabs";
import { SegmentedTabs } from "@sear/components/SegmentedTabs";
import { useApp } from "@/contexts/AppContext";

const Ctx = React.createContext<{ value: string; set: (v: string) => void }>({ value: "", set: () => {} });

export function Tabs({ defaultValue, value, onValueChange, children, ...rest }: React.ComponentProps<typeof DsTabs>) {
  const [inner, setInner] = React.useState(defaultValue ?? "");
  const v = value ?? inner;
  const set = (x: string) => { setInner(x); onValueChange?.(x); };
  return <Ctx.Provider value={{ value: v, set }}><DsTabs value={v} onValueChange={set} {...rest}>{children}</DsTabs></Ctx.Provider>;
}

type TriggerProps = { value: string; children?: React.ReactNode; disabled?: boolean; className?: string };
export function TabsList({ children, className, "aria-label": ariaLabel }: { children?: React.ReactNode; className?: string; "aria-label"?: string }) {
  const { value, set } = React.useContext(Ctx);
  const { direction } = useApp();
  const items = React.Children.toArray(children).filter(React.isValidElement).map((c) => {
    const p = (c as React.ReactElement<TriggerProps>).props;
    return { key: p.value, label: p.children, disabled: p.disabled };
  });
  return <SegmentedTabs isRTL={direction === "rtl"} items={items} value={value} onChange={set} ariaLabel={ariaLabel ?? ""} className={className} />;
}
export function TabsTrigger(_: TriggerProps) { return null; }
export { TabsContent };
