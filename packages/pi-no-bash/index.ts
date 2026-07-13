import type { Extension } from "@earendil-works/pi-coding-agent";

// Define the tool_middleware function
const toolMiddleware = async (call: any): Promise<{ status: 'blocked', reason: string } | any> => {
  // Check if the tool is 'bash'
  if (call.tool === 'bash') {
    console.warn('The no-bash extension does not allow bash tool calling.');
    // Return a structure that signals blocking to the Pi runtime
    return { status: 'blocked', reason: 'pi-no-bash active' };
  }
  // If not a bash tool, allow it to proceed by returning the original call
  return call;
};

export const piNoBash = {
  name: 'pi-no-bash',
  tool_middleware: toolMiddleware, // Use the tool_middleware hook for pre-execution interception
};

// Factory function for extension loading
export default function() {
  return piNoBash;
}
