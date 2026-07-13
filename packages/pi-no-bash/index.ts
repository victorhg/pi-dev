import type { PiExtension } from '../../types'; // Adjust import based on your real types

export const piNoBash: PiExtension = {
  name: 'pi-no-bash',
  onToolCall: (call) => {
    if (call.tool === 'bash') {
      // Logic to block or intercept
      console.warn('Bash tool execution is restricted');
      return { status: 'blocked', reason: 'pi-no-bash active' };
    }
  }
};
