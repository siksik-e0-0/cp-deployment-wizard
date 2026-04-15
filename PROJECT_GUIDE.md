# PROJECT_GUIDE.md — cp-deployment-wizard

> 이 파일은 모든 에이전트가 작업 전에 반드시 먼저 읽어야 하는 **source of truth**입니다.

---

## 1. 프로젝트 개요

Confluent Platform을 **cp-ansible**로 배포할 때 필요한 `hosts.yml` 인벤토리 파일을 생성하는 **웹 기반 마법사 도구**입니다.

- 단일 HTML 파일로 빌드 없이 브라우저에서 직접 실행
- 15단계 마법사 UI를 통해 복잡한 cp-ansible 설정을 GUI로 단순화
- 실시간 YAML 미리보기, 방화벽 포트 표, 아키텍처 다이어그램 자동 생성

**라이브 URL:** https://siksik-e0-0.github.io/cp-deployment-wizard/

---

## 2. 파일 구조 및 작업 범위

### ✅ 이 프로젝트에서 작업하는 파일

| 파일 | 역할 |
|---|---|
| `confluent-deployment-wizard.html` | **메인 마법사** — 핵심 작업 파일 |
| `confluent-architecture.html` | 3-Listener 아키텍처 참고 다이어그램 |
| `index.html` | 랜딩페이지 진입점 |
| `tests/` | Playwright E2E 테스트 |
| `playwright.config.ts` | 테스트 설정 |
| `package.json` | 테스트 의존성 |

### ❌ 이 프로젝트에서 건드리지 않는 파일

| 파일 | 이유 |
|---|---|
| `hosts_generator.html` | **다른 레포지토리 파일** (`cp-ansible-generator`) |

---

## 3. 아키텍처 원칙

- **단일 HTML 파일 유지**: `confluent-deployment-wizard.html` 에 CSS, JS, HTML 모두 포함
- **빌드 도구 없음**: 브라우저에서 직접 실행 가능해야 함
- **상태 관리**: 인메모리 JS state 객체 + localStorage 자동 저장
- **YAML 생성**: js-yaml 라이브러리 기반, 결정론적 출력
- **외부 의존성**: CDN 경유 (js-yaml, html-to-image)

---

## 4. 지원 컴포넌트

| 컴포넌트 | cp-ansible 그룹명 |
|---|---|
| Kafka Controller (KRaft) | `kafka_controller` |
| Kafka Broker | `kafka_broker` |
| Schema Registry | `schema_registry` |
| Kafka Connect | `kafka_connect` |
| ksqlDB | `ksql` |
| Kafka REST Proxy | `kafka_rest` |
| Control Center Next Gen | `control_center_next_gen` |
| Prometheus / Alertmanager | C3 선택 시 자동 포함 |

---

## 5. 마법사 단계 구성 (15 Steps)

| Step | 타이틀 | 담당 에이전트 |
|---|---|---|
| 1 | 배포 환경 — SSH 연결, 개발/스테이징/운영 다중 선택 | `ui-flow-builder`, `state-yaml-engineer` |
| 2 | 설치 방식 — Package/Archive, CP 버전 | `ui-flow-builder`, `state-yaml-engineer` |
| 3 | 컴포넌트 & 호스트 — 컴포넌트 선택, 호스트명/IP | `ui-flow-builder`, `state-yaml-engineer` |
| 4 | 사용자/그룹/경로 — OS 사용자, 그룹, 디렉토리 | `ui-flow-builder`, `state-yaml-engineer` |
| 5 | Listener & 암호화 — 프로토콜, TLS/SSL | `security-rules-specialist` |
| 6 | 포트 구성 — 포트 할당, 충돌 감지 | `security-rules-specialist` |
| 7 | 인증 — SASL (PLAIN/SCRAM/GSSAPI) | `security-rules-specialist` |
| 8 | 인가 — ACL / RBAC, MDS | `security-rules-specialist` |
| 9 | LDAP 연동 | `security-rules-specialist` |
| 10 | SSO/OIDC — Control Center SSO | `component-config-specialist` |
| 11 | Kafka Broker 상세 — 성능 튜닝 | `component-config-specialist` |
| 12 | Schema Registry / Connect 상세 | `component-config-specialist` |
| 13 | Control Center 상세 | `component-config-specialist` |
| 14 | JVM & 모니터링 — JVM 힙, JMX, Jolokia | `component-config-specialist` |
| 15 | 고급 설정 — 라이선스, Secrets Protection, 텔레메트리 | `component-config-specialist` |

---

## 6. 에이전트 역할 분담

| 에이전트 | 담당 |
|---|---|
| `orchestrator` | 전체 조율, 요청 분석, 에이전트 위임 |
| `requirements-architect` | 요청이 영향하는 Step/YAML/UI 섹션 파악 |
| `ui-flow-builder` | 마법사 UI, 폼 인터랙션, 네비게이션 |
| `state-yaml-engineer` | 폼 상태 설계, hosts.yml YAML 출력 |
| `security-rules-specialist` | Step 5-9 보안 로직 |
| `component-config-specialist` | Step 10-15 컴포넌트 설정 |
| `validator-qa` | 의존성, 필드 검증, YAML 일관성, UX 회귀 |
| `code-reviewer` | 코드 품질, 보안, 성능 검토 |

---

## 7. 구현 현황

### ✅ 완성

- 15단계 마법사 UI 골격
- Step 1: 배포 환경 다중선택 (더블토글 버그 수정 완료)
- Step 2: 설치 방식
- Step 3: 컴포넌트 & 호스트 입력
- Step 4: 사용자/그룹/경로
- Step 6: 포트 구성 및 충돌 감지
- 실시간 YAML 미리보기 패널
- 방화벽 포트 표 자동 생성
- 아키텍처 다이어그램 (SVG)
- 다크/라이트 테마
- GitHub Pages 배포

### 🚧 미완성 / 개선 필요

- Step 5: Listener & 암호화 (세부 구현)
- Step 7: SASL 인증 (세부 구현)
- Step 8: ACL/RBAC (세부 구현)
- Step 9: LDAP 연동 (세부 구현)
- Step 10-15: 컴포넌트별 상세 설정 (세부 구현)
- E2E 테스트: Step 1만 커버, Step 2-15 미커버

---

## 8. YAML 출력 형식

```yaml
---
all:
  vars:
    ansible_connection: ssh
    ansible_user: ubuntu
    # ... 글로벌 설정

  children:
    kafka_controller:
      hosts:
        controller-01:
          ansible_host: 10.0.0.1

    kafka_broker:
      hosts:
        broker-01:
          ansible_host: 10.0.0.2
```

---

## 9. 개발 규칙

1. `confluent-deployment-wizard.html` 파일 크기 800줄 초과 시 경고
2. `hosts_generator.html` 은 절대 수정하지 않음
3. 모든 변경은 Step 번호와 함께 커밋 메시지에 명시
4. 새 Step 구현 전 `requirements-architect` 에 분석 위임
5. 보안 관련 Step(5-9) 변경 시 `security-rules-specialist` 사용
6. 컴포넌트 관련 Step(10-15) 변경 시 `component-config-specialist` 사용
7. 구현 후 반드시 `validator-qa` 로 검증

---

## 10. 브랜치 전략

- `main` — GitHub Pages 배포 브랜치
- `feat/*` — 기능 개발 브랜치
- PR은 `feat/*` → `main` 방향
