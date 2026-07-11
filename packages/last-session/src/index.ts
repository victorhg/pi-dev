import * as fs from 'fs/promises';
import * as path from 'path';
import type { ExtensionAPI, ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import { generateSummary, sessionEntryToContextMessages } from '@earendil-works/pi-coding-agent';

// Define the path to the session file relative to the project root
const SESSION_FILE = path.join(process.cwd(), '.last-session');

/**
 * Represents the saved state of the session.
 */
interface SessionState {
  savedAt: string;
  contextSummary: string;
  lastKnownFile: string | null;
}

/**
 * Safely find the last known file path from the session's tool calls.
 */
function getLastKnownFile(ctx: ExtensionCommandContext): string | null {
  const entries = ctx.sessionManager.getEntries();
  // Traverse backwards
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.type === 'message' && entry.message) {
      const message = entry.message as any;
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
export async function readSession(): Promise<SessionState | null> {
  try {
    const content = await fs.readFile(SESSION_FILE, 'utf-8');
    return JSON.parse(content) as SessionState;
  } catch (error: any) {
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
export async function saveSession(summary: string, lastKnownFile: string | null = null): Promise<void> {
  const state: SessionState = {
    savedAt: new Date().toISOString(),
    contextSummary: summary,
    lastKnownFile: lastKnownFile,
  };

  try {
    await fs.writeFile(SESSION_FILE, JSON.stringify(state, null, 2));
    console.log(`✅ Session successfully saved to ${SESSION_FILE}`);
  } catch (error) {
    console.error('❌ Error saving session:', error);
  }
}

/**
 * Generates a compact session summary using the active model if available,
 * falling back to a placeholder if no model is active or accessible.
 */
export async function compactSession(ctx: ExtensionCommandContext): Promise<string> {
  const model = ctx.model;
  if (!model) {
    console.warn('No active model in context to generate session summary. Using placeholder.');
    return "This is a placeholder summary of the current work context. Full state capture requires Pi agent introspection.";
  }

  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth || !auth.ok || !auth.apiKey) {
    console.warn('No API key available for current model to generate session summary. Using placeholder.');
    return "This is a placeholder summary of the current work context. Full state capture requires Pi agent introspection.";
  }

  try {
    const branch = ctx.sessionManager.getBranch();
    const currentMessages = branch.flatMap(sessionEntryToContextMessages);

    if (currentMessages.length === 0) {
      return "Empty session history.";
    }

    const summary = await generateSummary(
      currentMessages,
      model,
      model.maxTokens > 0 ? model.maxTokens : 16384,
      auth.apiKey,
      auth.headers,
      ctx.signal,
      undefined, // customInstructions
      undefined, // previousSummary
      undefined, // thinkingLevel
      undefined, // streamFn
      auth.env
    );

    return summary;
  } catch (error) {
    console.error('Error generating session summary with model:', error);
    return "This is a placeholder summary of the current work context. Full state capture requires Pi agent introspection.";
  }
}

/**
 * Default export registering commands with the Pi Agent API.
 */
export default function (pi: ExtensionAPI) {
  // Register /save-session
  pi.registerCommand("save-session", {
    description: "Compact and save current session context",
    handler: async (args: string | undefined, ctx: ExtensionCommandContext) => {
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
    handler: async (args: string | undefined, ctx: ExtensionCommandContext) => {
      ctx.ui.notify("Saving current context...", "info");
      const summary = await compactSession(ctx);
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
    handler: async (args: string | undefined, ctx: ExtensionCommandContext) => {
      const state = await readSession();
      if (state) {
        ctx.ui.notify(
          `📅 Saved At: ${state.savedAt}\n📝 Summary: ${state.contextSummary}\n📁 Last Known File: ${state.lastKnownFile || 'N/A'}`,
          "info"
        );
      } else {
        ctx.ui.notify("No previous session found.", "warning");
      }
    }
  });
}
