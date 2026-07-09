# Dependency Overrides

Review this file before changing pnpm overrides or root dependencies to avoid breaking workspace resolution.

- Ensure `pi-*` packages use `workspace:*` protocols.
- Avoid external dependencies that conflict with the Pi agent core dependencies.
