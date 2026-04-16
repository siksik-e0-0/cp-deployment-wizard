# PROJECT_GUIDE.md — cp-deployment-wizard

> 이 파일은 모든 에이전트가 작업 전에 반드시 먼저 읽어야 하는 **source of truth**입니다.

---

## 1. 프로젝트 개요

고객과 Confluent Platform 구축 및 환경에 대한 **의사결정을 할 때 사용하는 내부 자료 도구**입니다.

- 고객의 요구사항(환경 유형, 보안 수준, 성능 요구 등)을 입력받아 권장 설정을 제시
- 최종 결정 내용을 PDF / PNG / 텍스트 요약으로 출력하여 내부 문서로 활용
- 3-Listener + RBAC/OIDC 아키텍처를 시각적으로 설명하는 기술 참고 자료 포함
- 단일 HTML 파일로 빌드 없이 브라우저에서 직접 실행

**라이브 URL:** https://siksik-e0-0.github.io/cp-deployment-wizard/

---

## 2. 파일 구조 및 작업 범위

### ✅ 이 프로젝트에서 작업하는 파일

| 파일 | 역할 |
|---|---|
| `index.html` | 랜딩페이지 — 도구 진입점 |
| `confluent-deployment-wizard.html` | **메인 위자드** — 고객 요구사항 입력 및 권장 설정 제시 |
| `confluent-architecture.html` | 아키텍처 참고 자료 — 3-Listener / RBAC / OIDC 기술 정의서 |
| `tests/` | Playwright E2E 테스트 |
| `playwright.config.ts` | 테스트 설정 |
| `package.json` | 테스트 의존성 |

### ❌ 이 프로젝트에서 절대 건드리지 않는 파일

| 파일 | 이유 |
|---|---|
| `hosts_generator.html` | 다른 레포지토리 파일 (`cp-ansible-generator`) |

---

## 3. 아키텍처 원칙

- **단일 HTML 파일 유지**: 각 HTML 파일에 CSS / JS / HTML 모두 포함
- **빌드 도구 없음**: 브라우저에서 직접 실행 가능해야 함
- **출력물**: PDF / PNG 스크린샷 / 텍스트 요약 — YAML 생성 없음
- **외부 의존성**: CDN 경유 (html-to-image 등)

---

## 4. 위자드 단계 구성 (6 Steps)

| Step | 타이틀 | 주요 입력 항목 |
|---|---|---|
| 1 | 클러스터 토폴로지 | 환경 유형(개발/스테이징/프로덕션), Controller/Broker 노드 수, Schema Registry, Control Center |
| 2 | 인증 & 인가 | RBAC 활성화, LDAP 연동 설정, OIDC/SSO 설정 (Authentik/Okta/Azure AD) |
| 3 | 보안 설정 | SSL/TLS, mTLS, 3개 Listener 설정 (Internal/External/Token), SASL 메커니즘 |
| 4 | 데이터 & 성능 | 데이터 보존 기간, Replication Factor, Min ISR, 파티션 수, 데이터 경로 |
| 5 | 리소스 & 모니터링 | JVM Heap (컴포넌트별), JMX Exporter, Prometheus |
| 6 | 최종 확인 | 전체 설정 요약 표시, 검증 결과, PNG/PDF/텍스트 출력 |

---

## 5. 출력물 형식

YAML을 생성하지 않습니다. 출력 방식은 다음 세 가지입니다:

| 출력 방식 | 설명 |
|---|---|
| **PNG 이미지** | 설정 페이지 전체 스크린샷 (html-to-image) |
| **텍스트 요약** | 단계별 설정값 텍스트 정리 (클립보드 복사 또는 .txt 저장) |
| **PDF** | 브라우저 인쇄 기능을 통한 PDF 변환 |

---

## 6. 아키텍처 페이지 구성 (confluent-architecture.html)

| 섹션 | 내용 |
|---|---|
| 01 | 3-Listener 아키텍처 다이어그램 (Identity Provider / Broker Cluster / Clients) |
| 02 | OAUTHBEARER 토큰 타입 비교 (MDS Token vs Authentik Token) |
| 03 | 인증 흐름 3가지 (External Client / CP Component / User SSO) |
| 04 | 인증 매트릭스 표 (Connection별 Listener / Auth Mechanism / Token Issuer) |
| 05 | 포트 개요 (컴포넌트별 포트 카드) |
| 06 | Authentik 장애 영향 분석 (4가지 장애 시나리오) |

---

## 7. 에이전트 역할 분담

| 에이전트 | 담당 범위 |
|---|---|
| `orchestrator` | 전체 조율, 요청 분석, 에이전트 위임, Plan Mode 진행 |
| `requirements-architect` | 요청이 영향하는 Step / 화면 / 출력 섹션 파악 |
| `ui-flow-builder` | 마법사 UI, 폼 인터랙션, 네비게이션, 카드/폼 컴포넌트 |
| `state-yaml-engineer` | 폼 상태 설계, 출력 텍스트 요약 생성 |
| `security-rules-specialist` | Step 2-3 인증/보안 로직, Listener 의존성 규칙 |
| `component-config-specialist` | Step 4-5 데이터/성능/모니터링, 컴포넌트별 설정 |
| `validator-qa` | 검증 규칙, 경고/에러 조건, UX 회귀 테스트 |
| `code-reviewer` | 코드 품질, 보안, 성능 검토 |

---

## 8. 작업 워크플로우 (필수)

> **모든 작업은 아래 순서를 반드시 따릅니다.**

```
1. Plan Mode  —  변경 범위, 영향 파일, 구현 방향 제시
2. 사용자 확인  —  계획 검토 및 승인
3. Build  —  승인된 계획대로만 구현
```

- Plan 없이 바로 코드를 작성하지 않습니다
- 사용자 확인 없이 다음 단계로 진행하지 않습니다
- 계획 범위를 벗어난 추가 구현을 하지 않습니다

---

## 9. 개발 규칙

1. 작업 전 반드시 **Plan Mode → 사용자 확인 → Build** 순서 준수
2. 단일 HTML 파일 아키텍처 유지 (파일 분리 금지)
3. YAML 생성 로직 추가 금지
4. 보안 관련 Step(2-3) 변경 시 `security-rules-specialist` 사용
5. 컴포넌트 관련 Step(4-5) 변경 시 `component-config-specialist` 사용
6. 구현 후 반드시 `validator-qa` 로 검증
7. 커밋 메시지에 영향받은 Step 번호 명시

---

## 10. 브랜치 전략

- `main` — GitHub Pages 배포 브랜치
- `feat/*` — 기능 개발 브랜치
- PR은 `feat/*` → `main` 방향

---

## 11. 환경 변수 (세션 재시작 / 컨텍스트 컴팩션 후 필수 확인)

| 변수 | 용도 |
|---|---|
| `GH_TOKEN` | GitHub push 인증 (PAT) |
| `GH_OWNER` | GitHub 저장소 소유자 |
| `GH_BRANCH` | 기본 배포 브랜치 |

### push 실패 시 디버깅 순서

```bash
# 1. 환경변수 확인 (컴팩션 후에도 셸에 살아있음)
env | grep -i "github\|GH_"

# 2. credential 파일 확인
cat ~/.netrc 2>/dev/null
cat ~/.git-credentials 2>/dev/null

# 3. 토큰으로 remote URL 재설정 후 push
git remote set-url origin https://${GH_TOKEN}@github.com/${GH_OWNER}/cp-deployment-wizard.git
git push origin <branch>
```

> ⚠️ 컨텍스트 컴팩션으로 이전 세션 기억이 사라져도 **환경변수는 셸에 유지**된다.
> push 인증 실패 시 사용자에게 묻기 전에 반드시 위 순서로 먼저 확인할 것.
