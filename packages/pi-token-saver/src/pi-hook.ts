import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { FilterEngine, stripAnsi, truncateLinesAt } from './filter-engine';
import { SavingsTracker } from './savings-tracker';
import { footerRegistry } from "@victorhg/pi-footer/registry";

export default function activate(pi: ExtensionAPI) {
  const engine = new FilterEngine();
  const tracker = new SavingsTracker();
  let passthroughEnabled = false;

  // Setup rules
  engine.register('git status', [stripAnsi, truncateLinesAt(50)]);
  engine.register('git log', [stripAnsi, truncateLinesAt(80)]);
  engine.register('ls', [stripAnsi, truncateLinesAt(50)]);
  engine.register('find', [stripAnsi, truncateLinesAt(100)]);
  engine.register('npm install', [stripAnsi, truncateLinesAt(30)]);
  engine.register('yarn install', [stripAnsi, truncateLinesAt(30)]);
  engine.register('pnpm install', [stripAnsi, truncateLinesAt(30)]);
  engine.register('bun install', [stripAnsi, truncateLinesAt(30)]);

  // Register with footer if available
  footerRegistry.register('token-saver', () => {
    const savingsKB = (tracker.getSessionSavings() / 1024).toFixed(1);
    return `💰${savingsKB}KB`;
  });

  pi.registerCommand('token-saver:passthrough', {
    description: 'Bypass filtering for next command',
    handler: async (_args, ctx) => {
      passthroughEnabled = true;
      if (ctx.hasUI) ctx.ui.notify("Passthrough mode enabled for the next command.", 'info');
    }
  });

  // Event hook
  pi.on('tool_result', async (event: any) => {
    if (passthroughEnabled) {
      passthroughEnabled = false;
      return;
    }

    if (event.tool === 'bash' && event.data?.output) {
      const originalOutput = event.data.output;
      const command = event.data.command;

      const filteredOutput = engine.apply(command, originalOutput);

      if (filteredOutput !== originalOutput) {
        tracker.record(command, originalOutput.length, filteredOutput.length);
        event.data.output = filteredOutput;
      }
    }
  });
}
