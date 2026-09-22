---
name: progressive-commit
description: Use when the user asks to commit git changes.
---

# Progressive Commit Workflow

Turn a pile of uncommitted changes into clean, logical commits. Never lose work. Never mix concerns.

## Steps

### 1. Inspect

Run:

```
git status --short && git diff --stat
```

Show the user what changed. List every modified, added, deleted, and renamed file.

### 2. Analyze

Read every diff (use `git diff` for unstaged, `git diff --cached` for staged). Group changes by logical concern. Common groupings:

- Config/infrastructure changes
- Feature additions
- Bug fixes
- Refactoring (no behavior change)
- Documentation
- Tests
- Dependency updates

### 3. Plan commits

Tell the user exactly how many commits you plan to make and what each one covers. Format:

```
Commit 1: <short summary>
  - file-a.ts (config change)
  - file-b.ts (related config change)

Commit 2: <short summary>
  - src/feature/new.ts (new feature)
  - src/feature/index.ts (export)

Commit N: ...
```

**Wait for explicit user approval before proceeding.** Do not continue if the user says no or wants changes and do not ask user for approval through your question tool.

### 4. Back up

Determine the project name from the repo root directory name. Then:

```
PROJECT_NAME=$(basename "$(git rev-parse --show-toplevel)")
BACKUP_DIR="/tmp/opencode/${PROJECT_NAME}-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
```

Copy all changed and new files into the backup directory, preserving directory structure relative to the repo root:

```
# For each file in git status --short:
cp --parents <file> "$BACKUP_DIR/"
```

Save the current state as a patch:

```
git diff > "$BACKUP_DIR/worktree.patch"
git diff --cached > "$BACKUP_DIR/staged.patch"
```

Tell the user the backup path.

### 5. Restore

Reset the working tree and index to clean state:

```
git restore --worktree --staged .
```

Verify the tree is clean:

```
git status --short
```

If anything remains, force restore those files too.

### 6. Commit one by one

For each planned commit:

1. Read the relevant files from the backup (not the current working directory, which is now clean)
2. Apply the minimal changes for this commit using the edit tool
3. Run `git diff` to verify only the intended changes are present
4. Stage and commit:

```
git add <files-for-this-commit>
git commit -m "<commit message>"
```

Repeat until all commits are done.

### 7. Verify

For every file that was in the original diff, diff the current working tree version against the backup:

```
diff "$BACKUP_DIR/<relative-path>" "<repo-root>/<relative-path>"
```

If any file differs, restore it from backup and investigate.

### 8. Report

Show the final commit log:

```
git log --oneline -<number-of-commits>
```

Summarize what was committed and confirm the backup is at the path from step 4.

## Key rules

- **Never touch unrelated history.** Only commit changes from the current working tree. Do not amend, rebase, or rewrite existing commits.
- **Each commit = one logical concern.** If a file touches multiple concerns, split the changes across commits.
- **Always back up before reverting.** Never run `git restore` or `git checkout` on the working tree without a complete backup first.
- **Always verify final state matches original.** The diff in step 7 must show zero differences.
- **Wait for user approval.** The commit plan in step 3 must be explicitly approved before any destructive action (step 5 onward).
