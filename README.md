# Claude Code Agent Pack for CP-Ansible hosts.yml Generator

이 패키지는 다음 파일을 포함합니다.

- `CLAUDE.md`
- `.claude/settings.json`
- `.claude/agents/*.md`
- `PROJECT_GUIDE.md`
- `sample/ansible_Decision_Guide.html`
- `sample/hosts.yml`

## 포함된 에이전트
- `orchestrator`
- `requirements-architect`
- `ui-flow-builder`
- `state-yaml-engineer`
- `security-rules-specialist`
- `component-config-specialist`
- `validator-qa`

## 권장 사용 순서

1. 이 패키지를 프로젝트 루트에 복사합니다.
2. Claude Code에서 프로젝트를 엽니다.
3. 먼저 `PROJECT_GUIDE.md`와 `CLAUDE.md`를 기준으로 작업을 시작합니다.
4. 기본 에이전트는 `.claude/settings.json`에 따라 `orchestrator`로 설정됩니다.

## 예시 프롬프트

### Phase 1만 구현
Use the orchestrator agent.
Read PROJECT_GUIDE.md first.
Implement only Phase 1:
- Step 1 basic environment
- Step 2 installation method
- Step 3 component selection and dynamic host input
Keep the app single-file HTML.
At the end, ask validator-qa to review required fields and YAML shape.

### 보안 단계 구현
Use orchestrator.
Read PROJECT_GUIDE.md first.
Implement Step 5 to Step 9 only.
Delegate dependency logic to security-rules-specialist.
Delegate YAML mapping changes to state-yaml-engineer.
Run validator-qa at the end.

### C3 / Schema Registry 구현
Use orchestrator.
Read PROJECT_GUIDE.md first.
Implement Step 11 and Step 12 only.
Delegate component details to component-config-specialist.
Delegate UI changes to ui-flow-builder.
Delegate YAML output to state-yaml-engineer.
Run validator-qa at the end.

## 참고
- 이 패키지는 실무용 시작점입니다.
- 필요하면 에이전트 프롬프트를 더 보수적으로 줄이거나, `tools` 범위를 조정해도 됩니다.
