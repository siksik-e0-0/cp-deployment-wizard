# CP-Ansible hosts.yml Generator 프로젝트 지침서

## 1. 프로젝트 개요

**목표**: Confluent Platform cp-ansible 배포 시 필요한 `hosts.yml` (Ansible Inventory) 파일을 웹 UI를 통해 대화형으로 생성하는 단일 HTML 애플리케이션 개발

**타겟 버전**: Confluent Platform 8.x (KRaft 전용, ZooKeeper 제거)

**참조 소스**:
- cp-ansible GitHub: https://github.com/confluentinc/cp-ansible (1,044+ 변수, 35+ 샘플 인벤토리)
- 기존 초안 HTML: `05_CP_Security_Decision_Guide.html` (보안 8단계 의사결정 가이드)
- 실제 운영 hosts.yml: 실제 프로덕션 배포에 사용 중인 인벤토리 파일

---

## 2. 실제 운영 hosts.yml 분석

### 2.1 실제 사용 중인 구성 요소

```
실제 배포 구성:
├── Kafka Controller × 3 (KRaft, node_id: 9991-9993)
├── Kafka Broker × 3 (broker_id: 1-3, 동일 호스트에 Controller와 co-located)
├── Schema Registry × 2
├── Control Center Next Gen × 1 (+ Prometheus + Alertmanager)
└── (Connect, ksqlDB, REST Proxy — 미사용)
```

### 2.2 실제 hosts.yml에서 발견된 핵심 패턴

#### A. 설치 방식: Archive 설치 (비루트, 에어갭)
```yaml
installation_method: archive
confluent_archive_file_source: /home/user/confluent-8.0.2.zip  # 로컬 아카이브
confluent_archive_file_remote: false                            # 원격이 아닌 로컬 파일
archive_destination_path: /app/sol/kafka/confluent              # 설치 경로
archive_owner: 1726_admin1                                      # 비루트 사용자
archive_group: 1726_admin1
```

#### B. 컴포넌트별 사용자/그룹/로그 디렉토리 커스터마이징
```yaml
kafka_broker_user: 1726_admin1
kafka_broker_group: 1726_admin1
kafka_broker_log_dir: /log/sol/kafka/confluent/broker
kafka_controller_user: 1726_admin1
kafka_controller_log_dir: /log/sol/kafka/confluent/controller
control_center_next_gen_user: 1726_admin1
control_center_next_gen_log_dir: /log/sol/kafka/confluent/c3
schema_registry_user: 1726_admin1
schema_registry_log_dir: /log/sol/kafka/confluent/schema-registry
```

#### C. 보안: SASL/PLAIN + RBAC + MDS + LDAP + OIDC/SSO
```yaml
sasl_protocol: plain
rbac_enabled: true
mds_super_user: c3svc
# LDAP → kafka_broker_custom_properties 내에 ldap.* 속성으로 설정
# C3 SSO → OIDC (Authentik) 연동
# Schema Registry → MDS OAUTHBEARER 토큰 인증
```

#### D. JVM/서비스 환경 오버라이드
```yaml
kafka_broker_service_environment_overrides:
  JAVA_HOME: /usr/lib/jvm/java-17-openjdk
  KAFKA_HEAP_OPTS: "-Xms4g -Xmx4g"
  KAFKA_JMX_OPTS: "-javaagent:/.../jmx_prometheus_javaagent.jar=9995:/.../client.yml"
```

#### E. 브로커 성능 튜닝 (custom_properties)
```yaml
kafka_broker_custom_properties:
  num.network.threads: 16
  num.io.threads: 32
  socket.send.buffer.bytes: 2097152
  socket.receive.buffer.bytes: 2097152
  num.replica.fetchers: 8
  replica.fetch.max.bytes: 10485760
  default.replication.factor: 3
  min.insync.replicas: 2
  log.dirs: /data01/sol/kafka/confluent/broker
  confluent.balancer.enable: "true"
```

#### F. Control Center Next Gen 상세 구성
- Prometheus/Alertmanager 의존성 서비스 설정
- HTTPS (Provided Keystore/Truststore) 별도 SSL
- OIDC SSO (Authentik IdP) 연동
- Schema Registry 연동
- MDS/RBAC 연동
- 호스트 레벨 custom_properties

#### G. Schema Registry 상세 구성
- 커스텀 포트 (9081)
- RBAC 인증 (MDS OAUTHBEARER)
- kafkastore 토픽 설정
- 호스트별 listener_hostname 지정

#### H. 컴포넌트 레벨 vars (그룹별 오버라이드)
```yaml
kafka_controller:
  vars:
    secrets_protection_enabled: false    # 그룹 레벨 변수
  hosts: ...

control_center_next_gen:
  vars:
    ssl_provided_keystore_and_truststore: true    # C3 전용 SSL
    ssl_keystore_filepath: "{{ c3_ssl_keystore_path }}"
    ...
```

#### I. 호스트별 개별 변수
```yaml
kafka_broker:
  hosts:
    host1:
      broker_id: 1
      broker_ip: 192.168.20.246    # 호스트별 IP
    host2:
      broker_id: 2
      broker_ip: 192.168.20.247
```

---

## 3. 기존 초안 HTML 분석

### 3.1 초안이 커버하는 영역 (보안 중심 8단계)
| Step | 항목 | 옵션 |
|------|------|------|
| 1 | Listener Security Protocol | PLAINTEXT, SSL, SASL_PLAINTEXT, SASL_SSL |
| 2 | SASL 메커니즘 | PLAIN, SCRAM-SHA-512, SCRAM-SHA-256, GSSAPI, OAUTHBEARER |
| 3 | TLS/SSL 구성 | 미사용, Custom Certs, Self-Signed, mTLS |
| 4 | Authorization | 미사용, ACL, RBAC |
| 5 | MDS | 비활성화, 활성화 |
| 6 | KRaft Controller 보안 | PLAINTEXT, SSL, SASL_SSL |
| 7 | 컴포넌트 인증 | SASL 상속, mTLS |
| 8 | LDAP 연동 | 미사용, Active Directory, OpenLDAP |

### 3.2 초안의 강점 (유지할 것)
- 깔끔한 다크/라이트 테마 UI (CSS Variables 기반)
- 단계별 진행 표시 (step dots) — 완료/활성/대기 상태
- 실시간 YAML 미리보기 (syntax highlighting: comment, key, value, string)
- 의존성 자동 처리 (RBAC→MDS 연동 등)
- 복사/다운로드/PNG 내보내기 기능
- 반응형 디자인 (960px 브레이크포인트)
- Radio Card / Checkbox Card UI 컴포넌트

### 3.3 초안에서 부족한 영역 (추가 필요)
| 누락 영역 | 실제 hosts.yml에서의 중요도 |
|-----------|---------------------------|
| 컴포넌트 선택 (어떤 컴포넌트를 배포할지) | **필수** |
| 호스트 동적 입력 (이름/IP/개수) | **필수** |
| 설치 방식 (archive vs package, 에어갭) | **필수** |
| 사용자/그룹/디렉토리 경로 설정 | **필수** |
| JVM/서비스 환경 오버라이드 | **높음** |
| 브로커 성능 튜닝 (custom_properties) | **높음** |
| C3 Next Gen 상세 (Prometheus, OIDC, SSL) | **높음** |
| Schema Registry 상세 (포트, RBAC 연동) | **중간** |
| JMX Exporter / 모니터링 | **중간** |
| Confluent License 입력 | **중간** |
| Secrets Protection | **낮음** |
| Connect / ksqlDB / REST Proxy / Replicator | **선택** |
| Confluent Cloud 하이브리드 | **선택** |
| Telemetry (Health+) | **선택** |
| Audit Logging / Log Redaction | **선택** |

---

## 4. 확장 설계 — 전체 hosts.yml 생성기 (14단계)

### 4.1 단계(Step) 구성

#### Phase 1: 기본 인프라 (Step 1-3)
| Step | 섹션 | 설명 |
|------|------|------|
| **1** | **기본 환경** | Ansible 연결, 배포 전략, Python 경로 |
| **2** | **설치 방식** | Package/Archive, 버전, 경로, 에어갭 설정 |
| **3** | **컴포넌트 선택 & 호스트** | 배포 컴포넌트 선택 + 호스트 이름/IP 동적 입력 |

#### Phase 2: 사용자/경로 (Step 4)
| Step | 섹션 | 설명 |
|------|------|------|
| **4** | **사용자/그룹/경로** | 컴포넌트별 OS 사용자, 그룹, 로그/데이터 디렉토리 |

#### Phase 3: 보안 설정 (Step 5-9)
| Step | 섹션 | 설명 |
|------|------|------|
| **5** | **Listener & 암호화** | Listener Protocol + TLS/SSL 인증서 방식 |
| **6** | **인증 (Authentication)** | SASL 메커니즘, SCRAM 사용자, Kerberos, OAuth |
| **7** | **인가 (Authorization)** | ACL / RBAC + MDS 설정 |
| **8** | **LDAP 연동** | LDAP URL, Bind DN, 검색 Base, 속성 매핑 |
| **9** | **SSO / OIDC** | C3 SSO, OIDC IdP 설정 (Authentik, Keycloak 등) |

#### Phase 4: 컴포넌트 상세 (Step 10-12)
| Step | 섹션 | 설명 |
|------|------|------|
| **10** | **Kafka Broker 상세** | 성능 튜닝, Replication, Self-Balancing, data dirs |
| **11** | **Schema Registry / Connect / ksqlDB** | 포트, 인증 연동, 플러그인, 커넥터 |
| **12** | **Control Center Next Gen** | Prometheus/Alertmanager, HTTPS, OIDC, Schema Registry 연동 |

#### Phase 5: 운영/고급 (Step 13-14)
| Step | 섹션 | 설명 |
|------|------|------|
| **13** | **JVM & 모니터링** | JVM 힙, JMX Exporter, Jolokia, service_environment_overrides |
| **14** | **고급 설정** | License, Secrets Protection, Audit Log, Telemetry, Confluent Cloud |

---

### 4.2 각 Step 상세 설계

---

#### Step 1: 기본 환경 설정

**위치**: `all.vars`

```
입력 항목:
├── Ansible 연결
│   ├── ansible_connection: [ssh] / local                    (드롭다운, 기본: ssh)
│   ├── ansible_user: _______________                        (텍스트, 기본: ec2-user)
│   ├── ansible_port: ___                                    (숫자, 기본: 22)
│   ├── ansible_become: [true] / false                       (토글, 기본: true)
│   ├── ansible_python_interpreter: _______________          (텍스트, 선택, 예: /usr/bin/python3.11)
│   └── ansible_ssh_private_key_file: _______________        (텍스트, 선택)
│
├── 배포 전략
│   ├── deployment_strategy: [rolling] / parallel            (라디오, 기본: rolling)
│   └── ansible_strategy: [linear] / parallel                (드롭다운, 선택)
│
└── Java 설정
    ├── install_java: true / [false]                         (토글)
    ├── (true 시) Java 패키지 자동 설치
    └── (false 시) custom_java_path: _______________         (텍스트, 예: /usr/lib/jvm/java-17-openjdk)
```

**실제 hosts.yml 예시 참조**:
```yaml
ansible_connection: ssh
ansible_user: 1726_admin1
ansible_python_interpreter: /usr/bin/python3.11
ansible_become: true
ansible_port: 22
ansible_strategy: parallel
deployment_strategy: parallel
install_java: false
custom_java_path: /usr/lib/jvm/java-17-openjdk
```

---

#### Step 2: 설치 방식

**위치**: `all.vars`

```
입력 항목:
├── 설치 방식 (라디오)
│   ├── ◉ Package (YUM/APT 패키지 관리자)
│   │   ├── confluent_package_version: ___________           (텍스트, 기본: "8.2.0")
│   │   ├── repository_configuration: [confluent] / custom   (라디오)
│   │   └── (custom 시)
│   │       ├── custom_yum_repofile_filepath: ___________    (텍스트, RHEL/CentOS)
│   │       └── custom_apt_repo_filepath: ___________        (텍스트, Ubuntu/Debian)
│   │
│   └── ◉ Archive (ZIP/TAR, 에어갭 환경)
│       ├── confluent_package_version: ___________           (텍스트, 기본: "8.2.0")
│       ├── confluent_archive_file_source: ___________       (텍스트, 아카이브 파일 경로)
│       ├── confluent_archive_file_remote: true / [false]    (토글, 로컬 파일이면 false)
│       ├── archive_destination_path: ___________            (텍스트, 기본: /opt/confluent)
│       ├── archive_owner: ___________                       (텍스트, 설치 디렉토리 소유자)
│       └── archive_group: ___________                       (텍스트, 설치 디렉토리 그룹)
│
├── Confluent Server
│   └── confluent_server_enabled: [true] / false             (토글, true=confluent-server, false=community)
│
├── Control Center Next Gen (선택된 경우)
│   ├── confluent_control_center_next_gen_package_version: ___  (텍스트, 예: "2.3.0")
│   ├── confluent_archive_control_center_next_gen_file_source: ___ (Archive 시)
│   └── confluent_archive_control_center_next_gen_file_remote: true/false
│
└── Confluent CLI
    ├── confluent_cli_download_enabled: true / [false]       (토글)
    └── confluent_cli_archive_file_remote: true / [false]    (토글)
```

**실제 hosts.yml 예시 참조**:
```yaml
installation_method: archive
confluent_package_version: "8.0.2"
confluent_archive_file_source: /home/1726_admin1/confluent_install/3.confluent/confluent-8.0.2.zip
confluent_archive_file_remote: false
archive_destination_path: /app/sol/kafka/confluent
archive_owner: 1726_admin1
archive_group: 1726_admin1
confluent_control_center_next_gen_package_version: "2.3.0"
confluent_archive_control_center_next_gen_file_source: /home/.../confluent-control-center-next-gen-2.3.0.tar.gz
confluent_cli_download_enabled: false
```

---

#### Step 3: 컴포넌트 선택 & 호스트 정의

**구조**: 2단계 — 먼저 컴포넌트 선택 → 선택된 컴포넌트에 대해 호스트 입력

##### 3-A. 컴포넌트 선택 (체크박스 카드)
```
☑ Kafka Controller (KRaft)         — 필수, 비활성화 불가
☑ Kafka Broker                     — 필수, 비활성화 불가
☐ Schema Registry                  — 선택
☐ Kafka Connect                    — 선택
│   └── 클러스터 수: [1] / 2 / 3   (다중 클러스터 지원)
☐ ksqlDB                           — 선택
│   └── 클러스터 수: [1] / 2 / 3
☐ Kafka REST Proxy                 — 선택
☐ Control Center Next Gen          — 선택
☐ Kafka Connect Replicator         — 선택
```

**참고**: 실제 hosts.yml에서는 Controller 3대, Broker 3대 (동일 호스트), SR 2대, C3 1대 구성

##### 3-B. 호스트 정의 (동적 폼)

각 컴포넌트별 호스트 입력 영역:

```
┌── Kafka Controller (최소 1, 권장 3, 홀수)
│   [+ 호스트 추가]
│   ┌─────────────────────────────────────────────────────┐
│   │ Hostname: [kiju-cp-test-1.fgcp-integration.com    ] │
│   │ IP (ansible_host): [192.168.20.246               ] │
│   │ node_id: [9991] (자동 생성)                        │
│   │ node_ip: [192.168.20.246] (선택, 기본=ansible_host)│
│   └─────────────────────────────────────────────────────┘
│   ┌─────────────────────────────────────────────────────┐
│   │ Hostname: [kiju-cp-test-2.fgcp-integration.com    ] │
│   │ ...                                                 │
│   └─────────────────────────────────────────────────────┘
│
├── Kafka Broker
│   [+ 호스트 추가]
│   [☑ Controller와 동일 호스트 사용 (co-located)] ← 체크 시 자동 복사
│   ┌─────────────────────────────────────────────────────┐
│   │ Hostname: [kiju-cp-test-1.fgcp-integration.com    ] │
│   │ IP (ansible_host): [192.168.20.246               ] │
│   │ broker_id: [1] (자동 생성)                         │
│   │ broker_ip: [192.168.20.246] (선택)                 │
│   └─────────────────────────────────────────────────────┘
│
├── Schema Registry (선택된 경우)
│   ┌─────────────────────────────────────────────────────┐
│   │ Hostname + ansible_host                             │
│   │ schema_registry_host_name: (선택, 기본=hostname)    │
│   │ schema_registry_listener_hostname: (선택)           │
│   └─────────────────────────────────────────────────────┘
│
└── Control Center Next Gen (선택된 경우)
    ┌─────────────────────────────────────────────────────┐
    │ Hostname + ansible_host                             │
    │ (단일 호스트 권장)                                   │
    └─────────────────────────────────────────────────────┘
```

---

#### Step 4: 사용자/그룹/경로

**위치**: `all.vars`

```
입력 항목:
├── 글로벌 기본값 (일괄 적용 모드)
│   ├── [☑ 모든 컴포넌트에 동일 사용자/그룹 사용]
│   │   ├── 공통 사용자: ___________     (텍스트, 예: 1726_admin1)
│   │   └── 공통 그룹: ___________       (텍스트, 예: 1726_admin1)
│   └── [☐ 컴포넌트별 개별 설정]
│
├── 컴포넌트별 사용자/그룹 (개별 설정 모드)
│   ├── kafka_controller_user / kafka_controller_group
│   ├── kafka_broker_user / kafka_broker_group
│   ├── schema_registry_user / schema_registry_group
│   ├── control_center_next_gen_user / control_center_next_gen_group
│   ├── kafka_connect_user / kafka_connect_group
│   └── ksql_user / ksql_group
│
├── 로그 디렉토리
│   ├── kafka_controller_log_dir: ___________    (예: /log/sol/kafka/confluent/controller)
│   ├── kafka_broker_log_dir: ___________        (예: /log/sol/kafka/confluent/broker)
│   ├── control_center_next_gen_log_dir: ___     (예: /log/sol/kafka/confluent/c3)
│   └── schema_registry_log_dir: ___             (예: /log/sol/kafka/confluent/schema-registry)
│
└── 데이터 디렉토리
    ├── Broker log.dirs: ___________             (예: /data01/sol/kafka/confluent/broker)
    ├── Controller log.dirs: ___________         (예: /data01/sol/kafka/confluent/controller)
    └── C3 data_dir: ___________                 (예: /data01/sol/kafka/confluent/c3)
```

**실제 hosts.yml 예시 참조**:
```yaml
kafka_broker_user: 1726_admin1
kafka_broker_group: 1726_admin1
kafka_broker_log_dir: /log/sol/kafka/confluent/broker
# data dir는 custom_properties 내 log.dirs로 설정
```

---

#### Step 5: Listener & 암호화

**위치**: `all.vars`

```
├── Listener Security Protocol (라디오 카드)
│   ├── PLAINTEXT — 인증/암호화 없음 (개발/테스트)
│   ├── SSL — TLS 암호화만 (mTLS 가능)
│   ├── SASL_PLAINTEXT — SASL 인증, 암호화 없음 (내부망)
│   └── SASL_SSL — SASL + TLS (프로덕션 권장)
│
├── TLS/SSL 설정 (SSL 포함 프로토콜 선택 시)
│   ├── 인증서 방식 (라디오)
│   │   ├── Self-Signed (cp-ansible 자동 생성)
│   │   ├── Custom Certificates (기업 CA 인증서)
│   │   │   ├── ssl_ca_cert_filepath: ___
│   │   │   ├── ssl_signed_cert_filepath: ___
│   │   │   ├── ssl_key_filepath: ___
│   │   │   └── ssl_key_password: ___
│   │   └── Provided Keystore/Truststore (JKS/PKCS12)
│   │       ├── ssl_provided_keystore_and_truststore: true
│   │       ├── ssl_provided_keystore_and_truststore_remote_src: true/false
│   │       ├── ssl_keystore_filepath: ___
│   │       ├── ssl_keystore_store_password: ___
│   │       ├── ssl_keystore_key_password: ___
│   │       ├── ssl_truststore_filepath: ___
│   │       └── ssl_truststore_password: ___
│   │
│   ├── mTLS (양방향 인증)
│   │   └── ssl_mutual_auth_enabled: true/false
│   │
│   └── FIPS 모드
│       ├── fips_enabled: true/false
│       └── fips_mode: fips-140-2 / fips-140-3
│
├── KRaft Controller 보안 (라디오)
│   ├── PLAINTEXT
│   ├── SSL
│   └── SASL_SSL
│   ├── kafka_controller_ssl_enabled: true/false
│   └── kafka_controller_sasl_protocol: plain/scram/none
│
└── 컴포넌트별 SSL 개별 설정 (C3 등)
    ├── [☐ Control Center에 별도 SSL 설정 사용]
    │   └── ssl_provided_keystore_and_truststore: true (C3 vars 레벨)
    │       ├── ssl_keystore_filepath, password
    │       └── ssl_truststore_filepath, password
    └── control_center_next_gen_ssl_enabled: true/false
```

**실제 hosts.yml에서의 패턴**:
- 글로벌: `sasl_protocol: plain` (SASL_PLAINTEXT)
- C3: 별도 Provided Keystore/Truststore로 HTTPS 활성화
- Controller/Broker: `kafka_controller_sasl_protocol: plain`, `kafka_broker_sasl_protocol: plain`

---

#### Step 6: 인증 (Authentication)

**위치**: `all.vars`

```
├── SASL 메커니즘 (SASL 프로토콜 선택 시, 라디오 카드)
│   ├── PLAIN → sasl_protocol: plain
│   ├── SCRAM-SHA-512 → sasl_protocol: scram
│   ├── SCRAM-SHA-256 → sasl_protocol: scram256
│   ├── GSSAPI (Kerberos) → sasl_protocol: kerberos
│   └── OAUTHBEARER → sasl_protocol: oauth (CP 전체)
│
├── 컴포넌트별 SASL 프로토콜 오버라이드
│   ├── kafka_controller_sasl_protocol: ___    (기본: 글로벌 상속)
│   └── kafka_broker_sasl_protocol: ___        (기본: 글로벌 상속)
│
├── (PLAIN 선택 시) PLAIN 사용자 정의
│   └── sasl_plain_users: (key-value 동적 입력)
│       예: admin: admin-secret, client1: password1
│
├── (SCRAM 선택 시) SCRAM 사용자 정의
│   └── sasl_scram_users: (key-value 동적 입력)
│
├── (Kerberos 선택 시) Kerberos 설정
│   ├── kerberos.realm: ___
│   ├── kerberos.kdc_hostname: ___
│   ├── kerberos.admin_hostname: ___
│   └── 컴포넌트별 keytab 경로
│
└── (OAuth 선택 시) OAuth/OIDC 설정
    ├── oauth_token_uri: ___
    ├── oauth_issuer_url: ___
    ├── oauth_jwks_uri: ___
    ├── oauth_sub_claim: ___
    ├── oauth_groups_claim: ___
    └── 컴포넌트별 oauth_user / oauth_password
```

---

#### Step 7: 인가 (Authorization)

**위치**: `all.vars`

```
├── Authorization 방식 (라디오 카드)
│   ├── 없음 — 모든 인증된 사용자 전체 접근
│   ├── ACL — Kafka 기본 ACL (kafka-acls CLI)
│   └── RBAC — Confluent RBAC (MDS 필수)
│
├── (RBAC 선택 시)
│   ├── rbac_enabled: true
│   ├── MDS Super User
│   │   ├── mds_super_user: ___              (예: c3svc)
│   │   └── mds_super_user_password: ___     (예: changeit)
│   │
│   ├── RBAC Super Users 추가
│   │   └── rbac_super_users: (동적 리스트)
│   │       예: ["User:admin", "User:c3svc"]
│   │
│   ├── Token Key Pair
│   │   ├── create_mds_certs: true (자동 생성) / false (수동)
│   │   ├── token_services_public_pem_file: ___
│   │   └── token_services_private_pem_file: ___
│   │
│   ├── 컴포넌트별 LDAP/MDS 사용자 (동적, 선택된 컴포넌트만)
│   │   ├── kafka_broker_ldap_user / password
│   │   ├── schema_registry_ldap_user / password
│   │   ├── control_center_next_gen_ldap_user / password
│   │   ├── kafka_connect_ldap_user / password
│   │   └── ksql_ldap_user / password
│   │
│   └── 추가 시스템 관리자
│       └── control_center_next_gen_additional_system_admins:
│           예: ["Group:c3-admins"]
│
└── (ACL 선택 시)
    └── rbac_enabled: false
```

**실제 hosts.yml 예시**:
```yaml
rbac_enabled: true
rbac_super_users:
  - "User:admin"
  - "User:c3svc"
mds_super_user: c3svc
mds_super_user_password: changeit
kafka_broker_ldap_user: "cn=akadmin,ou=users,dc=ldap,dc=goauthentik,dc=io"
kafka_broker_ldap_password: changeit
schema_registry_ldap_user: rgbrgb1
schema_registry_ldap_password: changeit
control_center_next_gen_ldap_user: akadmin
control_center_next_gen_ldap_password: changeit
```

---

#### Step 8: LDAP 연동

**위치**: `all.vars` (일부) + `kafka_broker_custom_properties` 내 `ldap.*`

```
├── LDAP 사용 여부 (토글)
│
├── LDAP 기본 접속 정보 (all.vars 레벨)
│   ├── ldap_url: ___                     (예: ldap://server:389)
│   ├── ldap_base_dn: ___                 (예: dc=ldap,dc=goauthentik,dc=io)
│   ├── ldap_user_search_base: ___        (예: ou=users,dc=...)
│   ├── ldap_group_search_base: ___       (예: ou=groups,dc=...)
│   ├── ldap_user_name_attribute: ___     (예: cn / sAMAccountName / uid)
│   ├── ldap_user_object_class: ___       (예: inetOrgPerson / user)
│   ├── ldap_group_object_class: ___      (예: groupOfUniqueNames / group / groupOfNames)
│   ├── ldap_group_member_attribute: ___  (예: uniqueMember / member)
│   └── ldap_group_name_attribute: ___    (예: cn)
│
├── 프리셋 (라디오, 자동 채움)
│   ├── Active Directory 프리셋
│   │   → sAMAccountName, user, group, member
│   ├── OpenLDAP 프리셋
│   │   → uid, inetOrgPerson, groupOfNames, member
│   ├── Authentik (LDAP Outpost) 프리셋
│   │   → cn, inetOrgPerson, groupOfUniqueNames, uniqueMember
│   └── 커스텀 (직접 입력)
│
├── kafka_broker_custom_properties 내 LDAP 상세
│   ├── ldap.java.naming.factory.initial: com.sun.jndi.ldap.LdapCtxFactory
│   ├── ldap.com.sun.jndi.ldap.read.timeout: ___         (예: 3000)
│   ├── ldap.java.naming.provider.url: ___
│   ├── ldap.java.naming.security.principal: ___          (Bind DN)
│   ├── ldap.java.naming.security.credentials: ___        (Bind Password)
│   ├── ldap.java.naming.security.authentication: simple
│   ├── ldap.user.search.base: ___
│   ├── ldap.group.search.base: ___
│   ├── ldap.user.name.attribute: ___
│   ├── ldap.user.object.class: ___
│   ├── ldap.user.memberof.attribute.pattern: ___         (정규식)
│   ├── ldap.group.name.attribute: ___
│   └── ldap.group.member.attribute.pattern: ___          (정규식)
│
└── LDAP over TLS (ldaps://)
    └── ssl_truststore 경로 (LDAP 서버 CA 인증서)
```

**실제 hosts.yml에서의 패턴**:
- `all.vars`에 `ldap_url`, `ldap_base_dn` 등 기본값 설정
- `kafka_broker_custom_properties` 내에 `ldap.java.naming.*`, `ldap.user.*`, `ldap.group.*` 상세 설정
- Authentik LDAP Outpost 사용 (inetOrgPerson, groupOfUniqueNames, uniqueMember)

---

#### Step 9: SSO / OIDC

**위치**: C3 `control_center_next_gen_custom_properties`

```
├── SSO 모드 (라디오)
│   ├── 미사용
│   ├── OIDC (OAuth 2.0 / OpenID Connect)
│   └── BASIC (파일 기반 로그인)
│
├── (OIDC 선택 시) IdP 프리셋
│   ├── Authentik 프리셋
│   ├── Keycloak 프리셋
│   ├── Azure AD 프리셋
│   ├── Okta 프리셋
│   └── 커스텀 (직접 입력)
│
├── OIDC 설정 (C3 custom_properties)
│   ├── confluent.controlcenter.auth.sso.mode: OIDC
│   ├── confluent.controlcenter.rest.authentication.method: BEARER
│   ├── confluent.oidc.idp.client.id: ___
│   ├── confluent.oidc.idp.client.secret: ___
│   ├── confluent.oidc.idp.issuer: ___
│   ├── confluent.oidc.idp.jwks.endpoint.uri: ___
│   ├── confluent.oidc.idp.authorize.base.endpoint.uri: ___
│   ├── confluent.oidc.idp.token.base.endpoint.uri: ___
│   ├── confluent.oidc.idp.sub.claim.name: ___              (예: preferred_username)
│   ├── confluent.oidc.idp.groups.claim.name: ___            (예: groups)
│   ├── confluent.oidc.idp.groups.claim.scope: ___           (예: "openid profile email")
│   ├── confluent.oidc.idp.refresh.token.enabled: true/false
│   ├── confluent.oidc.session.token.expiry.ms: ___          (예: 86400000)
│   └── confluent.oidc.session.max.timeout.ms: ___           (예: 86400000)
│
└── C3 세션 설정
    └── confluent.controlcenter.auth.session.expiration.ms: ___ (예: 86400000)
```

**실제 hosts.yml 예시**: Authentik IdP 연동, OIDC SSO, BEARER 인증

---

#### Step 10: Kafka Broker 상세 설정

**위치**: `kafka_broker_custom_properties` (all.vars) + `kafka_controller_custom_properties`

```
├── 기본 설정 프리셋 (라디오)
│   ├── 개발/테스트 (낮은 리소스)
│   ├── 소규모 프로덕션 (기본값)
│   └── 대규모 프로덕션 (고성능 튜닝)
│
├── 스레드 & 네트워크
│   ├── num.network.threads: ___           (기본 3, 프로덕션 16)
│   ├── num.io.threads: ___                (기본 8, 프로덕션 32)
│   ├── socket.send.buffer.bytes: ___      (기본 102400, 프로덕션 2097152)
│   ├── socket.receive.buffer.bytes: ___   (기본 102400, 프로덕션 2097152)
│   └── socket.request.max.bytes: ___      (기본 104857600)
│
├── 복제(Replication)
│   ├── default.replication.factor: ___    (기본 3)
│   ├── min.insync.replicas: ___           (기본 2)
│   ├── num.replica.fetchers: ___          (기본 1, 프로덕션 8)
│   ├── replica.fetch.max.bytes: ___       (기본 1048576, 프로덕션 10485760)
│   ├── replica.fetch.response.max.bytes: ___ (기본 10485760, 프로덕션 52428800)
│   ├── unclean.leader.election.enable: false
│   └── num.recovery.threads.per.data.dir: ___ (기본 1, 프로덕션 16)
│
├── 내부 토픽 Replication Factor
│   ├── offsets.topic.replication.factor: ___
│   ├── transaction.state.log.replication.factor: ___
│   ├── transaction.state.log.min.isr: ___
│   ├── confluent.license.topic.replication.factor: ___
│   ├── confluent.metadata.topic.replication.factor: ___
│   ├── confluent.balancer.topic.replication.factor: ___
│   ├── confluent.durability.topic.replication.factor: ___
│   └── confluent.tier.metadata.replication.factor: ___
│
├── 로그(데이터) 설정
│   ├── log.dirs: ___                      (예: /data01/sol/kafka/confluent/broker)
│   ├── log.retention.hours: ___           (기본 168, 실제 24)
│   ├── log.segment.bytes: ___             (기본 1073741824)
│   ├── log.retention.check.interval.ms: ___ (기본 300000)
│   └── num.partitions: ___                (기본 1)
│
├── Self-Balancing Cluster
│   ├── confluent.balancer.enable: true/false
│   ├── confluent.balancer.heal.uneven.load.trigger: ___  (예: EMPTY_BROKER)
│   └── confluent.balancer.heal.broker.failure.threshold.ms: ___ (예: 60000)
│
├── 토픽 관리
│   ├── auto.create.topics.enable: true/false
│   └── delete.topic.enable: true/false
│
├── Telemetry Reporter (C3 Next Gen용)
│   ├── metric.reporters: io.confluent.telemetry.reporter.TelemetryReporter
│   ├── confluent.telemetry.metrics.collector.interval.ms: ___
│   ├── confluent.telemetry.remoteconfig._confluent.enabled: true/false
│   └── confluent.consumer.lag.emitter.enabled: true/false
│
├── Metrics Reporter
│   └── confluent.metrics.reporter.publish.ms: ___  (예: 30000)
│
├── Secret Config Provider
│   ├── config.providers: securepass
│   └── config.providers.securepass.class: ...SecurePassConfigProvider
│
└── 커스텀 프로퍼티 (key-value 에디터)
    └── 위에 없는 추가 속성 자유 입력
```

**Controller도 유사한 custom_properties 설정 제공** (log.dirs, 스레드 등)

---

#### Step 11: Schema Registry / Connect / ksqlDB

##### Schema Registry (선택된 경우)

**위치**: `all.vars` + `schema_registry.vars` + `schema_registry_custom_properties`

```
├── 기본 설정
│   ├── schema_registry_listener_port: ___     (기본 8081, 실제 9081)
│   ├── schema_registry_config_prefix: ___     (예: /etc/schema-registry)
│
├── kafkastore 설정 (schema_registry.vars)
│   ├── kafkastore.topic: ___                  (기본 _schemas)
│   └── kafkastore.topic.replication.factor: ___ (기본 3)
│
├── RBAC 연동 (schema_registry_custom_properties)
│   ├── kafkastore.security.protocol: ___      (예: SASL_PLAINTEXT)
│   ├── kafkastore.sasl.mechanism: ___         (예: OAUTHBEARER)
│   ├── kafkastore.sasl.login.callback.handler.class: ...TokenUserLoginCallbackHandler
│   ├── kafkastore.sasl.jaas.config: (MDS OAUTHBEARER JAAS)
│   ├── schema.registry.resource.extension.class: ...SchemaRegistrySecurityResourceExtension
│   ├── confluent.schema.registry.auth.mechanism: JETTY_AUTH
│   ├── confluent.metadata.bootstrap.server.urls: ___
│   ├── confluent.metadata.http.auth.credentials.provider: BASIC
│   ├── confluent.metadata.basic.auth.user.info: ___
│   └── confluent.schema.registry.authorizer.class: ...RbacAuthorizer
│
└── 커스텀 프로퍼티 (key-value 에디터)
```

##### Kafka Connect (선택된 경우)
```
├── 각 클러스터별:
│   ├── kafka_connect_group_id: ___
│   ├── kafka_connect_plugins_path: ___
│   ├── Confluent Hub 플러그인 (동적 리스트)
│   ├── 커넥터 정의 (동적 리스트)
│   └── monitoring_interceptors_enabled: true/false
└── 커스텀 프로퍼티
```

##### ksqlDB (선택된 경우)
```
├── ksql_service_id: ___
├── ksql_log_streaming_enabled: true/false
└── 커스텀 프로퍼티
```

---

#### Step 12: Control Center Next Gen

**위치**: `all.vars` + `control_center_next_gen.vars` + 호스트 레벨 `control_center_next_gen_custom_properties`

```
├── 기본 설정
│   ├── control_center_next_gen_authentication_type: [ldap] / basic / none
│   ├── control_center_next_gen_data_dir: ___              (예: /data01/sol/kafka/confluent/c3)
│   ├── control_center_next_gen_dependencies_config_path: ___
│   ├── control_center_next_gen_streams_kafka_listener_name: ___ (예: internal)
│   └── control_center_next_gen_monitoring_interceptor_kafka_listener_name: ___
│
├── Prometheus 의존성
│   ├── control_center_next_gen_dependency_prometheus_port: ___ (기본 9090)
│   ├── control_center_next_gen_dependency_prometheus_basic_auth_enabled: true/false
│   └── Prometheus 서비스 오버라이드
│       ├── PROMETHEUS_HOST: ___
│       ├── PROMETHEUS_PORT: ___
│       ├── TSDB_PATH: ___
│       ├── LOG_PATH: ___
│       └── METRICS_RETENTION_DAYS: ___
│
├── Alertmanager 의존성
│   ├── control_center_next_gen_dependency_alertmanager_port: ___ (기본 9098)
│   ├── control_center_next_gen_dependency_alertmanager_basic_auth_enabled: true/false
│   └── Alertmanager 서비스 오버라이드
│       ├── ALERTMANAGER_HOST: ___
│       ├── ALERTMANAGER_PORT: ___
│       ├── STORAGE_PATH: ___
│       ├── LOG_PATH: ___
│       └── WEB_LISTEN_ADDRESS: ___
│
├── C3 Custom Properties (호스트 레벨)
│   ├── confluent.controlcenter.id: ___
│   ├── confluent.controlcenter.prometheus.url: ___
│   ├── confluent.controlcenter.alertmanager.url: ___
│   ├── confluent.controlcenter.internal.topics.replication: ___
│   ├── confluent.controlcenter.command.topic.replication: ___
│   ├── confluent.controlcenter.ui.autoupdate.enable: true/false
│   ├── confluent.controlcenter.usage.data.collection.enable: true/false
│   ├── confluent.controlcenter.ksql.enable: true/false
│   ├── confluent.controlcenter.schema.registry.enable: true/false
│   ├── confluent.controlcenter.schema.registry.url: ___
│   ├── confluent.controlcenter.rest.listeners: ___         (예: https://host:9021)
│   │
│   ├── C3 REST SSL (HTTPS)
│   │   ├── confluent.controlcenter.rest.ssl.keystore.location: ___
│   │   ├── confluent.controlcenter.rest.ssl.keystore.password: ___
│   │   ├── confluent.controlcenter.rest.ssl.key.password: ___
│   │   ├── confluent.controlcenter.rest.ssl.truststore.location: ___
│   │   └── confluent.controlcenter.rest.ssl.truststore.password: ___
│   │
│   ├── MDS 연동
│   │   ├── confluent.metadata.bootstrap.server.urls: ___
│   │   ├── confluent.metadata.basic.auth.user.info: ___
│   │   └── confluent.metadata.http.auth.credentials.provider: BASIC
│   │
│   ├── Streams/Monitoring JAAS (MDS OAUTHBEARER)
│   │   ├── confluent.controlcenter.streams.sasl.jaas.config: ___
│   │   └── confluent.monitoring.interceptor.sasl.jaas.config: ___
│   │
│   ├── Schema Registry 연동
│   │   ├── confluent.controlcenter.schema.registry.basic.auth.credentials.source: USER_INFO
│   │   └── confluent.controlcenter.schema.registry.basic.auth.user.info: ___
│   │
│   └── OIDC/SSO (Step 9에서 설정)
│
├── C3 서비스 계정
│   ├── c3_service_user: ___            (예: c3svc)
│   └── c3_service_password: ___
│
└── 라이선스
    └── confluent.license: ___
```

---

#### Step 13: JVM & 모니터링

**위치**: `all.vars` 내 `*_service_environment_overrides`

```
├── JVM 힙 설정 (컴포넌트별)
│   ├── Kafka Controller
│   │   ├── JAVA_HOME: ___
│   │   ├── KAFKA_HEAP_OPTS: ___              (예: "-Xms4g -Xmx4g")
│   │   └── KAFKA_JMX_OPTS: ___              (JMX Prometheus Agent 등)
│   │
│   ├── Kafka Broker
│   │   ├── JAVA_HOME: ___
│   │   ├── KAFKA_HEAP_OPTS: ___              (예: "-Xms4g -Xmx4g")
│   │   └── KAFKA_JMX_OPTS: ___
│   │
│   ├── Control Center
│   │   ├── JAVA_HOME: ___
│   │   ├── CONTROL_CENTER_HEAP_OPTS: ___     (예: "-Xms2g -Xmx2g")
│   │   └── CONTROL_CENTER_OPTS: ___          (예: truststore JVM 옵션)
│   │
│   └── Schema Registry
│       ├── SCHEMA_REGISTRY_HEAP_OPTS: ___    (예: "-Xms8G -Xmx8G")
│       └── SCHEMA_REGISTRY_OPTS: ___         (예: JMX agent)
│
├── JMX Exporter (Prometheus)
│   ├── jmxexporter_enabled: true/false
│   ├── 컴포넌트별 활성화 오버라이드
│   │   ├── kafka_broker_jmxexporter_enabled: true/false
│   │   ├── kafka_controller_jmxexporter_enabled: true/false
│   │   └── schema_registry_jmxexporter_enabled: true/false
│   ├── jmxexporter_jar_url: ___             (로컬 JAR 경로)
│   ├── jmxexporter_jar_path: ___            (배포 대상 경로)
│   ├── jmxexporter_url_remote: true/false
│   ├── jmxexporter_config_path: ___         (config YAML 경로)
│   └── jmxexporter_config_url: ___          (소스 config 경로)
│   
│   참고: 실제 hosts.yml에서는 jmxexporter_enabled=true 이지만
│   컴포넌트별로 false로 오버라이드하고, 대신 KAFKA_JMX_OPTS로
│   javaagent를 직접 지정하는 패턴 사용
│
├── JMX Exporter vs JMX Agent 직접 지정 (라디오)
│   ├── cp-ansible 내장 JMX Exporter 사용
│   └── KAFKA_JMX_OPTS로 javaagent 직접 지정 (고급)
│       └── javaagent 경로 + 포트 + config YAML 경로 입력
│
└── Jolokia (선택)
    ├── jolokia_enabled: true/false
    └── 컴포넌트별 포트 설정
```

**실제 hosts.yml 패턴**:
```yaml
# JMX Exporter는 cp-ansible 내장 기능 대신 KAFKA_JMX_OPTS로 직접 agent 지정
kafka_broker_service_environment_overrides:
  KAFKA_JMX_OPTS: "-javaagent:/app/.../jmx_prometheus_javaagent-0.20.0.jar=9995:/.../client.yml"

# Schema Registry는 SCHEMA_REGISTRY_OPTS로 agent 지정
schema_registry_service_environment_overrides:
  SCHEMA_REGISTRY_OPTS: "-javaagent:/app/.../jmx_prometheus_javaagent-0.20.0.jar=9997:/.../client.yml"
```

---

#### Step 14: 고급 설정

```
├── Confluent License
│   └── confluent_license: ___               (라이선스 키 문자열)
│
├── Secrets Protection
│   ├── secrets_protection_enabled: true/false (컴포넌트별)
│   ├── secrets_protection_masterkey: ___
│   └── secrets_protection_security_file: ___
│
├── Confluent Reporters Telemetry
│   └── confluent.reporters.telemetry.auto.enabled: true/false
│
├── Telemetry (Confluent Health+)
│   ├── telemetry_enabled: true/false
│   ├── telemetry_api_key / telemetry_api_secret
│   └── telemetry_proxy_url (선택)
│
├── Audit Logging
│   ├── audit_logs_destination_enabled: true/false
│   └── audit_logs_destination_bootstrap_servers: ___
│
├── Log Redaction
│   ├── logredactor_enabled: true/false
│   └── logredactor_rule_url / logredactor_rule_path_local
│
├── Confluent Cloud Hybrid (선택)
│   ├── ccloud_kafka_enabled: true/false
│   │   └── bootstrap_servers, key, secret
│   └── ccloud_schema_registry_enabled: true/false
│       └── url, key, secret
│
└── 글로벌 커스텀 프로퍼티 (key-value 에디터)
    └── all.vars에 추가할 임의 변수
```

---

## 5. YAML 생성 로직

### 5.1 최종 생성 구조 (실제 hosts.yml 패턴 반영)

```yaml
---
all:
  vars:
    # === Step 1: 기본 환경 ===
    ansible_connection: ssh
    ansible_user: 1726_admin1
    ansible_python_interpreter: /usr/bin/python3.11
    ansible_become: true
    ansible_port: 22
    ansible_strategy: parallel
    deployment_strategy: parallel

    # === Step 2: 설치 방식 ===
    confluent_package_version: "8.0.2"
    confluent_control_center_next_gen_package_version: "2.3.0"
    installation_method: archive
    confluent_archive_file_source: /home/.../confluent-8.0.2.zip
    confluent_archive_file_remote: false
    archive_destination_path: /app/sol/kafka/confluent
    archive_owner: 1726_admin1
    archive_group: 1726_admin1
    install_java: false
    custom_java_path: /usr/lib/jvm/java-17-openjdk
    confluent_cli_download_enabled: false

    # === Step 4: 사용자/그룹/경로 ===
    kafka_controller_user: 1726_admin1
    kafka_controller_group: 1726_admin1
    kafka_broker_user: 1726_admin1
    kafka_broker_group: 1726_admin1
    # ... (컴포넌트별)
    kafka_controller_log_dir: /log/sol/kafka/confluent/controller
    kafka_broker_log_dir: /log/sol/kafka/confluent/broker
    # ... (컴포넌트별)

    # === Step 5: Listener & 암호화 ===
    sasl_protocol: plain
    kafka_controller_sasl_protocol: plain
    kafka_broker_sasl_protocol: plain

    # === Step 7: 인가 (RBAC) ===
    rbac_enabled: true
    rbac_super_users:
      - "User:admin"
      - "User:c3svc"
    token_services_public_pem_file: /path/to/public.pem
    token_services_private_pem_file: /path/to/tokenKeypair.pem
    mds_super_user: c3svc
    mds_super_user_password: changeit
    kafka_broker_ldap_user: "cn=akadmin,ou=users,..."
    kafka_broker_ldap_password: changeit
    schema_registry_ldap_user: rgbrgb1
    schema_registry_ldap_password: changeit
    control_center_next_gen_ldap_user: akadmin
    control_center_next_gen_ldap_password: changeit

    # === Step 8: LDAP ===
    ldap_url: "ldap://server:389"
    ldap_base_dn: "dc=ldap,dc=goauthentik,dc=io"
    ldap_user_search_base: "ou=users,dc=..."
    ldap_group_search_base: "ou=groups,dc=..."
    # ...

    # === Step 12: C3 Next Gen 설정 ===
    control_center_next_gen_authentication_type: ldap
    control_center_next_gen_ssl_enabled: true
    control_center_next_gen_data_dir: /data01/sol/kafka/confluent/c3
    c3_service_user: c3svc
    c3_service_password: changeit
    c3_ssl_keystore_path: /path/to/c3-keystore.jks
    c3_ssl_keystore_password: "password"
    # ...

    # === Step 11: Schema Registry ===
    schema_registry_listener_port: 9081
    schema_registry_config_prefix: "/etc/schema-registry"

    # === Step 14: License ===
    confluent_license: "eyJ..."

    # === Step 13: JMX Exporter ===
    jmxexporter_enabled: true
    jmxexporter_url_remote: false
    kafka_broker_jmxexporter_enabled: false
    kafka_controller_jmxexporter_enabled: false
    jmxexporter_jar_url: /path/to/jmx_prometheus_javaagent.jar
    jmxexporter_jar_path: /app/.../jmx_prometheus_javaagent.jar
    jmxexporter_config_path: /app/.../client.yml
    jmxexporter_config_url: /path/to/client.yml

    # === Step 10: Kafka Controller Custom Properties ===
    kafka_controller_custom_properties:
      metric.reporters: io.confluent.telemetry.reporter.TelemetryReporter
      confluent.telemetry.metrics.collector.interval.ms: 60000
      # ... (성능/보안/LDAP 속성)

    # === Step 10: Kafka Broker Custom Properties ===
    kafka_broker_custom_properties:
      # 성능 튜닝
      num.network.threads: 16
      num.io.threads: 32
      # 복제
      default.replication.factor: 3
      min.insync.replicas: 2
      # 로그
      log.dirs: /data01/sol/kafka/confluent/broker
      log.retention.hours: 24
      # Self-Balancing
      confluent.balancer.enable: "true"
      # LDAP (Step 8 연동)
      ldap.java.naming.provider.url: "ldap://..."
      # ...

    # === Step 11: Schema Registry Custom Properties ===
    schema_registry_custom_properties:
      kafkastore.security.protocol: SASL_PLAINTEXT
      kafkastore.sasl.mechanism: OAUTHBEARER
      # ... RBAC 연동

    # === Step 13: JVM 환경 오버라이드 ===
    kafka_controller_service_environment_overrides:
      JAVA_HOME: /usr/lib/jvm/java-17-openjdk
      KAFKA_HEAP_OPTS: "-Xms4g -Xmx4g"
      KAFKA_JMX_OPTS: "-javaagent:/.../jmx_prometheus_javaagent.jar=9999:/.../client.yml"

    kafka_broker_service_environment_overrides:
      JAVA_HOME: /usr/lib/jvm/java-17-openjdk
      KAFKA_HEAP_OPTS: "-Xms4g -Xmx4g"
      KAFKA_JMX_OPTS: "-javaagent:/.../jmx_prometheus_javaagent.jar=9995:/.../client.yml"

    control_center_next_gen_service_environment_overrides:
      JAVA_HOME: /usr/lib/jvm/java-17-openjdk
      CONTROL_CENTER_HEAP_OPTS: "-Xms2g -Xmx2g"
      CONTROL_CENTER_OPTS: "-Djavax.net.ssl.trustStore=..."

    control_center_next_gen_dependency_prometheus_service_environment_overrides:
      User: 1726_admin1
      Group: 1726_admin1
      PROMETHEUS_HOST: host
      PROMETHEUS_PORT: 9090
      TSDB_PATH: /data01/.../prometheus/data
      LOG_PATH: /log/.../prometheus
      METRICS_RETENTION_DAYS: "15d"

    control_center_next_gen_dependency_alertmanager_service_environment_overrides:
      User: 1726_admin1
      Group: 1726_admin1
      ALERTMANAGER_HOST: host
      ALERTMANAGER_PORT: 9098
      STORAGE_PATH: /data01/.../alertmanager/data
      LOG_PATH: /log/.../alertmanager

    schema_registry_service_environment_overrides:
      SCHEMA_REGISTRY_HEAP_OPTS: "-Xms8G -Xmx8G"
      SCHEMA_REGISTRY_OPTS: "-javaagent:/.../jmx_prometheus_javaagent.jar=9997:/.../client.yml"

# === 컴포넌트별 호스트 ===
kafka_controller:
  vars:
    secrets_protection_enabled: false
  hosts:
    host1:
      node_id: 9991
      node_ip: 192.168.20.246
    host2:
      node_id: 9992
      node_ip: 192.168.20.247
    host3:
      node_id: 9993
      node_ip: 192.168.20.248

kafka_broker:
  vars:
    secrets_protection_enabled: false
  hosts:
    host1:
      broker_id: 1
      broker_ip: 192.168.20.246
    host2:
      broker_id: 2
      broker_ip: 192.168.20.247
    host3:
      broker_id: 3
      broker_ip: 192.168.20.248

control_center_next_gen:
  vars:
    ssl_provided_keystore_and_truststore: true
    ssl_provided_keystore_and_truststore_remote_src: true
    ssl_keystore_and_truststore_custom_password: true
    ssl_keystore_filepath: "{{ c3_ssl_keystore_path }}"
    ssl_keystore_store_password: "{{ c3_ssl_keystore_password }}"
    ssl_keystore_key_password: "{{ c3_ssl_key_password }}"
    ssl_truststore_filepath: "{{ c3_ssl_truststore_path }}"
    ssl_truststore_password: "{{ c3_ssl_truststore_password }}"
    rbac_enabled_public_pem_path: /path/to/public.pem
    rbac_enabled_private_pem_path: /path/to/tokenKeypair.pem
  hosts:
    c3-host:
      control_center_next_gen_custom_properties:
        confluent.controlcenter.id: 3
        confluent.controlcenter.prometheus.url: http://host:9090
        confluent.controlcenter.alertmanager.url: http://host:9098
        # ... OIDC, SSL, MDS, Schema Registry 연동

schema_registry:
  vars:
    kafkastore.topic: "_schemas"
    kafkastore.topic.replication.factor: 3
  hosts:
    sr-host1:
      ansible_host: 192.168.20.246
      schema_registry_host_name: sr-host1
      schema_registry_listener_hostname: sr-host1
    sr-host2:
      ansible_host: 192.168.20.247
      schema_registry_host_name: sr-host2
      schema_registry_listener_hostname: sr-host2
```

### 5.2 의존성/연동 규칙

```
RBAC 선택 → MDS 자동 활성화 + LDAP 필수 + 컴포넌트별 ldap_user 필요
SASL 미포함 Listener → SASL 메커니즘 섹션 비활성화
Kerberos → Kerberos 설정 폼 표시
OAuth → OAuth IdP 설정 폼 표시
C3 선택 → Prometheus/Alertmanager 설정 필수
C3 SSL → ssl_provided_keystore_and_truststore (vars 레벨)
C3 OIDC → SSO Step 활성화
Schema Registry 선택 + RBAC → SR RBAC 연동 custom_properties 자동 생성
Archive 설치 → archive_* 변수 필수
install_java=false → custom_java_path 필수
컴포넌트별 jmxexporter_enabled=false + KAFKA_JMX_OPTS → JMX agent 직접 지정 모드
```

---

## 6. UI/UX 설계 원칙

### 6.1 기존 초안 컴포넌트 재사용
| UI 컴포넌트 | 사용처 | 기존 CSS 클래스 |
|------------|--------|----------------|
| Radio Card | 상호 배타적 선택 | `.option-card` + `.option-radio` |
| Checkbox Card | 다중 선택 (컴포넌트) | `.option-card` + `.option-check` |
| Step Dots | 14단계 네비게이션 | `.step-dot` |
| YAML Preview | 우측 고정 패널 | `.yaml-panel` + `.yaml-card` |
| Summary Bar | 하단 선택 요약 | `.summary-bar` + `.summary-grid` |
| Toast | 복사/다운로드 알림 | `.toast` |
| Dep Notice | 의존성 경고 | `.dep-notice` |

### 6.2 새로 추가할 UI 컴포넌트
| 컴포넌트 | 사용처 |
|---------|--------|
| Text Input | 호스트명, IP, 경로, 비밀번호 |
| Number Input + 기본값 | 포트, 스레드 수, 버퍼 크기 |
| Toggle Switch | 기능 on/off |
| Dynamic List (추가/삭제) | 호스트, SCRAM 사용자, Super Users |
| Key-Value Editor | custom_properties |
| Preset Selector | LDAP 프리셋, 성능 프리셋, IdP 프리셋 |
| Accordion (접기/펼치기) | 각 Step 섹션 |
| Textarea | 긴 JAAS config, 라이선스 키 |
| Tooltip/Help | 각 설정 항목 설명 |

### 6.3 레이아웃 유지
- 2-column 레이아웃: 좌(설정) / 우(YAML 미리보기, sticky)
- 14단계 Step Bar (스크롤 가능)
- 다크/라이트 테마
- 반응형 (모바일: 1-column)

---

## 7. 기술 스택

- **단일 HTML 파일** (기존 초안 방식 유지)
- **Vanilla JavaScript** (프레임워크 없음)
- **CSS Variables** (다크/라이트 테마)
- **Google Fonts**: Inter, Noto Sans KR, JetBrains Mono
- **html-to-image**: PNG 내보내기

---

## 8. 구현 로드맵

### Phase 1: 코어 프레임워크 확장
1. 14단계 네비게이션으로 Step Bar 확장
2. Step 1: 기본 환경 설정 폼
3. Step 2: 설치 방식 (Package/Archive) 폼
4. Step 3: 컴포넌트 선택 + 동적 호스트 입력 폼
5. Step 4: 사용자/그룹/경로 설정 폼
6. YAML 생성 엔진 리팩토링 (모듈화)

### Phase 2: 보안 설정 (기존 초안 통합/확장)
7. Step 5: Listener & 암호화 (기존 Step 1,3,6 통합 + Provided Keystore 추가)
8. Step 6: 인증 (기존 Step 2,7 통합 + 컴포넌트별 오버라이드)
9. Step 7: 인가 (기존 Step 4,5 통합 + rbac_super_users, C3 additional_system_admins)
10. Step 8: LDAP 연동 (기존 Step 8 확장 + Authentik 프리셋 + custom_properties 내 ldap.*)
11. Step 9: SSO/OIDC (신규 — C3 OIDC 설정)

### Phase 3: 컴포넌트 상세
12. Step 10: Kafka Broker 상세 (성능 튜닝 프리셋 + custom_properties)
13. Step 11: Schema Registry (RBAC 연동 custom_properties 자동 생성)
14. Step 11: Connect / ksqlDB (선택된 경우)
15. Step 12: Control Center Next Gen (Prometheus, Alertmanager, OIDC, SSL)

### Phase 4: 운영/고급
16. Step 13: JVM 힙 + JMX Exporter / JMX Agent + service_environment_overrides
17. Step 14: License, Secrets Protection, Telemetry 등

### Phase 5: 완성도
18. 유효성 검사 (필수값, 의존성, 포트 충돌)
19. 프리셋/템플릿 (dev / staging / production)
20. Import 기능 (기존 hosts.yml 불러오기 및 파싱)
21. 최종 UI 폴리시 및 테스트

---

## 9. 참조: cp-ansible 컴포넌트 & 포트

| 그룹명 | 컴포넌트 | 기본 포트 | JMX Agent 포트 (실제) |
|--------|----------|-----------|---------------------|
| `kafka_controller` | KRaft Controller | 9093 | 9999 |
| `kafka_broker` | Kafka Broker | 9091/9092 | 9995 |
| `schema_registry` | Schema Registry | 8081 (실제: 9081) | 9997 |
| `kafka_connect` | Kafka Connect | 8083 | — |
| `ksql` | ksqlDB | 8088 | — |
| `kafka_rest` | REST Proxy | 8082 | — |
| `control_center_next_gen` | Control Center NG | 9021 | — |
| C3 Prometheus | Prometheus | 9090 | — |
| C3 Alertmanager | Alertmanager | 9098 | — |
| MDS (on Broker) | Metadata Service | 8090 | — |

---

## 10. 참조: cp-ansible 샘플 인벤토리

| 파일 | 시나리오 | 유사도 |
|------|----------|--------|
| `sasl_ssl_kraft.yml` | SASL/PLAIN + TLS (KRaft) | 중간 |
| `oauth_greenfield.yml` | OAuth/OIDC + RBAC + SSO | 높음 |
| `rbac_kerberos_custom_certs_example.yml` | RBAC + Kerberos + Custom TLS | 중간 |
| `single_dev_node.yml` | 단일 노드 개발 환경 | 낮음 |
| `non_root_deployment.yml` | Archive 기반 비루트 설치 | **매우 높음** |
| `fips.yml` | FIPS 140-2/3 | 낮음 |

실제 hosts.yml은 **Archive 비루트 설치 + SASL/PLAIN + RBAC + LDAP(Authentik) + C3 OIDC/SSO** 조합으로,
`non_root_deployment.yml` + `oauth_greenfield.yml`의 복합 구성에 해당.
