export type FooterSectionRenderer = () => string | undefined;

interface FooterRegistryShape {
  register(key: string, renderer: FooterSectionRenderer): void;
  getRenderers(): FooterSectionRenderer[];
}

// Pi loads each extension with jiti moduleCache: false, so module-level
// singletons are NOT shared across extensions. globalThis persists across
// all jiti module contexts within the same Node.js process.
const _g = globalThis as Record<string, unknown>;
if (!_g.__piFooterRegistry__) {
  const _renderers = new Map<string, FooterSectionRenderer>();
  _g.__piFooterRegistry__ = {
    register(key: string, renderer: FooterSectionRenderer) {
      _renderers.set(key, renderer);
    },
    getRenderers(): FooterSectionRenderer[] {
      return Array.from(_renderers.values());
    },
  } satisfies FooterRegistryShape;
}

export const footerRegistry = _g.__piFooterRegistry__ as FooterRegistryShape;
