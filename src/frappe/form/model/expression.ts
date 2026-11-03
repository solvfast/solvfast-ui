/**
 * Expression evaluation for `eval:` dependencies (decision D-23, recommended; awaiting the owner's approval).
 *
 * Desk evaluates `eval:` expressions with `new Function` and full page access (docs `11` §2.4, `utils.js:1076`).
 * Default here: an INTERPRETER for the common subset — nothing is executed, no `unsafe-eval` in a CSP, and an
 * expression outside the subset is reported when the meta loads (`compileExpression` returns `unsupported`), never
 * guessed. Opt-in: `mode: "function"` compiles with `new Function` like Desk (full JavaScript, needs `unsafe-eval`).
 *
 * Subset: literals (numbers, strings, true/false/null/undefined, array literals), identifiers bound by the caller
 * (`doc`, `parent`, helpers), member access (`a.b`, `a["b"]`, `a?.b`, `.length`), whitelisted string/array methods
 * (includes, indexOf, startsWith, endsWith, toLowerCase, toUpperCase, trim), calls to bound helper functions, unary
 * `! - + typeof`, binary `* / % + - < > <= >= == != === !== && || ??` and `in`, a trailing `;`, the conditional `?:` and parentheses.
 * Helpers bound by default: `in_list(list, value)`, `cint`, `flt`, `cstr`, `is_null`, `Boolean` — Desk exposes these as page
 * globals; the fixtures' real expressions use `in_list` and `cint`. UNVERIFIED: which other Desk globals expressions in
 * the wild rely on (docs `11` §12) — they are reported as unsupported.
 * Semantics follow JavaScript: loose `==`, truthiness, short-circuit `&&`/`||`. Reading a property of null/undefined is
 * an error (as in JS); the caller reports it.
 */

export type ExprValue = unknown;
export type Scope = Record<string, unknown>;

export type Compiled =
  | { ok: true; run: (scope: Scope) => ExprValue }
  | { ok: false; reason: string };

// ---- tokenizer -------------------------------------------------------------------------------------------------

type Tok =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "id"; v: string }
  | { t: "op"; v: string };

const OPS = ["===", "!==", "?.", "??", "==", "!=", "<=", ">=", "&&", "||", "(", ")", "[", "]", ".", ",", "!", "<", ">", "+", "-", "*", "/", "%", "?", ":"];

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      const m = /^(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+)/.exec(src.slice(i))!;
      out.push({ t: "num", v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      let s = "";
      while (j < src.length && src[j] !== c) {
        if (src[j] === "\\") {
          const n = src[j + 1];
          s += n === "n" ? "\n" : n === "t" ? "\t" : n;
          j += 2;
        } else {
          if (c === "`" && src[j] === "$" && src[j + 1] === "{") throw new Error("template interpolation");
          s += src[j++];
        }
      }
      if (j >= src.length) throw new Error("unterminated string");
      out.push({ t: "str", v: s });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i))!;
      out.push({ t: "id", v: m[0] });
      i += m[0].length;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new Error(`unexpected character "${c}"`);
    // `?.` followed by a digit is the conditional operator then a number (a ? .5 : 1)
    if (op === "?." && /[0-9]/.test(src[i + 2] ?? "")) { out.push({ t: "op", v: "?" }); i += 1; continue; }
    out.push({ t: "op", v: op });
    i += op.length;
  }
  return out;
}

// ---- parser (to closures) --------------------------------------------------------------------------------------

type Node = (s: Scope) => ExprValue;
/** A reference: evaluates to the value, and (for calls) to the receiver + property. */
interface Ref { node: Node; member?: { obj: Node; prop: Node; optional: boolean } }

const STRING_METHODS = new Set(["includes", "indexOf", "startsWith", "endsWith", "toLowerCase", "toUpperCase", "trim"]);
const ARRAY_METHODS = new Set(["includes", "indexOf"]);
const KEYWORDS: Record<string, ExprValue> = { true: true, false: false, null: null, undefined: undefined };
const FORBIDDEN_PROPS = new Set(["constructor", "__proto__", "prototype", "__defineGetter__", "__defineSetter__", "__lookupGetter__"]);

function looseEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  const prim = (x: unknown) => (typeof x === "boolean" ? Number(x) : x);
  const x = prim(a); const y = prim(b);
  if (typeof x === "number" && typeof y === "string") return x === (y.trim() === "" ? 0 : Number(y));
  if (typeof x === "string" && typeof y === "number") return (x.trim() === "" ? 0 : Number(x)) === y;
  if (typeof x === "number" && typeof y === "number") return x === y;
  if (Array.isArray(x) && typeof y !== "object") return looseEq(String(x), y);
  if (Array.isArray(y) && typeof x !== "object") return looseEq(x, String(y));
  return x === y;
}

const truthy = (v: unknown) => !!v;

function getProp(obj: unknown, key: unknown): unknown {
  if (obj == null) throw new TypeError(`Cannot read properties of ${obj === null ? "null" : "undefined"} (reading '${String(key)}')`);
  const k = String(key);
  if (FORBIDDEN_PROPS.has(k)) throw new Error(`property "${k}" is not allowed`);
  if (typeof obj === "string") {
    if (k === "length") return obj.length;
    if (/^\d+$/.test(k)) return obj[Number(k)];
    return undefined;
  }
  if (Array.isArray(obj)) {
    if (k === "length") return obj.length;
    return /^\d+$/.test(k) ? obj[Number(k)] : undefined;
  }
  if (typeof obj === "object" || typeof obj === "function") {
    return Object.prototype.hasOwnProperty.call(obj, k) ? (obj as Record<string, unknown>)[k] : undefined;
  }
  return undefined;
}

function parse(tokens: Tok[], used: Set<string>): Node {
  let p = 0;
  const peek = (o = 0) => tokens[p + o];
  const isOp = (v: string, o = 0) => { const t = peek(o); return !!t && t.t === "op" && t.v === v; };
  const expectOp = (v: string) => { if (!isOp(v)) throw new Error(`expected "${v}"`); p++; };

  function primary(): Ref {
    const t = peek();
    if (!t) throw new Error("unexpected end");
    if (t.t === "num" || t.t === "str") { p++; const v = t.v; return { node: () => v }; }
    if (t.t === "id") {
      p++;
      if (t.v in KEYWORDS) { const v = KEYWORDS[t.v]; return { node: () => v }; }
      if (t.v === "typeof") { const r = unary(); return { node: (s) => typeof r(s) }; }
      if (["new", "function", "this", "class", "async", "await", "yield", "delete", "void", "instanceof", "eval", "window", "globalThis", "document"].includes(t.v)) throw new Error(`"${t.v}" is not supported`);
      const name = t.v;
      used.add(name);
      return {
        node: (s) => {
          if (!Object.prototype.hasOwnProperty.call(s, name)) throw new ReferenceError(`${name} is not defined`);
          return s[name];
        },
      };
    }
    if (isOp("(")) { p++; const e = expression(); expectOp(")"); return { node: e }; }
    if (isOp("[")) {
      p++;
      const items: Node[] = [];
      if (!isOp("]")) { do { items.push(conditional()); } while (isOp(",") && ++p); }
      expectOp("]");
      return { node: (s) => items.map((n) => n(s)) };
    }
    throw new Error(`unexpected "${(t as Tok).v}"`);
  }

  function postfix(): Ref {
    let ref = primary();
    for (;;) {
      if (isOp(".") || isOp("?.")) {
        const optional = isOp("?.");
        p++;
        if (optional && isOp("(")) throw new Error("optional call is not supported");
        if (optional && isOp("[")) {
          p++; const key = expression(); expectOp("]");
          const obj = ref.node;
          ref = { node: (s) => { const o = obj(s); return o == null ? undefined : getProp(o, key(s)); }, member: { obj, prop: key, optional: true } };
          continue;
        }
        const t = peek();
        if (!t || t.t !== "id") throw new Error("expected a property name");
        p++;
        const name = t.v;
        const obj = ref.node;
        const prop: Node = () => name;
        ref = { node: (s) => { const o = obj(s); return optional && o == null ? undefined : getProp(o, name); }, member: { obj, prop, optional } };
      } else if (isOp("[")) {
        p++;
        const key = expression();
        expectOp("]");
        const obj = ref.node;
        ref = { node: (s) => getProp(obj(s), key(s)), member: { obj, prop: key, optional: false } };
      } else if (isOp("(")) {
        p++;
        const args: Node[] = [];
        if (!isOp(")")) { do { args.push(conditional()); } while (isOp(",") && ++p); }
        expectOp(")");
        const callee = ref;
        ref = {
          node: (s) => {
            const argv = args.map((a) => a(s));
            if (callee.member) {
              const recv = callee.member.obj(s);
              if (recv == null && callee.member.optional) return undefined;
              const name = String(callee.member.prop(s));
              if (typeof recv === "string" && STRING_METHODS.has(name)) return (recv as unknown as Record<string, (...a: unknown[]) => unknown>)[name](...argv);
              if (Array.isArray(recv) && ARRAY_METHODS.has(name)) return (recv as unknown as Record<string, (...a: unknown[]) => unknown>)[name](...argv);
              const fn = getProp(recv, name);
              if (typeof fn === "function" && isHelper(fn)) return fn(...argv);
              throw new Error(`method "${name}" is not supported`);
            }
            const fn = callee.node(s);
            if (typeof fn === "function" && isHelper(fn)) return fn(...argv);
            throw new Error("only bound helper functions can be called");
          },
        };
      } else break;
    }
    return ref;
  }

  function unary(): Node {
    if (isOp("!")) { p++; const r = unary(); return (s) => !truthy(r(s)); }
    if (isOp("-")) { p++; const r = unary(); return (s) => -(r(s) as number); }
    if (isOp("+")) { p++; const r = unary(); return (s) => +(r(s) as number); }
    return postfix().node;
  }

  const LEVELS: string[][] = [["??"], ["||"], ["&&"], ["==", "!=", "===", "!=="], ["<", ">", "<=", ">="], ["+", "-"], ["*", "/", "%"]];
  function binary(level: number): Node {
    if (level >= LEVELS.length) return unary();
    let left = binary(level + 1);
    for (;;) {
      const t = peek();
      const isIn = level === 4 && !!t && t.t === "id" && t.v === "in"; // relational level, like JS
      if (!t || (!isIn && (t.t !== "op" || !LEVELS[level].includes(t.v)))) return left;
      p++;
      const op = t.v;
      const right = binary(level + 1);
      const l = left;
      left = combine(op, l, right);
    }
  }
  function conditional(): Node {
    const test = binary(0);
    if (!isOp("?")) return test;
    p++;
    const a = conditional();
    expectOp(":");
    const b = conditional();
    return (s) => (truthy(test(s)) ? a(s) : b(s));
  }
  function expression(): Node {
    const n = conditional();
    if (isOp(",")) throw new Error("the comma operator is not supported");
    return n;
  }

  const root = expression();
  if (p < tokens.length) {
    const t = tokens[p];
    throw new Error(`unexpected "${t.t === "op" ? t.v : String(t.v)}"${t.t === "op" && t.v === "=" ? " (assignment is not supported)" : ""}`);
  }
  return root;
}

function combine(op: string, l: Node, r: Node): Node {
  switch (op) {
    case "&&": return (s) => { const a = l(s); return truthy(a) ? r(s) : a; };
    case "||": return (s) => { const a = l(s); return truthy(a) ? a : r(s); };
    case "??": return (s) => { const a = l(s); return a ?? r(s); };
    case "==": return (s) => looseEq(l(s), r(s));
    case "!=": return (s) => !looseEq(l(s), r(s));
    case "===": return (s) => l(s) === r(s);
    case "!==": return (s) => l(s) !== r(s);
    case "<": return (s) => (l(s) as number) < (r(s) as number);
    case ">": return (s) => (l(s) as number) > (r(s) as number);
    case "<=": return (s) => (l(s) as number) <= (r(s) as number);
    case ">=": return (s) => (l(s) as number) >= (r(s) as number);
    case "+": return (s) => { const a = l(s); const b = r(s); return typeof a === "string" || typeof b === "string" ? `${a}${b}` : (a as number) + (b as number); };
    case "-": return (s) => (l(s) as number) - (r(s) as number);
    case "*": return (s) => (l(s) as number) * (r(s) as number);
    case "/": return (s) => (l(s) as number) / (r(s) as number);
    case "%": return (s) => (l(s) as number) % (r(s) as number);
    case "in": return (s) => {
      const k = String(l(s)); const o = r(s);
      if (o == null || typeof o !== "object") throw new TypeError(`Cannot use 'in' operator to search for '${k}' in ${String(o)}`);
      if (Array.isArray(o)) return k === "length" || (/^\d+$/.test(k) && Number(k) < o.length);
      return Object.prototype.hasOwnProperty.call(o, k);
    };
    default: throw new Error(`operator "${op}" is not supported`);
  }
}

// ---- helpers (Desk page globals the subset binds) ----------------------------------------------------------------

const HELPER = Symbol("sf-expr-helper");
/** Mark a function as callable from expressions (anything else in scope cannot be called). */
export function exprHelper<F extends (...a: never[]) => unknown>(fn: F): F {
  (fn as unknown as Record<symbol, boolean>)[HELPER] = true;
  return fn;
}
const isHelper = (fn: unknown) => !!(fn as Record<symbol, boolean> | undefined)?.[HELPER];

const cint = (v: unknown, def: number | null = 0) => { const n = parseInt(String(v), 10); return Number.isNaN(n) ? def : n; };
const flt = (v: unknown, precision?: number) => {
  const n = parseFloat(String(v).replace(/,/g, ""));
  const x = Number.isNaN(n) ? 0 : n;
  return precision == null ? x : Number(x.toFixed(precision));
};
export const DEFAULT_HELPERS: Scope = {
  in_list: exprHelper((list: unknown, item: unknown) => Array.isArray(list) && list.includes(item)),
  cint: exprHelper(cint),
  flt: exprHelper(flt),
  cstr: exprHelper((v: unknown) => (v == null ? "" : String(v))),
  is_null: exprHelper((v: unknown) => v == null || (typeof v === "string" && v.trim() === "")),
  Boolean: exprHelper((v: unknown) => !!v),
};

// ---- compile ---------------------------------------------------------------------------------------------------

export type EvalMode = "interpreter" | "function";

const cache = new Map<string, Compiled>();

/**
 * Compile an expression body (without `eval:`). `names` are the variables the expression may use (default: doc,
 * parent and the helpers); in "function" mode they become the parameters of a `new Function`.
 */
export function compileExpression(src: string, mode: EvalMode = "interpreter", names: string[] = ["doc", "parent", ...Object.keys(DEFAULT_HELPERS)]): Compiled {
  // Desk compiles `let out = <code>; return out`, so trailing semicolons are valid
  src = src.replace(/[\s;]+$/, "");
  const key = `${mode}\u0000${names.join(",")}\u0000${src}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let out: Compiled;
  if (mode === "function") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const fn = new Function(...names, `return (${src});`) as (...a: unknown[]) => unknown;
      out = { ok: true, run: (s) => fn(...names.map((n) => s[n])) };
    } catch (e) {
      out = { ok: false, reason: e instanceof Error ? e.message : String(e) };
    }
  } else {
    try {
      if (!src.trim()) throw new Error("empty expression");
      const used = new Set<string>();
      const node = parse(tokenize(src), used);
      const unknown = [...used].filter((n) => !names.includes(n));
      if (unknown.length) throw new Error(`${unknown.map((n) => `"${n}"`).join(", ")} ${unknown.length > 1 ? "are" : "is"} not available to expressions`);
      out = { ok: true, run: node };
    } catch (e) {
      out = { ok: false, reason: e instanceof Error ? e.message : String(e) };
    }
  }
  if (cache.size > 2000) cache.clear();
  cache.set(key, out);
  return out;
}
