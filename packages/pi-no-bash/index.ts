import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash") {
      console.warn("The no-bash extension does not allow bash tool calling.");
      return { block: true, reason: "pi-no-bash active" };
    }
  });
}
