# CLAUDE.md

## Project overview
This repository builds a single-file HTML application that interactively generates a cp-ansible `hosts.yml` inventory for Confluent Platform 8.x KRaft deployments.

## Source of truth
- Always read `PROJECT_GUIDE.md` first.
- Follow the 14-step wizard structure described in the guide.
- Preserve the implementation roadmap, YAML structure, dependency rules, and UI/UX constraints from the guide.
- Treat the guide as the authority when there is uncertainty about scope or naming.

## Hard constraints
- Keep the app as a **single HTML file** unless the user explicitly requests a split.
- Use **Vanilla JavaScript** only unless the user explicitly approves a framework.
- Keep **CSS Variables** based theming.
- Preserve:
  - dark/light theme
  - responsive layout
  - sticky YAML preview panel
  - copy/download/PNG export UX
- Generate YAML aligned with:
  - `all.vars`
  - group-level `vars`
  - group-level `hosts`
- Only output sections relevant to the selected components and enabled features.

## Working rules
- Before coding, identify the affected Phase and Step numbers from `PROJECT_GUIDE.md`.
- Prefer incremental implementation by Phase:
  1. Core framework
  2. Security
  3. Component details
  4. Operations / advanced
  5. Validation and polish
- Do not over-implement unrelated steps.
- Reuse existing draft UI patterns where possible.
- When dependency logic is added or changed, explain the rule clearly in code comments.

## YAML generation rules
- Keep output deterministic and stable.
- Omit empty or irrelevant blocks.
- Preserve readable ordering.
- Reflect only user-selected components.
- Keep host/group naming consistent with the guide.

## Validation rules
- Check required-field completeness.
- Check feature dependencies.
- Check likely port collisions.
- Check generated YAML shape against the guide examples.
- Keep behavior consistent with a wizard-driven single-file app.

## Agent usage
- `orchestrator` coordinates work and delegates to specialized subagents.
- `requirements-architect` scopes the task and extracts dependencies.
- `ui-flow-builder` owns layout, steps, and interaction flows.
- `state-yaml-engineer` owns state shape and YAML generation.
- `security-rules-specialist` owns Steps 5-9.
- `component-config-specialist` owns Steps 10-14.
- `validator-qa` reviews final correctness and regressions.
