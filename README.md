# CP-Ansible hosts.yml Generator

> Confluent Platform cp-ansible 배포를 위한 `hosts.yml` 설정 파일 생성 마법사

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen)](https://siksik-e0-0.github.io/cp-deployment-wizard/)

---

## 개요

Confluent Platform을 cp-ansible로 배포할 때 필요한 `hosts.yml` 인벤토리 파일을 웹 브라우저에서 단계별로 생성하는 도구입니다.

- 빌드 불필요 — 단일 HTML 파일로 동작
- 15단계 마법사 UI로 모든 설정 항목을 안내
- 실시간 YAML 미리보기, 방화벽 포트 표, 아키텍처 다이어그램 제공

---

## 바로 사용하기

**[https://siksik-e0-0.github.io/cp-deployment-wizard/](https://siksik-e0-0.github.io/cp-deployment-wizard/)**

또는 파일을 직접 다운로드해서 브라우저로 열기:

```bash
git clone https://github.com/siksik-e0-0/cp-deployment-wizard.git
# hosts_generator.html 파일을 브라우저로 열기
```

---

## 지원 컴포넌트

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

## 마법사 단계

| 단계 | 내용 |
|---|---|
| Step 1 | **배포 환경** — Ansible 연결 및 배포 전략 (개발/스테이징/운영 다중 선택) |
| Step 2 | **설치 방식** — Package / Archive 방식, Confluent Platform 버전 |
| Step 3 | **컴포넌트 & 호스트** — 배포 컴포넌트 선택, 호스트명 및 IP 입력 |
| Step 4 | **사용자/그룹/경로** — 컴포넌트별 OS 사용자, 그룹, 데이터 디렉토리 |
| Step 5 | **Listener & 암호화** — Listener 프로토콜, TLS/SSL 인증서 설정 |
| Step 6 | **포트 구성** — 컴포넌트별 포트 할당 및 충돌 감지 |
| Step 7 | **인증** — SASL 메커니즘 (PLAIN / SCRAM / GSSAPI) 및 사용자 설정 |
| Step 8 | **인가** — ACL 또는 RBAC 기반 권한 관리, MDS 설정 |
| Step 9 | **LDAP 연동** — LDAP 디렉토리 연동 설정 |
| Step 10 | **SSO/OIDC** — Control Center SSO 및 OIDC 연동 |
| Step 11 | **Kafka Broker 상세** — 브로커 성능 튜닝, 커스텀 설정 |
| Step 12 | **Schema Registry / Connect** — 추가 컴포넌트 상세 설정 |
| Step 13 | **Control Center** — Control Center 상세 설정 및 외부 연동 |
| Step 14 | **JVM & 모니터링** — JVM 힙, JMX Exporter, Jolokia 설정 |
| Step 15 | **고급 설정** — 라이선스, Secrets Protection, 텔레메트리 |

---

## 주요 기능

### 실시간 YAML 미리보기
마법사를 진행하면서 오른쪽 패널에서 생성되는 `hosts.yml` 내용을 실시간으로 확인할 수 있습니다.

### 방화벽 포트 표
설정된 컴포넌트와 포트를 기반으로 방화벽 설정에 필요한 포트 정보를 자동으로 표로 생성합니다.

### 아키텍처 다이어그램
선택한 컴포넌트 구성에 맞춰 SVG 기반 아키텍처 다이어그램을 자동으로 렌더링합니다.

### YAML 가져오기/내보내기
- 기존 `hosts.yml` 파일을 붙여넣어 불러오기
- 완성된 YAML을 클립보드에 복사하거나 파일로 다운로드

### 다크/라이트 테마
우측 상단 버튼으로 테마를 전환할 수 있으며, 선택한 테마는 브라우저에 저장됩니다.

---

## 출력 형식

생성된 `hosts.yml`은 cp-ansible 표준 인벤토리 형식을 따릅니다.

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
        broker-02:
          ansible_host: 10.0.0.3

    schema_registry:
      hosts:
        schema-registry-01:
          ansible_host: 10.0.0.4
    # ...
```

---

## 로컬 개발

```bash
git clone https://github.com/siksik-e0-0/cp-deployment-wizard.git
cd cp-deployment-wizard

# E2E 테스트 실행
npm install
npx playwright install chromium
npm test
```

### 테스트

```bash
npm test                  # 전체 테스트 실행
npm run test:headed       # 브라우저 화면 표시
npm run test:report       # 테스트 리포트 확인
```

---

## 기술 스택

- **단일 HTML 파일** — 빌드 없이 브라우저에서 직접 실행
- **js-yaml** — YAML 파싱 및 생성
- **html2canvas** — 스크린샷 내보내기
- **Playwright** — E2E 테스트
- **GitHub Pages** — 정적 호스팅

---

## 라이선스

[Apache](LICENSE)
