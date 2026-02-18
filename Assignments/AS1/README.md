
# Golden Dataset: Expected Findings for bad_code.ts

## Security Auditor — Expected Findings

| # | Line(s) | Severity | Issue | Key Indicator |
|---|---------|----------|-------|---------------|
| S1 | 5 | critical | Hardcoded API key (`sk-proj-abc123...`) | `API_KEY = "sk-` |
| S2 | 6 | critical | Hardcoded database password (`admin123!`) | `DB_PASSWORD = "admin` |
| S3 | 19 | warn | API key passed in URL query string (leaks in logs/history) | `?api_key=${API_KEY}` |
| S4 | 26 | critical | SQL injection — raw string concatenation in query | `"SELECT * FROM users WHERE name = '" + userInput + "'"` |
| S5 | 69 | critical | Logging plaintext password to console | `console.log(\`Login attempt: ${username} / ${password}\`)` |
| S6 | 70 | warn | Comparing password with hardcoded value / no hashing | `password == DB_PASSWORD` |
| S7 | 18 | warn | HTTP used instead of HTTPS for API call | `http://api.example.com` |

**Minimum pass criteria:** Must catch S1, S2, S4, S5 (4/7). Catching all 7 = perfect.

---

## Maintainability Critic — Expected Findings

| # | Line(s) | Severity | Issue | Key Indicator |
|---|---------|----------|-------|---------------|
| M1 | 1 | info | Unused import (`join` from `path` is never used) | `import { join }` |
| M2 | 85 | warn | Missing import (`fs` is used but never imported) | `fs.writeFileSync` |
| M3 | 17,20,21 | warn | Poor variable names: `x`, `d` in `fetchUserData` | Single-letter names |
| M4 | 57 | warn | Poor variable names: `p`, `d`, `t` in `calculateDiscount` | Single-letter params |
| M5 | 75 | warn | Poor variable name: `u` in `greetUser` | Single-letter param |
| M6 | 30 | warn | Overuse of `any` type (params and variables) | `data: any`, `temp: any` |
| M7 | 33-43 | info | Deeply nested if-statements (pyramid of doom) — should use early returns or guard clauses | 3 levels of nesting |
| M8 | 58 | info | Useless comment that just restates the code (`// calculate discount`) | Comment adds no value |
| M9 | 76 | info | Using `var` instead of `const`/`let` | `var msg =` |
| M10 | 30 | info | `temp` is a meaningless variable name | `let temp: any = []` |
| M11 | 57-65 | info | `calculateDiscount` uses `==` instead of `===` | Loose equality |
| M12 | 4 | info | TODO comment left in code | `// TODO: fix this later` |

**Minimum pass criteria:** Must catch M1 or M2, at least two of M3/M4/M5, and M6 (4/12). Catching 8+ = excellent.

---

## Scoring Guide

For each reviewer run, calculate:

- **Recall** = (expected issues caught) / (total expected issues)
- **Precision** = (correct issues found) / (total issues reported) — penalizes hallucinations
- **Score** = average of Recall and Precision

| Rating | Score |
|--------|-------|
| Excellent | ≥ 85% |
| Good | 70–84% |
| Needs improvement | 50–69% |
| Failing | < 50% |

### Quality threshold to ship: Both reviewers ≥ 70%.