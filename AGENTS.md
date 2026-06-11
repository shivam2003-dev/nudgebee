# AI assistant guidance — see CLAUDE.md

This file exists so AI coding assistants that look for `AGENTS.md` first (Aider, Cline, OpenCode, Codex CLI configs, and others adopting the cross-tool convention) find a project entrypoint without us maintaining a parallel document.

**Any AI tooling working in this repo should read [`CLAUDE.md`](./CLAUDE.md).** It is the single source of truth for:

- Module structure + the 14-service inventory
- AI Coding Principles (adversarial pre-implementation pass, AI first-pass review, parallel-session patterns)
- Architecture Decisions / "Living Constitution" log
- Build commands per service type
- Database migrations + RPC action naming convention
- The "for human contributors" callout at the top — points at the sections worth a human reader's time

The content is agent-agnostic — every principle and convention applies regardless of which model or harness is driving. If your tool only looks at `AGENTS.md`, configure it to also load `CLAUDE.md`; if you can't, the maintenance burden of mirroring 40+ KB of documentation into a second file is why we don't.

For a per-tool quick reference:

| Tool | Entrypoint it reads |
| --- | --- |
| Claude Code | [`CLAUDE.md`](./CLAUDE.md) |
| Gemini Code Assist | [`GEMINI.md`](./GEMINI.md) → redirects to `CLAUDE.md` |
| Aider / Cline / OpenCode / others | **this file** → read `CLAUDE.md` |
