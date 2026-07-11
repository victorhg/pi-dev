import * as fs from 'fs/promises';
import * as path from 'path';
// Define the path to the session file relative to the project root
const SESSION_FILE = path.join(process.cwd(), '.last-session');
/**
 * Safely find the last known file path from the session's tool calls.
 */
function getLastKnownFile(ctx) {
    const entries = ctx.sessionManager.getEntries();
    // Traverse backwards
    for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (entry.type === 'message' && entry.message) {
            const message = entry.message;
            if (message.role === 'assistant' && Array.isArray(message.content)) {
                for (const block of message.content) {
                    if (block.type === 'toolCall' && block.arguments) {
                        const toolName = block.name;
                        if (['read', 'edit', 'write', 'grep', 'find'].includes(toolName)) {
                            if (block.arguments && typeof block.arguments.path === 'string') {
                                return block.arguments.path;
                            }
                        }
                    }
                }
            }
        }
    }
    return null;
}
/**
 * Reads the last saved session state from the file.
 * @returns {Promise<SessionState | null>} The session state or null if the file doesn't exist.
 */
export async function readSession() {
    try {
        const content = await fs.readFile(SESSION_FILE, 'utf-8');
        return JSON.parse(content);
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            console.log('Session file not found. Starting fresh session.');
            return null;
        }
        console.error('Error reading session file:', error);
        return null;
    }
}
/**
 * Saves the current session context to the file.
 * @param summary - A human-readable summary of the work done.
 * @param lastKnownFile - The file that was last being worked on.
 */
export async function saveSession(summary, lastKnownFile = null) {
    const state = {
        savedAt: new Date().toISOString(),
        contextSummary: summary,
        lastKnownFile: lastKnownFile,
    };
    try {
        await fs.writeFile(SESSION_FILE, JSON.stringify(state, null, 2));
        console.log(`✅ Session successfully saved to ${SESSION_FILE}`);
    }
    catch (error) {
        console.error('❌ Error saving session:', error);
    }
}
/**
 * Placeholder for generating a compact session summary.
 */
export async function compactSession() {
    console.log('Compacting session... (using placeholder logic)');
    return "This is a placeholder summary of the current work context. Full state capture requires Pi agent introspection.";
}
/**
 * Default export registering commands with the Pi Agent API.
 */
export default function (pi) {
    // Register /save-session
    pi.registerCommand("save-session", {
        description: "Compact and save current session context",
        handler: async (args, ctx) => {
            ctx.ui.notify("Saving session...", "info");
            const currentFile = getLastKnownFile(ctx);
            const summary = args || "User initiated session save command.";
            await saveSession(summary, currentFile);
            ctx.ui.notify("✅ Session successfully saved!", "info");
        }
    });
    // Register /refresh-session
    pi.registerCommand("refresh-session", {
        description: "Save current session, start new, and restore context",
        handler: async (args, ctx) => {
            ctx.ui.notify("Saving current context...", "info");
            const summary = await compactSession();
            const currentFile = getLastKnownFile(ctx);
            await saveSession(summary, currentFile);
            ctx.ui.notify("Starting fresh session with restored context...", "info");
            await ctx.newSession({
                setup: async (sm) => {
                    const savedState = await readSession();
                    if (savedState) {
                        sm.appendMessage({
                            role: "user",
                            content: [{
                                    type: "text",
                                    text: `🔄 RESTORED SESSION CONTEXT:\n\nSummary: ${savedState.contextSummary}\nLast Known File: ${savedState.lastKnownFile || 'N/A'}`
                                }],
                            timestamp: Date.now()
                        });
                    }
                },
                withSession: async (newCtx) => {
                    newCtx.ui.notify("🎉 Session refreshed and context successfully restored!", "info");
                }
            });
        }
    });
    // Register /last-session
    pi.registerCommand("last-session", {
        description: "Read the last saved session context",
        handler: async (args, ctx) => {
            const state = await readSession();
            if (state) {
                ctx.ui.notify(`📅 Saved At: ${state.savedAt}\n📝 Summary: ${state.contextSummary}\n📁 Last Known File: ${state.lastKnownFile || 'N/A'}`, "info");
            }
            else {
                ctx.ui.notify("No previous session found.", "warning");
            }
        }
    });
}
