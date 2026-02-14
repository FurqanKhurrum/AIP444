## Summary
This PR modernizes the `req.hostname` getter in `lib/request.js` by:
- Switching `var` → `const`
- Using `String.prototype.startsWith()` instead of `host[0] === '['`
- Using `slice()` instead of `substring()`
- Minor formatting/ternary simplification

Functionally, it aims to remain equivalent while improving readability.

---

## What Changed (Behavioral Impact)
### 1) IPv6 literal detection
**Before:**
```js
var offset = host[0] === '[' ? host.indexOf(']') + 1 : 0;
```

**After:**
```js
const offset = host.startsWith('[') ? host.indexOf(']') + 1 : 0;
```

These are equivalent given the existing guard `if (!host) return;`. If `host` is a non-empty string:
- `host[0] === '['` and `host.startsWith('[')` produce the same result.

### 2) Port stripping
**Before:**
```js
return index !== -1 ? host.substring(0, index) : host;
```

**After:**
```js
return index !== -1 ? host.slice(0, index) : host;
```

For non-negative indices (as used here), `substring(0, index)` and `slice(0, index)` return the same output. Since `index` comes from `indexOf`, it will be `-1` or `>= 0`, so the behavior is unchanged.

---

## Correctness / Edge Cases
- `if (!host) return;` still prevents calling string methods on `undefined`/`null`.
- IPv6 handling logic is unchanged: it finds `]` and then searches for `:` after that to detect an appended port (e.g., `[::1]:3000`).
- If the host starts with `[` but is malformed (missing `]`), `indexOf(']')` returns `-1`, so `+ 1` yields `0`. That matches previous behavior.

No regressions apparent from the diff.

---

## Compatibility Considerations (Important)
The main potential risk is **runtime compatibility**:

- `String.prototype.startsWith` is ES6 and is not available in very old Node.js versions (notably Node 0.10 / early 0.12 without proper ES6 support).
- `host[0]` indexing works on older engines more broadly.

So whether this change is safe depends on the project’s **supported Node.js version range**:
- If the project supports only modern Node (>= 4+ / ideally >= 6+), this is fine.
- If the project still supports very old Node versions, this could be a breaking change.

This is the only meaningful “risk” in the PR.

---

## Performance
Negligible differences:
- `startsWith('[')` vs `host[0] === '['` is effectively the same order of cost for this usage.
- `slice` vs `substring` is also negligible.

This is primarily a readability/modernization change, not a performance change.

---

## Testing Recommendations
No new tests are strictly required if the project already covers hostname parsing, but if you want to be safe, ensure tests exist for:
- `example.com`
- `example.com:3000`
- `[::1]`
- `[::1]:3000`
- missing/undefined host behavior

---

## Requested Changes / Suggestions
1) **Confirm Node support policy**: If the library supports older Node versions where `startsWith` may not exist, prefer the original `host[0] === '['` (or add a compatibility shim), otherwise this is good.
2) If compatibility is a concern but you still want readability, a safe alternative is:
   ```js
   const offset = host.charAt(0) === '[' ? host.indexOf(']') + 1 : 0;
   ```
   (`charAt` is widely supported).

---

## Overall Verdict
- **Looks correct and behavior-preserving** for modern Node.js runtimes.
- **Only blocker** would be if this project guarantees compatibility with Node versions lacking `String.prototype.startsWith`.