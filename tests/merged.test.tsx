// 0.3.0 — the merged components: every new export renders, with its roles/names, in both directions; popups portal into
// the theme scope; SearchCombobox's async loading; the rich-text sanitizer against XSS; PageHeader; the chart and form
// entries; and the DateField label fix.
import * as React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { Folder, Home, ListChecks } from "lucide-react";
import {
  AppShell, MobileNav, type NavItem,
  Accordion, AccordionContent, AccordionItem, AccordionTrigger, Alert, AlertDescription, AlertTitle, AspectRatio,
  Breadcrumb, BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
  Collapsible, CollapsibleContent, CollapsibleTrigger, ContextMenu, ContextMenuCheckboxItem, ContextMenuContent,
  ContextMenuItem, ContextMenuLabel, ContextMenuRadioGroup, ContextMenuRadioItem, ContextMenuSeparator, ContextMenuShortcut,
  ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger, DateField, DateTimeField, EditableTitle,
  HoverCard, HoverCardContent, HoverCardTrigger, Input, Label, Menubar, MenubarContent, MenubarItem, MenubarMenu,
  MenubarShortcut, MenubarSub, MenubarSubContent, MenubarSubTrigger, MenubarTrigger, NavigationMenu,
  NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger, PageHeader,
  Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, Pill,
  Progress, RichText, RichTextEditor, SearchCombobox, Slider, StatusDot, ThemeProvider, TimeField, Toggle, ToggleGroup,
  ToggleGroupItem, htmlIsEmpty, navigationMenuTriggerStyle, sanitizeHtml, toggleVariants, type ComboOption,
} from "../src";
import { ChartContainer, ChartLegendContent, ChartTooltipContent, type ChartConfig } from "../src/chart";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "../src/form";

const html = document.documentElement;
beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
beforeEach(() => { localStorage.clear(); html.className = ""; ["data-theme", "lang", "dir"].forEach((a) => html.removeAttribute(a)); });
afterEach(cleanup);

type Lang = "en" | "ar";
const inLang = (language: Lang, ui: React.ReactNode, theme: "light" | "dark" = "light") =>
  render(<ThemeProvider defaultLanguage={language} defaultTheme={theme} storageKeys={null}>{ui}</ThemeProvider>);
/** Element scope: popups must portal into the scope wrapper (where the tokens are) and carry `sf-popper`. */
const inScope = (ui: React.ReactNode, language: Lang = "en") =>
  render(<ThemeProvider scope="element" defaultLanguage={language} storageKeys={null}>{ui}</ThemeProvider>);
const scopeWrapper = () => document.querySelector(".sf-theme") as HTMLElement;
const expectInScopePopper = (el: HTMLElement) => {
  expect(scopeWrapper().contains(el)).toBe(true);
  expect(el.closest(".sf-popper")).toBeTruthy();
};

describe("simple DS primitives", () => {
  it("Alert: role alert, title and description, logical icon offset; destructive variant", () => {
    inLang("ar", (
      <Alert variant="destructive"><svg data-testid="icon" /><AlertTitle>تنبيه</AlertTitle><AlertDescription>نص</AlertDescription></Alert>
    ));
    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("[&>svg]:start-4");
    expect(alert.className).toContain("text-destructive");
    expect(within(alert).getByText("تنبيه").tagName).toBe("H5");
  });

  it("Progress: a progressbar with its value (the DS dropped it), filling from the reading start", () => {
    inLang("en", <Progress value={40} aria-label="Upload" />);
    let bar = screen.getByRole("progressbar", { name: "Upload" });
    expect(bar.getAttribute("aria-valuenow")).toBe("40");
    expect(bar.getAttribute("data-state")).toBe("loading");
    expect((bar.firstElementChild as HTMLElement).style.transform).toBe("translateX(-60%)");
    cleanup();
    inLang("ar", <Progress value={40} aria-label="رفع" />);
    bar = screen.getByRole("progressbar", { name: "رفع" });
    expect((bar.firstElementChild as HTMLElement).style.transform).toBe("translateX(60%)");
  });

  it("Toggle and ToggleGroup: pressed state; the group's arrow keys follow the reading direction", async () => {
    inLang("en", <Toggle aria-label="Bold">B</Toggle>);
    const t = screen.getByRole("button", { name: "Bold" });
    expect(t.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(t);
    expect(t.getAttribute("aria-pressed")).toBe("true");
    expect(toggleVariants({ variant: "outline", size: "sm" })).toContain("border-input");
    cleanup();
    inLang("ar", (
      <ToggleGroup type="single" defaultValue="left" aria-label="المحاذاة">
        <ToggleGroupItem value="left" aria-label="يسار">L</ToggleGroupItem>
        <ToggleGroupItem value="center" aria-label="وسط">C</ToggleGroupItem>
      </ToggleGroup>
    ));
    expect(screen.getByRole("radiogroup", { name: "المحاذاة" })).toBeTruthy(); // type="single"
    const [first, second] = screen.getAllByRole("radio");
    expect(first.getAttribute("aria-checked")).toBe("true");
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowLeft" }); // Arabic: left is next
    await waitFor(() => expect(document.activeElement).toBe(second));
  });

  it("StatusDot and Pill", () => {
    const { container } = inLang("en", <><StatusDot tone="success" label="Won" /><Pill>R Rana</Pill></>);
    expect(screen.getByText("Won").parentElement!.querySelector(".bg-success")).toBeTruthy();
    expect(screen.getByText("R Rana").className).toContain("rounded-full");
    expect(container.querySelectorAll("span").length).toBeGreaterThanOrEqual(3);
  });

  it("Accordion and Collapsible: buttons with aria-expanded that reveal their content", () => {
    inLang("ar", (
      <>
        <Accordion type="single" collapsible>
          <AccordionItem value="a"><AccordionTrigger>السؤال</AccordionTrigger><AccordionContent>الجواب</AccordionContent></AccordionItem>
        </Accordion>
        <Collapsible><CollapsibleTrigger>المزيد</CollapsibleTrigger><CollapsibleContent>تفاصيل</CollapsibleContent></Collapsible>
      </>
    ));
    const q = screen.getByRole("button", { name: "السؤال" });
    expect(q.getAttribute("aria-expanded")).toBe("false");
    expect(q.className).toContain("text-start");
    fireEvent.click(q);
    expect(q.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("region", { name: "السؤال" }).textContent).toBe("الجواب");
    const more = screen.getByRole("button", { name: "المزيد" });
    expect(screen.queryByText("تفاصيل")).toBeNull();
    fireEvent.click(more);
    expect(more.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("تفاصيل")).toBeTruthy();
  });

  it("Breadcrumb: a named nav (en/ar), the current page, separators that mirror in Arabic", () => {
    const crumbs = (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/">Home</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbEllipsis /></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>Task</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
    inLang("en", crumbs);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeTruthy();
    expect(screen.getByText("Task").getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("href")).toBe("/");
    cleanup();
    const { container } = inLang("ar", crumbs);
    expect(screen.getByRole("navigation", { name: "مسار التنقل" })).toBeTruthy();
    expect(container.querySelector('li[role="presentation"] svg')!.getAttribute("class")).toContain("rtl:rotate-180");
    expect(screen.getByText("المزيد").className).toBe("sr-only");
  });

  it("Pagination: localized names, the current page, previous/next chevrons that mirror in Arabic", () => {
    const pager = (
      <Pagination>
        <PaginationContent>
          <PaginationItem><PaginationPrevious href="#1" /></PaginationItem>
          <PaginationItem><PaginationLink href="#1">1</PaginationLink></PaginationItem>
          <PaginationItem><PaginationLink href="#2" isActive>2</PaginationLink></PaginationItem>
          <PaginationItem><PaginationEllipsis /></PaginationItem>
          <PaginationItem><PaginationNext href="#3" /></PaginationItem>
        </PaginationContent>
      </Pagination>
    );
    inLang("en", pager);
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Previous page" }).textContent).toBe("Previous");
    expect(screen.getByRole("link", { name: "Next page" }).textContent).toBe("Next");
    const current = screen.getByRole("link", { name: "2" });
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(current.className).toContain("sf-button"); // the package Button's look (outline when active)
    cleanup();
    inLang("ar", pager);
    const prev = screen.getByRole("link", { name: "الصفحة السابقة" });
    expect(prev.textContent).toBe("السابق");
    expect(prev.querySelector("svg")!.getAttribute("class")).toContain("rtl:rotate-180");
    expect(screen.getByRole("link", { name: "الصفحة التالية" }).textContent).toBe("التالي");
  });

  it("Slider: a slider whose arrow keys follow the reading direction", () => {
    inLang("en", <Slider defaultValue={[50]} max={100} step={1} aria-label="Volume" />);
    let thumb = screen.getByRole("slider");
    expect(thumb.getAttribute("aria-valuenow")).toBe("50");
    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    expect(thumb.getAttribute("aria-valuenow")).toBe("51");
    cleanup();
    inLang("ar", <Slider defaultValue={[50]} max={100} step={1} aria-label="الصوت" />);
    thumb = screen.getByRole("slider");
    fireEvent.keyDown(thumb, { key: "ArrowLeft" }); // Arabic: left increases
    expect(thumb.getAttribute("aria-valuenow")).toBe("51");
  });

  it("AspectRatio keeps the ratio", () => {
    const { container } = inLang("en", <AspectRatio ratio={16 / 9}><img alt="cover" /></AspectRatio>);
    expect((container.querySelector("[data-radix-aspect-ratio-wrapper]") as HTMLElement).style.paddingBottom).toBe("56.25%");
  });
});

describe("popups portal into the theme scope and carry sf-popper", () => {
  it("HoverCard", async () => {
    inScope(<HoverCard open><HoverCardTrigger href="#u">@rana</HoverCardTrigger><HoverCardContent>Rana — PM</HoverCardContent></HoverCard>);
    expectInScopePopper(await screen.findByText("Rana — PM"));
    expect(screen.getByText("Rana — PM").className).toContain("sf-glass");
  });

  it("ContextMenu: content and sub-content; items, checkbox, radio, label, shortcut; the sub chevron mirrors", async () => {
    inScope((
      <ContextMenu>
        <ContextMenuTrigger>area</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>Task</ContextMenuLabel>
          <ContextMenuItem>Open<ContextMenuShortcut>⌘O</ContextMenuShortcut></ContextMenuItem>
          <ContextMenuCheckboxItem checked>Pinned</ContextMenuCheckboxItem>
          <ContextMenuSeparator />
          <ContextMenuRadioGroup value="high"><ContextMenuRadioItem value="high">High</ContextMenuRadioItem></ContextMenuRadioGroup>
          <ContextMenuSub open>
            <ContextMenuSubTrigger>Move to</ContextMenuSubTrigger>
            <ContextMenuSubContent><ContextMenuItem>Backlog</ContextMenuItem></ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>
    ), "ar");
    fireEvent.contextMenu(screen.getByText("area"));
    const menus = await screen.findAllByRole("menu");
    expect(menus.length).toBe(2);
    for (const m of menus) expectInScopePopper(m);
    expect(screen.getByRole("menuitemcheckbox", { name: "Pinned" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("menuitemradio", { name: "High" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("menuitem", { name: "Backlog" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /Move to/ }).querySelector("svg")!.getAttribute("class")).toContain("rtl:rotate-180");
  });

  it("Menubar: content and sub-content", async () => {
    inScope((
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>New<MenubarShortcut>⌘N</MenubarShortcut></MenubarItem>
            <MenubarSub open>
              <MenubarSubTrigger>Share</MenubarSubTrigger>
              <MenubarSubContent><MenubarItem>Email</MenubarItem></MenubarSubContent>
            </MenubarSub>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    ));
    expect(screen.getByRole("menubar")).toBeTruthy();
    const trigger = screen.getByRole("menuitem", { name: "File" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    const menus = await screen.findAllByRole("menu");
    expect(menus.length).toBe(2);
    for (const m of menus) expectInScopePopper(m);
    expect(screen.getByRole("menuitem", { name: "Email" })).toBeTruthy();
  });

  it("NavigationMenu: the viewport (inline — Radix doesn't portal it) carries sf-popper", async () => {
    inScope((
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Projects</NavigationMenuTrigger>
            <NavigationMenuContent><NavigationMenuLink href="#all">All projects</NavigationMenuLink></NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem><NavigationMenuLink href="#docs" className={navigationMenuTriggerStyle()}>Docs</NavigationMenuLink></NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    ));
    const trigger = screen.getByRole("button", { name: "Projects" });
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expectInScopePopper(await screen.findByRole("link", { name: "All projects" }));
  });
});

describe("SearchCombobox (no React Query)", () => {
  const deferred = () => {
    let resolve!: (v: ComboOption[]) => void;
    const promise = new Promise<ComboOption[]>((r) => { resolve = r; });
    return { promise, resolve };
  };
  const props = { placeholder: "Select repo", searchPlaceholder: "Search repos", emptyText: "No repos", onSelect: () => {} };

  it("loads on open (no 'empty' while loading), then shows the results; picking one calls onSelect and closes", async () => {
    const d = deferred();
    const search = vi.fn(() => d.promise);
    const onSelect = vi.fn();
    inLang("en", <SearchCombobox {...props} id="repo" search={search} onSelect={onSelect} />);
    const trigger = screen.getByRole("combobox");
    expect(trigger.id).toBe("repo");
    expect(trigger.textContent).toContain("Select repo");
    fireEvent.click(trigger);
    await waitFor(() => expect(search).toHaveBeenCalledWith(""));
    expect(screen.getByRole("status").textContent).toBe("Loading…");
    expect(screen.queryByText("No repos")).toBeNull();
    await act(async () => { d.resolve([{ value: "acme/api", label: "acme/api", description: "Backend" }]); });
    const opt = await screen.findByRole("option", { name: /acme\/api/ });
    expect(screen.queryByRole("status")).toBeNull();
    expectInScopeless(opt);
    fireEvent.click(opt);
    expect(onSelect).toHaveBeenCalledWith("acme/api");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });

  it("debounces typing and drops a response that arrives after a newer request", async () => {
    const pending: Record<string, ReturnType<typeof deferred>> = {};
    const search = vi.fn((q: string) => (pending[q] = deferred()).promise);
    inLang("ar", <SearchCombobox {...props} search={search} />);
    fireEvent.click(screen.getByRole("combobox"));
    await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status").textContent).toBe("جارٍ التحميل…");
    const input = screen.getByPlaceholderText("Search repos");
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.change(input, { target: { value: "ac" } });
    await new Promise((r) => setTimeout(r, 350));
    expect(search.mock.calls.map((c) => c[0])).toEqual(["", "ac"]); // "a" never went out
    await act(async () => { pending.ac.resolve([{ value: "acme/web", label: "acme/web" }]); });
    await screen.findByRole("option", { name: "acme/web" });
    await act(async () => { pending[""].resolve([{ value: "old/stale", label: "old/stale" }]); }); // late, stale
    expect(screen.queryByRole("option", { name: "old/stale" })).toBeNull();
    expect(screen.getByRole("option", { name: "acme/web" })).toBeTruthy();
  });

  it("shows the empty text once a search finished with nothing (and after an error)", async () => {
    const search = vi.fn(async () => { throw new Error("offline"); });
    inLang("en", <SearchCombobox {...props} search={search} />);
    fireEvent.click(screen.getByRole("combobox"));
    expect(await screen.findByText("No repos")).toBeTruthy();
  });

  it("a new queryKey drops what was loaded and loads again", async () => {
    const search = vi.fn(async (q: string) => [{ value: `v-${search.mock.calls.length}`, label: `option ${q}${search.mock.calls.length}` }]);
    const { rerender } = inLang("en", <SearchCombobox {...props} queryKey="Customer" search={search} />);
    fireEvent.click(screen.getByRole("combobox"));
    await screen.findByRole("option", { name: "option 1" });
    rerender(<ThemeProvider defaultLanguage="en" storageKeys={null}><SearchCombobox {...props} queryKey="Supplier" search={search} /></ThemeProvider>);
    await screen.findByRole("option", { name: "option 2" });
    expect(search).toHaveBeenCalledTimes(2);
  });
});
/** The combobox popover portals to <body> under a document-scope provider; it is the package Popover (sf-popper). */
function expectInScopeless(el: HTMLElement) { expect(el.closest(".sf-popper")).toBeTruthy(); }

describe("sanitizeHtml — allowlist rebuild (XSS)", () => {
  const cases: [string, string][] = [
    ["<script>alert(1)</script>ok", "ok"],
    ["<style>p{color:red}</style>ok", "ok"],
    ['<iframe src="javascript:alert(1)"></iframe>ok', "ok"],
    ['<object data="evil.swf"></object><embed src="evil.swf">ok', "ok"],
    ['<p onclick="alert(1)" onmouseover="alert(2)" style="color:red" class="x" id="y">hi</p>', "<p>hi</p>"],
    ['<a href="javascript:alert(1)">x</a>', "<a>x</a>"],
    ['<a href="  JaVaScRiPt:alert(1)">x</a>', "<a>x</a>"],
    ['<a href="java&#x09;script:alert(1)">x</a>', "<a>x</a>"],
    ['<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>', "<a>x</a>"],
    ['<a href="vbscript:msgbox(1)">x</a>', "<a>x</a>"],
    ['<img src="data:image/svg+xml,<svg onload=alert(1)>" onerror="alert(1)">ok', "ok"],
    // PMO's sanitizer let these through: the children of an unwrapped element were never visited
    ['<font><img src=x onerror="alert(1)"></font>', ""],
    ['<section><a href="javascript:alert(1)">x</a></section>', "<a>x</a>"],
    ['<x-y><p onclick="alert(1)" style="color:red">hi</p></x-y>', "<p>hi</p>"],
    // foreign content and parser-differential tricks
    ['<svg><a href="javascript:alert(1)"><text>x</text></a></svg>ok', "ok"],
    ['<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>', ""],
    ['<noscript><p title="</noscript><img src=x onerror=alert(1)>">', ""],
    ["<!-- <img src=x onerror=alert(1)> -->ok", "ok"],
    ['<template><img src=x onerror=alert(1)></template>ok', "ok"],
  ];
  it.each(cases)("%s", (input, expected) => {
    const out = sanitizeHtml(input);
    if (expected) expect(out).toBe(expected);
    expect(out).not.toMatch(/\son\w+=|javascript:|data:|vbscript:|<script|<img|<svg|<iframe|<style|style=/i);
    expect(sanitizeHtml(out)).toBe(out); // stable when re-sanitized (no re-parse surprises)
  });

  it("keeps the formatting the editor produces, and safe links (opened in a new tab)", () => {
    expect(sanitizeHtml("<h3>Plan</h3><p><b>bold</b> <i>it</i> <u>u</u> <s>s</s> <strike>x</strike></p><ul><li>1</li></ul><ol><li>2</li></ol><blockquote>q</blockquote><code>c</code><br><div><span>d</span></div>"))
      .toBe("<h3>Plan</h3><p><b>bold</b> <i>it</i> <u>u</u> <s>s</s> <strike>x</strike></p><ul><li>1</li></ul><ol><li>2</li></ol><blockquote>q</blockquote><code>c</code><br><div><span>d</span></div>");
    expect(sanitizeHtml('<a href="https://example.com/x?a=1&b=2" onclick="x">site</a>'))
      .toBe('<a href="https://example.com/x?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">site</a>');
    expect(sanitizeHtml('<a href="mailto:pm@example.com">mail</a>')).toContain('href="mailto:pm@example.com"');
    expect(sanitizeHtml("a &lt;b&gt; c")).toBe("a &lt;b&gt; c"); // text stays text
    expect(sanitizeHtml("")).toBe("");
  });

  it("htmlIsEmpty parses inertly (never into a live element, where an <img onerror> would fire)", () => {
    const spy = vi.spyOn(document, "createElement");
    expect(htmlIsEmpty('<img src=x onerror="window.__sfXss=1">')).toBe(false);
    expect(htmlIsEmpty("<p> </p><div><br></div>")).toBe(false); // a line break counts, as in PMO
    expect(htmlIsEmpty("<p>  </p>")).toBe(true);
    expect(htmlIsEmpty(null)).toBe(true);
    expect(spy.mock.calls.every(([tag]) => tag === "template")).toBe(true);
    spy.mockRestore();
  });
});

describe("RichText and RichTextEditor", () => {
  it("RichText renders sanitized HTML with the rich-text styles; empty shows the placeholder", () => {
    const { container } = inLang("en", <><RichText value='<p>Hi <b>team</b></p><img src=x onerror="alert(1)">' /><RichText value="<p></p>" empty="Nothing yet" /></>);
    const [full, empty] = Array.from(container.querySelectorAll(".sf-rich-text"));
    expect(full.innerHTML).toBe("<p>Hi <b>team</b></p>");
    expect(empty.textContent).toBe("Nothing yet");
    expect(empty.className).toContain("text-muted-foreground");
  });

  it("the editor writes only sanitized HTML into the page and emits sanitized HTML; toolbar labels follow the language", () => {
    const onChange = vi.fn();
    inLang("ar", <RichTextEditor value='<p>ok</p><img src=x onerror="alert(1)">' onChange={onChange} ariaLabel="الوصف" placeholder="اكتب…" />);
    const box = screen.getByRole("textbox", { name: "الوصف" });
    expect(box.innerHTML).toBe("<p>ok</p>");
    expect(box.getAttribute("contenteditable")).toBe("true");
    expect(box.className).toContain("sf-rte-editable");
    const toolbar = screen.getByRole("toolbar", { name: "الوصف" });
    expect(within(toolbar).getAllByRole("button").map((b) => b.getAttribute("aria-label")))
      .toEqual(["عريض", "مائل", "تسطير", "يتوسطه خط", "قائمة نقطية", "قائمة مرقّمة"]);
    box.innerHTML = '<p>typed <a href="javascript:alert(1)" onclick="x">link</a></p>';
    fireEvent.input(box);
    expect(onChange).toHaveBeenLastCalledWith("<p>typed <a>link</a></p>");
  });

  it("the toolbar is named 'Text formatting' without an ariaLabel; disabled renders the read-only view", () => {
    const { rerender } = inLang("en", <RichTextEditor value="<p>a</p>" onChange={() => {}} />);
    expect(screen.getByRole("toolbar", { name: "Text formatting" })).toBeTruthy();
    rerender(<ThemeProvider defaultLanguage="en" storageKeys={null}><RichTextEditor value="<p>a</p>" onChange={() => {}} disabled /></ThemeProvider>);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("a").closest(".sf-rich-text")).toBeTruthy();
  });
});

describe("PageHeader and EditableTitle", () => {
  it("title as h1, subtitle, meta, actions; back button only with onBack, named and pointing back in each language", () => {
    const onBack = vi.fn();
    inLang("en", <PageHeader title="Website redesign" subtitle="PRJ-0042" meta={<span>On track</span>} actions={<button>Edit</button>} onBack={onBack} />);
    expect(screen.getByRole("heading", { level: 1, name: "Website redesign" })).toBeTruthy();
    expect(screen.getByText("PRJ-0042")).toBeTruthy();
    expect(screen.getByText("On track")).toBeTruthy();
    const back = screen.getByRole("button", { name: "Back" });
    expect(back.getAttribute("title")).toBe("Back");
    expect(back.querySelector("svg")!.getAttribute("class")).toContain("lucide-arrow-left");
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
    cleanup();
    inLang("ar", <PageHeader title="إعادة تصميم الموقع" onBack={() => {}} />);
    const backAr = screen.getByRole("button", { name: "رجوع" });
    expect(backAr.querySelector("svg")!.getAttribute("class")).toContain("lucide-arrow-right");
    cleanup();
    inLang("en", <PageHeader title="Tasks" />);
    expect(screen.queryByRole("button")).toBeNull();
    cleanup();
    inLang("en", <PageHeader title="Task" onBack={() => {}} backLabel="Back to tasks" />);
    expect(screen.getByRole("button", { name: "Back to tasks" })).toBeTruthy();
  });

  it("EditableTitle: click to edit (named text box), Enter saves the trimmed text once, Esc cancels", () => {
    const onSave = vi.fn();
    inLang("ar", <EditableTitle value="مهمة" canEdit onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "مهمة" }));
    let box = screen.getByRole("textbox", { name: "تعديل العنوان" });
    fireEvent.change(box, { target: { value: "  مهمة جديدة  " } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("مهمة جديدة");
    fireEvent.click(screen.getByRole("button", { name: "مهمة" }));
    box = screen.getByRole("textbox");
    fireEvent.change(box, { target: { value: "شيء آخر" } });
    fireEvent.keyDown(box, { key: "Escape" });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("textbox")).toBeNull();
    cleanup();
    inLang("en", <EditableTitle value="Read only" canEdit={false} onSave={onSave} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Read only")).toBeTruthy();
  });
});

describe("@solvfast/ui/chart", () => {
  const config = {
    desktop: { label: "Desktop", color: "hsl(var(--primary))" },
    mobile: { label: "Mobile", theme: { light: "#2563eb", dark: "#60a5fa" } },
  } satisfies ChartConfig;

  it("ChartContainer scopes the series colours (light and dark); tooltip and legend use the config labels", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {}); // recharts: zero-size container in jsdom
    const { container } = inLang("en", (
      <ChartContainer config={config} id="visits">
        <div>
          <ChartTooltipContent active label="desktop" payload={[{ dataKey: "desktop", name: "desktop", value: 1260, color: "red", payload: {} } as never]} />
          <ChartLegendContent payload={[{ value: "mobile", dataKey: "mobile", color: "blue" } as never]} />
        </div>
      </ChartContainer>
    ));
    warn.mockRestore();
    const chart = container.querySelector('[data-chart="chart-visits"]')!;
    expect(chart).toBeTruthy();
    const css = chart.querySelector("style")!.innerHTML;
    expect(css).toContain("--color-desktop: hsl(var(--primary));");
    expect(css).toContain("--color-mobile: #2563eb;");
    expect(css).toMatch(/\.dark \[data-chart=chart-visits\][^}]*--color-mobile: #60a5fa;/);
    expect(screen.getAllByText("Desktop").length).toBeGreaterThan(0);
    expect(screen.getByText("1,260")).toBeTruthy();
    expect(screen.getByText("Mobile")).toBeTruthy();
  });
});

describe("@solvfast/ui/form", () => {
  function ProfileForm({ onSubmit }: { onSubmit: (v: { name: string }) => void }) {
    const form = useForm<{ name: string }>({ defaultValues: { name: "" } });
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormField control={form.control} name="name" rules={{ required: "الاسم مطلوب" }} render={({ field }) => (
            <FormItem>
              <FormLabel>الاسم</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormDescription>يظهر في الفواتير</FormDescription>
              <FormMessage />
            </FormItem>
          )} />
          <button type="submit">حفظ</button>
        </form>
      </Form>
    );
  }

  it("label → control, description; a failed submit shows the message, marks the field invalid and describes it", async () => {
    const onSubmit = vi.fn();
    inLang("ar", <ProfileForm onSubmit={onSubmit} />);
    const input = screen.getByRole("textbox", { name: "الاسم" });
    const descId = screen.getByText("يظهر في الفواتير").id;
    expect(input.getAttribute("aria-describedby")).toBe(descId);
    expect(input.getAttribute("aria-invalid")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    const msg = await screen.findByText("الاسم مطلوب");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(`${descId} ${msg.id}`);
    expect(screen.getByText("الاسم").className).toContain("text-destructive");
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "رنا" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toEqual({ name: "رنا" });
  });
});

describe("DateField / TimeField / DateTimeField — named by their <label> (0.3.0 fix)", () => {
  it("with an id and no aria-label, the label names the trigger and the value describes it", () => {
    inLang("en", (
      <>
        <Label htmlFor="start">Start date</Label>
        <DateField id="start" value="2026-10-12" onChange={() => {}} />
        <Label htmlFor="at">Meeting</Label>
        <TimeField id="at" value="" onChange={() => {}} />
        <Label htmlFor="due">Due</Label>
        <DateTimeField id="due" value="2026-10-12T09:30" onChange={() => {}} />
      </>
    ));
    const start = screen.getByRole("button", { name: "Start date" });
    expect(start.hasAttribute("aria-label")).toBe(false);
    expect(start.getAttribute("aria-describedby")).toBe("start-value");
    expect(document.getElementById("start-value")!.textContent).toMatch(/2026/);
    const at = screen.getByRole("button", { name: "Meeting" });
    expect(at.hasAttribute("aria-describedby")).toBe(false); // nothing selected
    expect(screen.getByRole("button", { name: "Due" }).getAttribute("aria-describedby")).toBe("due-value");
  });

  it("without an id the field names itself as before; an explicit aria-label always wins", () => {
    inLang("en", (
      <>
        <DateField value="2026-10-12" onChange={() => {}} />
        <DateField id="x" aria-label="Deadline" value="" onChange={() => {}} />
      </>
    ));
    expect(screen.getByRole("button", { name: /^Date: .*2026/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Deadline" }).getAttribute("aria-label")).toBe("Deadline");
  });
});

describe("PageHeader inside AppShell — one page title (Sear's pattern)", () => {
  const items: NavItem[] = [
    { id: "home", href: "/home", icon: Home, label: { en: "Home", ar: "الرئيسية" } },
    { id: "projects", href: "/projects", icon: Folder, label: { en: "Projects", ar: "المشاريع" } },
  ];
  const Shell = ({ language = "en", title, children }: { language?: Lang; title?: string; children: React.ReactNode }) => (
    <ThemeProvider defaultLanguage={language} storageKeys={null}>
      <AppShell brand={{ name: "PMO" }} items={items} currentPath="/projects/42" onNavigate={() => {}} collapsedStorageKey={null} title={title}>
        {children}
      </AppShell>
    </ThemeProvider>
  );
  const h1s = () => screen.getAllByRole("heading", { level: 1 });

  it("a text title goes to the top bar (the only h1); back, subtitle and actions stay; unmount restores the nav title", () => {
    const { rerender } = render(<Shell><PageHeader title="Website redesign" subtitle="PRJ-0042" onBack={() => {}} actions={<button>Edit</button>} /></Shell>);
    expect(h1s().map((h) => h.textContent)).toEqual(["Website redesign"]);
    expect(h1s()[0].closest("header, [class*='sf-glass-pane']")).toBeTruthy(); // the Navbar's h1
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    expect(screen.getByText("PRJ-0042")).toBeTruthy();
    rerender(<Shell><p>no header</p></Shell>);
    expect(h1s().map((h) => h.textContent)).toEqual(["Projects"]);
  });

  it("{ en, ar } titles follow the language; a title-only header renders nothing in the page", () => {
    const { container } = render(<Shell language="ar"><PageHeader title={{ en: "Website redesign", ar: "إعادة تصميم الموقع" }} /></Shell>);
    expect(h1s().map((h) => h.textContent)).toEqual(["إعادة تصميم الموقع"]);
    expect(container.querySelector("main")!.textContent).toBe("");
  });

  it("AppShell's own title wins; a node title stays in the page; outside a shell the header has its own h1", () => {
    const { unmount } = render(<Shell title="Fixed"><PageHeader title="From page" /></Shell>);
    expect(h1s().map((h) => h.textContent)).toEqual(["Fixed"]);
    unmount();
    render(<Shell><PageHeader title={<span>Rich <b>title</b></span>} /></Shell>);
    expect(h1s().map((h) => h.textContent)).toEqual(["Projects", "Rich title"]);
    cleanup();
    inLang("ar", <PageHeader title={{ en: "Tasks", ar: "المهام" }} />);
    expect(h1s().map((h) => h.textContent)).toEqual(["المهام"]);
  });

  it("the last mounted header wins; when it goes, the previous one is back", () => {
    const { rerender } = render(<Shell><PageHeader title="Outer" /><PageHeader title="Inner" /></Shell>);
    expect(h1s()[0].textContent).toBe("Inner");
    rerender(<Shell><PageHeader title="Outer" /></Shell>);
    expect(h1s()[0].textContent).toBe("Outer");
  });
});

describe("MobileNav — primary (0.3.0)", () => {
  // PMO-like: everything but Home is a group
  const tree: NavItem[] = [
    { id: "home", href: "/home", icon: Home, label: { en: "Home", ar: "الرئيسية" } },
    { id: "work", icon: ListChecks, label: { en: "Work", ar: "العمل" }, children: [
      { id: "tasks", href: "/work/tasks", label: { en: "Tasks", ar: "المهام" } },
      { id: "bugs", href: "/work/bugs", label: { en: "Bugs", ar: "الأخطاء" } },
    ] },
    { id: "projects", icon: Folder, label: { en: "Projects", ar: "المشاريع" }, children: [
      { id: "all", href: "/projects", label: { en: "All projects", ar: "كل المشاريع" } },
    ] },
  ];
  const bar = () => screen.getByRole("navigation");

  it("without primary: unchanged (only top-level leaves fill the bar)", () => {
    inLang("en", <MobileNav items={tree} currentPath="/home" onNavigate={() => {}} />);
    expect(within(bar()).getAllByRole("button").map((b) => b.textContent)).toEqual(["Home", "More"]);
  });

  it("with primary: those items fill the bar (capped by maxItems); a group goes to its first child; More lists the whole tree", async () => {
    const nav = vi.fn();
    inLang("ar", <MobileNav items={tree} primary={[tree[0], tree[1], tree[2]]} maxItems={2} currentPath="/work/bugs" onNavigate={nav} />);
    expect(within(bar()).getAllByRole("button").map((b) => b.textContent)).toEqual(["الرئيسية", "العمل", "المزيد"]);
    const work = within(bar()).getByRole("button", { name: "العمل" });
    expect(work.getAttribute("aria-current")).toBe("page"); // a child of the group is current
    fireEvent.click(work);
    expect(nav).toHaveBeenLastCalledWith("/work/tasks", expect.objectContaining({ id: "work" }));
    await act(async () => { fireEvent.click(within(bar()).getByRole("button", { name: "المزيد" })); });
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getAllByRole("button").map((b) => b.textContent).filter((t) => t))
      .toEqual(expect.arrayContaining(["الرئيسية", "العمل", "المهام", "الأخطاء", "المشاريع", "كل المشاريع"]));
    const bugs = within(sheet).getByRole("button", { name: "الأخطاء" });
    expect(bugs.getAttribute("aria-current")).toBe("page");
    expect(bugs.style.paddingInlineStart).toBe("2rem"); // one level in
    fireEvent.click(within(sheet).getByRole("button", { name: "كل المشاريع" }));
    expect(nav).toHaveBeenLastCalledWith("/projects", expect.objectContaining({ id: "all" }));
  });
});
