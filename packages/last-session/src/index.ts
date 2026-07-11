import * as fs from 'fs/promises';
import * as path from 'path';

// Define the path to the session file relative to the project root
const SESSION_FILE = path.join(process.cwd(), '.last-session');

/**
 * Represents the saved state of the session.
 * In a real implementation, this would be much richer (e.g., chat history, current cursor position).
 */
interface SessionState {
  savedAt: string;
  contextSummary: string;
  lastKnownFile: string | null;
  // Placeholder for more complex context if available from the Pi Agent environment
  // e.g., lastCommand: string;
}

/**
 * Reads the last saved session state from the file.
 * @returns {Promise<SessionState | null>} The session state or null if the file doesn't exist.
 */
export async function readSession(): Promise<SessionState | null> {
  try {
    const content = await fs.readFile(SESSION_FILE, 'utf-8');
    return JSON.parse(content) as SessionState;
  } catch (error) {
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
 * Placeholder for generating a compact session summary.
 * In a full Pi integration, this would query the agent's memory/state.
 */
export async function compactSession(): Promise<string> {
    // For this implementation, we'll use a placeholder summary.
    // In a real scenario, this would be the complex part that captures the state.
    console.log('Compacting session... (using placeholder logic)');
    return "This is a placeholder summary of the current work context. Full state capture requires Pi agent introspection.";
}

/**
 * Logic for /refresh-session: Compact, then start new, then load old.
 * This simulates a clean slate startup with retained context.
 */
export async function refreshSession(): Promise<void> {
    console.log('\n🚀 Executing /refresh-session sequence...');

    // 1. Run /compact command and save
    const summary = await compactSession();
    await saveSession(summary);

    // 2. Run /new command (Simulated: means starting fresh)
    console.log('💡 Simulating starting a new session...');
    // In a real agent, this would trigger a system command to reset state variables.

    // 3. Read <project-root>/.last-session
    const savedState = await readSession();
    if (savedState) {
        console.log('\n🎉 Session refreshed! Restoring context...');
        console.log('--- RESTORED CONTEXT ---');
        console.log(`Summary: ${savedState.contextSummary}`);
        console.log(`Last File: ${savedState.lastKnownFile || 'N/A'}`);
        console.log('------------------------\n');
    } else {
        console.log('Session file was empty or failed to load after refresh.');
    }
}

// --- Command Handlers (These would be registered with the Pi Agent API) ---

/**
 * Handles the /save-session command.
 * @param context The execution context (e.g., file path).
 */
export async function handleSaveSession(context: { currentFile?: string }): Promise<void> {
    console.log('\n💾 Executing /save-session...');
    // In a real system, 'context.summary' would come from the agent's current thoughts.
    const placeholderSummary = "User initiated session save command.";
    await saveSession(placeholderSummary, context.currentFile || null);
}

/**
 * Handles the /refresh-session command.
 */
export async function handleRefreshSession(): Promise<void> {
    await refreshSession();
}

/**
 * Handles the /last-session command.
 */
export async function handleLastSession(): Promise<void> {
    console.log('\n🔎 Executing /last-session...');
    const state = await readSession();
    if (state) {
        console.log('--- LAST SESSION CONTEXT ---');
        console.log(`Saved At: ${state.savedAt}`);
        console.log(`Summary: ${state.contextSummary}`);
        console.log(`Last Known File: ${state.lastKnownFile || 'N/A'}`);
        console.log('-----------------------------');
    } else {
        console.log('No previous session found.');
    }
}

// Export handlers for potential registration
export const commands = {
    "save-session": handleSaveSession,
    "refresh-session": handleRefreshSession,
    "last-session": handleLastSession,
};