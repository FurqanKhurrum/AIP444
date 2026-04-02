# Repository Guidelines

## Project
This library encodes media files as Base64 Data URIs and decodes Data URIs back to binary data. It targets common image, audio, and video formats for use with multimodal tooling and tests.

## Project Structure & Module Organization
- `src/` holds the TypeScript library code (currently empty; expected files include `encode.ts`, `decode.ts`, `types.ts`, and `index.ts`).
- `tests/` holds Vitest test suites (expected pattern: `*.test.ts`).
- `tests/fixtures/` contains small media files used by tests (e.g., `test.png`, `test.jpg`, `test.svg`).
- `package.json` defines scripts and dependencies; `tsconfig.json` enables strict TypeScript settings.

## Build, Test, and Development Commands
Use `pnpm` (declared in `package.json`), though `npm` equivalents also work.
- `pnpm test` — run the full Vitest suite once.
- `pnpm run test:watch` — watch mode for local TDD.
- `pnpm run typecheck` — run `tsc --noEmit` for strict type validation.

## Coding Style & Naming Conventions
- TypeScript is in strict mode; avoid `any` and prefer explicit types for public APIs.
- No formatter or linter is configured; keep formatting consistent with existing files and use LF line endings.
- File naming: lower-case with dots for roles, e.g., `encode.ts`, `decode.ts`.
- Type and class names: `PascalCase` (e.g., `DataURI`). Functions and variables: `camelCase` (e.g., `encodeFile`).

## Testing Guidelines
- Framework: Vitest.
- Test files should live in `tests/` and end with `.test.ts`.
- Use `tests/fixtures/` for binary/text inputs; avoid inlining large Base64 payloads in test code.
- There are no explicit coverage targets; prioritize meaningful edge cases and error paths.

## Commit & Pull Request Guidelines
- Git history is minimal and does not show a consistent convention. If you add commits, prefer Conventional Commits for clarity (e.g., `feat: add encode helpers`).


## Agent-Specific Instructions
- Keep changes small and test-driven.
- Update or add tests alongside implementation changes.
- Validate outputs against the Zod schemas in `src/types.ts` when those files are added.
