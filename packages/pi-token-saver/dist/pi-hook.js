"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = activate;
const filter_engine_1 = require("./filter-engine");
const savings_tracker_1 = require("./savings-tracker");
function activate(pi) {
    const engine = new filter_engine_1.FilterEngine();
    const tracker = new savings_tracker_1.SavingsTracker();
    let passthroughEnabled = false;
    // Setup rules
    engine.register('git status', [filter_engine_1.stripAnsi, (0, filter_engine_1.truncateLinesAt)(50)]);
    engine.register('git log', [filter_engine_1.stripAnsi, (0, filter_engine_1.truncateLinesAt)(80)]);
    engine.register('ls', [filter_engine_1.stripAnsi, (0, filter_engine_1.truncateLinesAt)(50)]);
    engine.register('find', [filter_engine_1.stripAnsi, (0, filter_engine_1.truncateLinesAt)(100)]);
    engine.register('npm install', [filter_engine_1.stripAnsi, (0, filter_engine_1.truncateLinesAt)(30)]);
    engine.register('yarn install', [filter_engine_1.stripAnsi, (0, filter_engine_1.truncateLinesAt)(30)]);
    engine.register('pnpm install', [filter_engine_1.stripAnsi, (0, filter_engine_1.truncateLinesAt)(30)]);
    engine.register('bun install', [filter_engine_1.stripAnsi, (0, filter_engine_1.truncateLinesAt)(30)]);
    // Expose savings for other extensions
    pi.tokenSaver = {
        getSessionSavings: () => tracker.getSessionSavings(),
    };
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
