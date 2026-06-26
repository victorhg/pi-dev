# Task Manager Extension for Pi

The **Task Manager** is a powerful extension for the Pi coding agent designed to streamline project management, track progress, and execute complex workflows through automated loops and isolated environments.

## 🚀 Features

### 📋 Task Management
Keep your project organized using a standard `Tasks.md` file.
- **`list`**: View all current tasks and their statuses.
- **`next`**: Automatically find the next `[UNDONE]` task and prepare the agent to work on it.
- **`complete_task` (Tool)**: A dedicated tool for the agent to mark tasks as `[DONE]` and log performance statistics.

### 🔄 Automated Loops (`run-loop`)
Execute commands repeatedly until they succeed. Perfect for debugging or running tests that require multiple attempts.
- **Usage**: `/task run-loop <command>`
- **Example**: `/task run-loop npm test`
- **Behavior**: Runs the command up to 10 times. If the command exits with code `0`, the loop succeeds.

### 🐳 Isolated Docker Execution (`run-docker`)
Run commands inside a clean, containerized environment to ensure safety and consistency.
- **Usage**: `/task run-docker <command>`
- **Example**: `/task run-docker node -v`
- **Behavior**: Spins up a `node:20-slim` container, mounts your current directory to `/work`, and executes the command within that sandbox.

### 📊 Statistics Tracking
Automatically tracks how long tasks take and provides a summary of your productivity in `task_stats.md`.
- **`status`**: View a table of all completed tasks, their durations, and descriptions.

---

## 📖 Tutorial

### 1. Setting up your tasks
Create a `Tasks.md` file in your project root. Use the following format:

```markdown
[TASK]: Setup project structure [DONE]
[TASK]: Implement websearch skill [UNDONE]
[TASK]: Write unit tests [UNDONE]
```

### 2. Starting a workflow
Tell the agent to start the next task:
> "Use the `/task next` command to start the next item on my list."

### 3. Automating a difficult task
If a task involves fixing a test that keeps failing, use the loop command:
> "Run `/task run-loop npm test` to keep trying until the tests pass."

### 4. Running commands safely
If you want to test a script without risking your local environment:
> "Run `/task run-docker python3 script.py` to execute the script inside a Docker container."

### 5. Closing a task
When the agent finishes, it will use the `complete_task` tool. You can also check your progress:
> "Show me my task `/task status` to see how long my tasks are taking."

---

## 🛠 Installation & Requirements

- **Docker**: Required for the `run-docker` command.
- **Node.js**: The extension is built with TypeScript/Node.js.
- **Pi Agent**: Must be running the Pi coding agent harness.

*Note: Ensure your `Tasks.md` follows the exact `[TASK]: Name [STATUS]` format for the parser to work correctly.*
