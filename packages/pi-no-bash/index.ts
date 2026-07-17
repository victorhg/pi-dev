import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash") {
      console.warn("[pi-no-bash] bash tool call blocked. This deployment does not permit shell execution. Expose specific capabilities via explicit Pi extensions.");
      return { block: true, reason: "pi-no-bash active" };
    }
  });
}
