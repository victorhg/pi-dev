# my-pi

A curated distribution of the Pi coding agent, including custom skills, packages, and workflow automation.

## Why this distribution?

Pi is a powerful coding assistant, but managing agent behavior, themes, and extensions across projects can become complex. This distribution provides:

- **Standardized Skills**: A set of `.agents/` definitions to ensure consistent behavior across all your development tasks.
- **Curated Assets**: Ready-to-use packages like `@victorhg/pi-themes` to style your terminal experience.
- **Workflow Governance**: Documented processes to ensure maintainability, validation, and release quality.
- **Extensibility**: A structured monorepo environment designed for building and testing your own Pi extensions.

## Installation

This repository provides several packages that can be installed into your Pi environment.

### Themes
To install the curated themes and styling assets:

```bash
pi install npm:@victorhg/pi-themes
```

### Session Management
To install the session management extension:

```bash
pi install npm:@victorhg/pi-last-session
```

## Backlog

For features not yet implemented, please refer to the `new-features.md` backlog file.

## Skills

Skills are located in the `.agents/` directory and are used to govern agent behavior for specific tasks.

- **pi-extension-development**: Used when building or modifying Pi extensions and packages.
- **pi-package-sandbox-test**: Used to validate published package installability.
- **pi-primitive-check**: Used to evaluate customisation work against built-in Pi primitives before implementation.
- **pi-release-workflow**: Used when preparing or validating monorepo releases.
- **pi-validation-flow**: Used to validate repository changes before finalizing implementation.
- **system-info**: Used to provide contextual information about the environment.

## Inspiration

This project draws inspiration from [my-pi by spences10](https://github.com/spences10/my-pi/tree/main), which provides a foundation for curated Pi distributions.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
