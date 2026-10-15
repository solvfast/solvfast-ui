/**
 * @solvfast/ui — core entry. Explicit, intentional exports only (architecture §3).
 * This entry must never import the Frappe layer or @tanstack/* (enforced by scripts/check-boundaries.mjs).
 */

// Theme
export { ThemeProvider, useTheme, useLocale, usePortalContainer } from "./theme/ThemeProvider";
export type { Theme, Direction, StorageKeys, ThemeProviderProps } from "./theme/ThemeProvider";
export { defaultMessages } from "./theme/messages";
export type { Language, Messages } from "./theme/messages";

// Utilities
export { cn } from "./lib/cn";

// Primitives (vendored from DS v0.3.0 with Sear's effective look — VENDORED.md)
export { Button, buttonVariants } from "./primitives/button";
export type { ButtonProps } from "./primitives/button";
export { Input } from "./primitives/input";
export { Textarea } from "./primitives/textarea";
export { Label } from "./primitives/label";
export { Badge, badgeVariants } from "./primitives/badge";
export type { BadgeProps } from "./primitives/badge";
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from "./primitives/card";
export {
  Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator,
  SelectScrollUpButton, SelectScrollDownButton,
} from "./primitives/select";
export { Checkbox } from "./primitives/checkbox";
export { Switch } from "./primitives/switch";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./primitives/tabs";
export { Separator } from "./primitives/separator";
export { Avatar, AvatarImage, AvatarFallback } from "./primitives/avatar";
export { Skeleton } from "./primitives/skeleton";
export { ScrollArea, ScrollBar } from "./primitives/scroll-area";
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./primitives/tooltip";
export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from "./primitives/popover";
export {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem,
  DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuGroup,
  DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuRadioGroup,
} from "./primitives/dropdown-menu";
export {
  Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut,
  CommandSeparator,
} from "./primitives/command";
export {
  Dialog, DialogPortal, DialogOverlay, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogFooter,
  DialogTitle, DialogDescription,
} from "./primitives/dialog";
export {
  AlertDialog, AlertDialogPortal, AlertDialogOverlay, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "./primitives/alert-dialog";
export {
  Sheet, SheetPortal, SheetOverlay, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle,
  SheetDescription,
} from "./primitives/sheet";
export { Calendar } from "./primitives/calendar";
export { DateField, TimeField, DateTimeField } from "./primitives/date-time-field";
