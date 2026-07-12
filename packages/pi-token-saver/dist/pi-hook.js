import { FilterEngine, stripAnsi, truncateLinesAt } from './filter-engine';
import { SavingsTracker } from './savings-tracker';
export default async function activate(pi) {
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
    // Optionally register with pi-footer if it is installed — no hard dependency
    try {
        const { footerRegistry } = await import('@victorhg/pi-footer/registry');
        footerRegistry.register('token-saver', () => {
            const savingsKB = (tracker.getSessionSavings() / 1024).toFixed(1);
            return `💰${savingsKB}KB`;
        });
    }
    catch (err) {
        // Silently ignore if @victorhg/pi-footer is not installed
    }
    pi.registerCommand('token-saver:savings', {
        description: 'Show total tokens saved this session',
        handler: async (_args, ctx) => {
            const totalBytes = tracker.getSessionSavings();
            const totalKB = (totalBytes / 1024).toFixed(2);
            const commandCount = tracker.getHistory().length;
            const message = commandCount === 0
                ? 'No savings recorded yet — run a filtered command (e.g. git status, ls) first.'
                : `💰 Session savings: ${totalKB} KB (${totalBytes.toLocaleString()} bytes) across ${commandCount} command${commandCount === 1 ? '' : 's'}.`;
            if (ctx.hasUI)
                ctx.ui.notify(message, 'info');
            else
                console.log(message);
        }
    });
    pi.registerCommand('token-saver:history', {
        description: 'Show per-command token savings breakdown for this session',
        handler: async (_args, ctx) => {
            const history = tracker.getHistory();
            if (history.length === 0) {
                const msg = 'No savings recorded yet — run a filtered command (e.g. git status, ls) first.';
                if (ctx.hasUI)
                    ctx.ui.notify(msg, 'info');
                else
                    console.log(msg);
                return;
            }
            const lines = ['Token savings breakdown:'];
            for (const record of history) {
                const kb = (record.bytesSaved / 1024).toFixed(2);
                const time = new Date(record.timestamp).toLocaleTimeString();
                lines.push(`  [${time}] ${record.command} — saved ${kb} KB`);
            }
            const totalKB = (tracker.getSessionSavings() / 1024).toFixed(2);
            lines.push(`Total: ${totalKB} KB`);
            const msg = lines.join('\n');
            if (ctx.hasUI)
                ctx.ui.notify(msg, 'info');
            else
                console.log(msg);
        }
    });
    pi.registerCommand('token-saver:passthrough', {
        description: 'Bypass filtering for next command',
        handler: async (_args, ctx) => {
            passthroughEnabled = true;
            if (ctx.hasUI)
                ctx.ui.notify("Passthrough mode enabled for the next command.", 'info');
        }
    });
    // Event hook
    pi.on('tool_result', async (event) => {
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
