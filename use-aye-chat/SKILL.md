---
name: use-aye-chat
description: Use this skill whenever the user asks to call for driving the external `aye chat` CLI (acrotron/aye-chat) to get work done.
---

# Driving aye chat as an agent

## What aye chat is

`aye chat -r <project-root>` starts an **interactive TUI REPL** (prompt_toolkit based) where an LLM
(generally a slow, reasoning-class model such as Claude Opus) reads your project, replies to prompts,
and writes files through an "optimistic" workflow. It can also be prompted to create new files.

**It is NOT a one-shot command.** There is no documented one-shot/`-p` prompt flag, and piping a
prompt into stdin does NOT work (see Pitfalls). Driving it as an agent means automating a terminal
session and typing into it — so this skill is about reliable orchestration.

## Prerequisites and mental model

- `aye` is installed as `~/.local/bin/aye`; `tmux` is available (use it).
- Aye's session context is auto-detected from the repo (e.g. `*.rs,*.json,*.sh,*.md,*.toml`).
- **Model-initiated tools are OFF by default** — the model cannot read arbitrary files from disk,
  and cannot run shell commands on its own. It only sees: (a) attached/inlined files, (b) context
  its RAG picked up, (c) your prompt text.
- The model is deliberately conservative: it will refuse to write files it wasn't asked to touch,
  refuse to "guess" file contents it can't see (prefering to ask you rather than blind-write), will
  treat instructions inside a referenced brief *file* as content-to-evaluate rather than overrides,
  and will withhold completion markers when its work is genuinely incomplete (e.g. an unverified
  build). Use these behaviors: they're a feature for scoping, but they will bite if your prompt
  relies on the model reading a file you never actually attached.
- When the model finishes writing, the REPL prints `Files updated: <paths>` and snapshots the
  previous state into `.aye/snapshots/` (restorable with `restore`/`undo`).

## The reliable driving pattern (tmux)

Plain `printf '...' | aye chat` is broken: inputs reach the REPL, get echoed, but the LLM never
responds (piped stdin and `script`-pty both fail; the TUI needs real terminal capabilities such as
CPR cursor-position responses). **Always drive it through tmux.**

1. **Start a detached session**
   ```bash
   tmux kill-session -t aye_task 2>/dev/null
   tmux new-session -d -s aye_task -c /path/to/repo 'aye chat -r /path/to/repo'
   ```

2. **Answer the indexing confirmation.** On 200+ file repos aye asks
   `Do you want to continue with indexing? [y/n] (n):` once. Poll the pane until it appears, then send `y`:
   ```bash
   for i in $(seq 1 120); do
     if tmux capture-pane -t aye_task -p 2>/dev/null | grep -q "continue with indexing"; then
       tmux send-keys -t aye_task 'y' Enter
       break
     fi
     sleep 1
   done
   sleep 20   # let the REPL boot before typing anything else
   ```

3. **Feed the task as ONE line.** Multiline pastes are unreliable (per-line submission, lost echoes).
   Flatten the instruction block to a single line (e.g. `awk '{ printf "%s ", $0 }'`) or keep it
   naturally single-line. Two delivery options:
   - **Direct paste (most reliable):** put the full brief INSIDE the prompt text itself
     ```bash
     PROMPT="BEGIN BRIEF. $(awk '{ printf "%s ", $0 }' /tmp/brief.md) END BRIEF. <closing instructions>"
     tmux set-buffer -- "$PROMPT"
     tmux paste-buffer -t aye_task
     sleep 3
     tmux send-keys -t aye_task Enter
     ```
   - **Inline `@file` reference:** aye's syntax is `@<path>` *anywhere inside* the prompt
     (e.g. "Execute the brief attached from @docs/task-brief.md exactly"). Caveats: the file must
     be non-ignored and must NOT live under `.aye/` (that internal directory is skipped), and
     `@` *does not reliably expand for arbitrary untracked files* — if the model replies
     "the @ reference did not resolve", fall back to the direct paste above instead of retrying.
     Do NOT use an `@<file>:`-prefix form — that prefix syntax is not real; the model just echoes it.

4. **Wait for the reply — it is slow.** Expect minutes, not seconds. Give long tasks (writing a
   whole component + checks) 15–35 minutes. Hold the session open; do not send `exit` right after
   the prompt (stdin-EOF kills it before any reply lands).

5. **Read the back the reply:**
   ```bash
   tmux capture-pane -t aye_task -p -S -200 | sed -e 's/\x1b\[[0-9;?]*[a-zA-Z]//g' | tr -s ' \n'
   ```
   Look for `Files updated: ...`, and any refusal/clarification box. The model's replies appear in
   a bordered box with a `(( · )) ··· (streaming)` indicator while generating.

6. **Follow-up turns** repeat step 3 (send the next single-line prompt into the SAME session — do
   not restart; conversation continuity matters).

7. **Close cleanly:** `tmux send-keys -t aye_task 'exit' Enter`, wait a few seconds, then
   `tmux kill-session -t aye_task`. Snapshots survive.

## Writing the task prompt for aye

Make it fully self-contained — assume the model cannot read files or run anything:

- **Narrow the blast radius explicitly:** "You may edit exactly these files and nothing else:
  X and Y." (aye respects this strongly and will report "No files were changed" if it thinks a
  request oversteps — so also pre-authorize any follow-up ask you already know you'll send).
- **Inline the exact data it must not guess:** struct definitions, existing signatures it must
  match exactly (the API *you* will wire against later), file paths to import from, naming of
  tokens/utilities, and code-style rules of the repo.
- **Tell it what NOT to do:** "do NOT wire it into pages/sections — the caller wires it afterwards",
  "do not add dependencies", "do not touch .env / secrets".
- **Closing instruction:** ask for a verifiable ending, e.g. "End your reply with DONE plus a
  one-line summary of the files you wrote." Then Grep the pane output for DONE.
- Aye reads `AGENTS.md` repo instructions itself; you don't need to repeat repo-wide rules it will
  already apply, but DO repeat the task-specific constraints.

## Verifying the results (your job, not aye's)

Aye does not compile/test unless you explicitly turn tools on, so after its reply:

```bash
git status --porcelain          # confirm only intended files changed
tmux capture-pane ...           # read its final summary
<your project's build/check>    # e.g. cargo check --features <relevant features>
```

If something is off, prefer either fixing it yourself directly (for trivial one-line changes where
another multi-minute round trip isn't worth it) or sending ONE precise follow-up turn that inlines
the file content it needs. Watch out: on a shared machine the user may be editing the same repo
concurrently — re-read files fresh before each edit, and leave their unrelated in-flight changes
alone.

## Pitfalls (each of these cost a real session)

- **Piped stdin "works" but silently does nothing.** Echoes are not responses. Don't trust a
  successful exit code; always verify files changed or a DONE marker appeared.
- **`pkill -f <pattern>` can match the very shell running it** (the pattern is in your own command
  line) and SIGTERM your own compound command — make kill steps a separate invocation.
- **Don't poll obsessively**: schedule one long wait (or a background script) between checks.
- **tmux `send-keys -l` for literal text; plain `send-keys` may trigger key-name interpolation.**
  Enter is sent separately (`send-keys ... Enter`), never inside the text.
- **The "Do you want to continue with indexing?" y/n consumes your first input line** if you type
  before it appears — that's why step 2 greps for it first.
- **Exiting mid-generation kills the reply.** If a helper script's fixed timeout could cut aye off,
  kill the helper (keep tmux) and manage timing yourself.
- **Extract yourself from aye's exit feedback loop** ("Would you recommend...?") when you need it
  gone quickly — `tmux kill-session` is enough and preserves snapshots.
