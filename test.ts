import { ExtensionAPI, ToolResultEvent, ExtensionContext, ToolResultEventResult } from "@earendil-works/pi-coding-agent";

async function test(pi: ExtensionAPI) {
  const handler = (event: ToolResultEvent, ctx: ExtensionContext): void | ToolResultEventResult | Promise<void | ToolResultEventResult> => {};
  pi.on('tool_result', handler);
}
