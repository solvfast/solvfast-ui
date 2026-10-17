// Vendored from @solvfast/design-system v0.3.0 (92fc1cd) frontend/src/components/ui/tabs.tsx — see VENDORED.md.
import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "../lib/cn"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      // Sear's SegmentedTabs rail (sear_studio/components/SegmentedTabs.tsx): a liquid-glass pill.
      // Full width: className="flex w-full" here and "min-w-0 flex-1" on each trigger.
      "sf-glass inline-flex gap-1 !rounded-full p-1",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // Sear's SegmentedTabs pill: the active tab is primary text (no fill); hover only on enabled inactive tabs.
      // Compact: className="text-xs [&_svg]:size-3.5".
      "inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed [&_svg]:size-4 [&_svg]:shrink-0 data-[state=active]:font-medium data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground data-[state=inactive]:enabled:hover:text-foreground data-[disabled]:data-[state=inactive]:text-muted-foreground/40",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
