import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import * as fs from "node:fs";
import * as path from "node:path";

interface TaskState {
  name: string;
  startTime: number;
}

interface TaskStat {
  name: string;
  duration: string;
  description: string;
}

export default function (pi: ExtensionAPI) {
  const TASKS_FILE = "Tasks.md";
  const STATS_FILE = "task_stats.md";
  const STATE_FILE = ".pi/task_manager_state.json";

  function getTasks(): { name: string; status: "DONE" | "UNDONE"; line: number; content: string }[] {
    if (!fs.existsSync(TASKS_FILE)) return [];
    const content = fs.readFileSync(TASKS_FILE, "utf-8");
    const lines = content.split("\n");
    const tasks: { name: string; status: "DONE" | "UNDONE"; line: number; content: string }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^\[TASK\]:\s*(.*?)\s*\[(UNDONE|DONE)\]/);
      if (match) {
        tasks.push({
          name: match[1].trim(),
          status: match[2] === "DONE" ? "DONE" : "UNDONE",
          line: i,
          content: lines[i],
        });
      }
    }
    return tasks;
  }

  function updateTaskStatus(taskName: string, newStatus: "DONE" | "UNDONE") {
    const tasks = getTasks();
    const task = tasks.find((t) => t.name === taskName);
    if (!task) return false;

    const content = fs.readFileSync(TASKS_FILE, "utf-8");
    const lines = content.split("\n");
    lines[task.line] = task.content.replace(/\[(UNDONE|DONE)\]/, `[${newStatus}]`);
    fs.writeFileSync(TASKS_FILE, lines.join("\n"));
    return true;
  }

  function saveStat(stat: TaskStat) {
    let statsContent = "";
    if (fs.existsSync(STATS_FILE)) {
      statsContent = fs.readFileSync(STATS_FILE, "utf-8");
    }
    const entry = `| ${stat.name} | ${stat.duration} | ${stat.description} |\n`;
    if (!statsContent.includes("| Name |")) {
      statsContent = "| Name | Duration | Description |\n| --- | --- | --- |\n" + entry + statsContent;
    } else {
      statsContent = statsContent.replace("| Name | Duration | Description |\n| --- | --- | --- |\n", `| Name | Duration | Description |\n| --- | --- | --- |\n${entry}`);
    }
    fs.writeFileSync(STATS_FILE, statsContent);
  }

  pi.registerCommand("task", {
    description: "Manage tasks using Tasks.md",
    handler: async (args, ctx) => {
      const subcommand = args.split(" ")[0].replace("/", "");

      if (subcommand === "list") {
        const tasks = getTasks();
        let table = "| Task Name | Status |\n| --- | --- |\n";
        tasks.forEach((t) => {
          table += `| ${t.name} | ${t.status} |\n`;
        });
        ctx.ui.notify("Task List", "info");
        console.log(table); // Using console.log as a fallback for terminal output in TUI
        // In a real TUI we might want a better way to display tables, but for now:
        return { content: [{ type: "text", text: table }] };
      }

      if (subcommand === "next") {
        const tasks = getTasks();
        const nextTask = tasks.find((t) => t.status === "UNDONE");

        if (!nextTask) {
          ctx.ui.notify("No UNDONE tasks found!", "warning");
          return;
        }

        // Save state
        if (!fs.existsSync(".pi")) fs.mkdirSync(".pi");
        fs.writeFileSync(STATE_FILE, JSON.stringify({ name: nextTask.name, startTime: Date.now() }));

        const ok = await ctx.ui.confirm("Next Task", `Start working on: ${nextTask.name}?`);
        if (ok) {
          await ctx.sendUserMessage(`Start working on the following task: ${nextTask.name}`);
        } else {
          if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
        }
        return;
      }

      if (subcommand === "status") {
        if (!fs.existsSync(STATS_FILE)) {
          ctx.ui.notify("No stats recorded yet.", "info");
          return;
        }
        const stats = fs.readFileSync(STATS_FILE, "utf-8");
        return { content: [{ type: "text", text: stats }] };
      }

      ctx.ui.notify("Invalid subcommand. Use: list, next, status", "error");
    },
  });

  pi.registerTool({
    name: "complete_task",
    label: "Complete Task",
    description: "Marks a task as DONE in Tasks.md and logs stats.",
    parameters: Type.Object({
      taskName: Type.String({ description: "The exact name of the task as written in Tasks.md" }),
      description: Type.String({ description: "A one-liner description of the work done" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const statePath = STATE_FILE;
      if (!fs.existsSync(statePath)) {
        return {
          content: [{ type: "text", text: "No active task found in state. Please use /task next first." }],
          details: {},
        };
      }

      const stateStr = fs.readFileSync(statePath, "utf-8");
      const state: TaskState = JSON.parse(stateStr);

      if (state.name !== params.taskName) {
        return {
          content: [{ type: "text", text: `Task name mismatch. Active task: ${state.name}, requested: ${params.taskName}` }],
          details: {},
        };
      }

      const endTime = Date.now();
      const durationMs = endTime - state.startTime;
      const durationStr = `${Math.round(durationMs / 1000)}s`;

      // 1. Update Tasks.md
      const updated = updateTaskStatus(params.taskName, "DONE");
      if (!updated) {
        return {
          content: [{ type: "text", text: `Failed to update Tasks.md. Could not find task: ${params.taskName}` }],
          details: {},
        };
      }

      // 2. Save Stats
      saveStat({
        name: params.taskName,
        duration: durationStr,
        description: params.description,
      });

      // 3. Cleanup state
      fs.unlinkSync(statePath);

      return {
        content: [{ type: "text", text: `Successfully completed task: ${params.taskName}` }],
        details: {},
      };
    },
  });
}
