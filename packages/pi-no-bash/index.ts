export const piNoBash = {
  name: 'pi-no-bash',
  onToolCall: (call: any) => {
    if (call.tool === 'bash') {
      // Logic to block or intercept
      console.warn('Bash tool execution is restricted');
      return { status: 'blocked', reason: 'pi-no-bash active' };
    }
  }
};

export default function() {
  return piNoBash;
}
