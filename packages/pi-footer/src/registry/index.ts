export type FooterSectionRenderer = () => string | undefined;

class FooterRegistry {
  private renderers: Map<string, FooterSectionRenderer> = new Map();

  register(key: string, renderer: FooterSectionRenderer) {
    this.renderers.set(key, renderer);
  }

  getRenderers() {
    return Array.from(this.renderers.values());
  }
}

export const footerRegistry = new FooterRegistry();
