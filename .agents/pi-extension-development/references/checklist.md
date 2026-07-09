# Pi Extension Package Checklist

## New package

- `packages/<name>/package.json`
  - package name is `@victorhg/<name>`
  - has `type: module`
  - exposes `dist/index.js`
  - includes `check:self`, `test:self`, and `build:self` where
    appropriate
- `packages/<name>/src/index.ts`
  - default export accepts Pi extension API
  - pure helpers exported for tests
- `packages/<name>/src/index.test.ts`
- `packages/<name>/README.md`
- `packages/<name>/CHANGELOG.md` if package is versioned

## Built-in wiring

- Root `package.json` optional dependency points to `workspace:*`.
- `src/extensions/builtin-registry.ts` has key, option name, flag,
  aliases, description, and dynamic import.
- Registry tests updated when extension list/order changes.
- Root lockfile updated with `pnpm install` when dependencies change.

## Validation

Run targeted checks first:

```bash
pnpm --filter @victorhg/<name> run check:self
pnpm --filter @victorhg/<name> run test:self
```

If root files or registry changed:

```bash
pnpm run check
```

Use LSP diagnostics on changed TypeScript files before reporting
completion.
