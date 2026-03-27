# AIP444

Winter 2026 repo.

## Installation

Install all dependencies from the repo root:
```sh
pnpm install
```

Create a `.env` file in the repo root with the following keys:
```
OPENROUTER_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
```

---

## Labs

### Lab 1 — Git Scribe

A CLI tool that reads your staged git changes and uses an LLM to generate a conventional commit message. Supports a `--creative` flag for pirate-mode commit messages.
```sh
cd labs/lab-01
node scribe.js
node scribe.js --creative
```

---