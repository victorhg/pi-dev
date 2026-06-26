import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

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
      statsContent = "| Name | Duration | Description |\n| --- | --- | --- |\n" + entry;
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
        console.log(table);
        return { content: [{ type: "text", text: table }] };
      }

      if (subcommand === "next") {
        const tasks = getTasks();
        const nextTask = tasks.find((t) => t.status === "UNDONE");

        if (!nextTask) {
          ctx.ui.notify("No UNDONE tasks found!", "warning");
          return;
        }

        if (!fs.existsSync(".pi")) fs.mkdirSync(".pi");
        fs.writeFileSync(STATE_FILE, JSON.stringify({ name: nextTask.name, startTime: Date.now() }));

        const ok = await ctx.ui.confirm("Next Task", `Start working on: ${nextTask.name}?`);
        if (ok) {
          ctx.ui.notify(`Starting task: ${nextTask.name}`, "info");
          pi.sendUserMessage(`Please search for the next task in Tasks.md and execute it: ${nextTask.name}`);
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

      if (subcommand === "run-loop") {
        let commandArg = args.slice(7).trim(); // skip "/task run-loop "
        if (!commandArg) {
          ctx.ui.notify("Missing command for loop. Usage: /task run-loop <count> <command> or /task run-loop <command>", "error");
          return;
        }

        let count = 10;
        let command = commandArg;

        // 1. Match: "execute the next X tasks"
        const taskLoopMatch = commandArg.match(/execute the next (\d+) tasks/i);
        if (taskLoopMatch) {
          count = parseInt(taskLoopMatch[1]);
          command = "TASK_LOOP_ITERATION_START";
        } else {
          // 2. Match: "<count> <command>" (e.g. "3 npm test")
          const firstSpaceIndex = commandArg.indexOf(" ");
          if (firstSpaceIndex !== -1) {
            const firstPart = commandArg.substring(0, firstSpaceIndex);
            const rest = commandArg.substring(firstSpaceIndex + 1).trim();
            if (/^\d+$/.test(firstPart)) {
              count = parseInt(firstPart);
              command = rest;
            }
          }
        }

        ctx.ui.notify(`Running loop (${count} iterations)...`, "info");
        try {
          let loopScript = "";
          if (command === "TASK_LOOP_ITERATION_START") {
            loopScript = `
              for i in \$(seq 1 $count); do
                echo "🔄 Task Loop Turn $i/$count"
                echo "TASK_LOOP_ITERATION_START"
                sleep 1
              done
            `;
          } else {
            loopScript = `
              for i in \$(seq 1 $count); do
                echo "🔄 Turn $i/$count"
                ${command}
                if [ $? -eq 0 ]; then
                  echo "✅ Command successful."
                  exit 0
                fi
                sleep 1
              done
              echo "⚠️ Reached max iterations."
              exit 1
            `;
          }

          const result = execSync(`bash -c '${loopScript}'`, { encoding: 'utf8' });
          return { content: [{ type: "text", text: result }] };
        } catch (e: any) {
          return { content: [{ type: "text", text: `Loop error: ${e.message}` }] };
        }
      }

      if (subcommand === "run-docker") {
        const commandArg = args.slice(13).trim();
        if (!commandArg) {
          ctx.ui.notify("Missing command for docker. Usage: /task run-docker <command>", "error");
          return;
        }

        ctx.ui.notify("Running in Docker...", "info");
        try {
          const dockerCmd = `docker run --rm -v "$(pwd)":/work -w /work node:20-slim /bin/bash -c "${commandArg}"`;
          const result = execSync(dockerCmd, { encoding: 'utf8' });
          return { content: [{ type: "text", text: result }] };
        } catch (e: any) {
          return { content: [{ type: "text", text: `Docker error: ${e.message}` }] };
        }
      }

      ctx.ui.notify("Invalid subcommand. Use: list, next, status, run-loop, run-docker", "error");
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

      const updated = updateTaskStatus(params.taskName, "DONE");
      if (!updated) {
        return {
          content: [{ type: "text", text: `Failed to update Tasks.md. Could not find task: ${params.taskName}` }],
          details: {},
        };
      }

      saveStat({
        name: params.taskName,
        duration: durationStr,
        description: params.description,
      });

      fs.unlinkSync(statePath);

      return {
        content: [{ type: "text", text: `Successfully completed task: ${params.taskName}` }],
        details: {},
      };
    },
  });
}