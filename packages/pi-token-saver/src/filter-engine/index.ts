export interface Filter {
  name: string;
  apply: (output: string) => string;
}

export type FilterPipeline = Filter[];

export class FilterEngine {
  private registries: Map<string, FilterPipeline> = new Map();

  register(commandPattern: string, pipeline: FilterPipeline) {
    this.registries.set(commandPattern, pipeline);
  }

  apply(command: string, output: string): string {
    const pipeline = this.findPipeline(command);
    if (!pipeline) return output;

    let processed = output;
    for (const filter of pipeline) {
      processed = filter.apply(processed);
    }
    return processed;
  }

  applyWithMetadata(command: string, output: string): { output: string; matched: boolean } {
    const pipeline = this.findPipeline(command);
    if (!pipeline) {
      return { output, matched: false };
    }

    let processed = output;
    for (const filter of pipeline) {
      processed = filter.apply(processed);
    }

    return { output: processed, matched: true };
  }

  private findPipeline(command: string): FilterPipeline | undefined {
    const normalizedCommand = this.normalizeCommand(command);

    for (const [pattern, pipeline] of this.registries.entries()) {
      const normalizedPattern = this.normalizeCommand(pattern);
      if (normalizedCommand.startsWith(normalizedPattern)) {
        return pipeline;
      }
    }
    return undefined;
  }

  private normalizeCommand(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
  }
}

// Common filters
export const stripAnsi: Filter = {
  name: 'stripAnsi',
  apply: (output) => output.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, ''),
};

export const truncateLinesAt = (maxLines: number): Filter => ({
  name: `truncateLinesAt:${maxLines}`,
  apply: (output) => {
    const lines = output.split('\n');
    return lines.slice(0, maxLines).join('\n');
  },
});
