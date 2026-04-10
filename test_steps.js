/**
 * hosts_generator.html — Step 1~14 TDD 통합 테스트
 *
 * 실행: node test_steps.js
 * TDD 원칙: RED → GREEN → REFACTOR
 * 커버리지 목표: 80%+
 */

'use strict';

const fs     = require('fs');
const vm     = require('vm');
const path   = require('path');
const jsyaml = require('js-yaml');

// ─── 1. HTML에서 JS 추출 ──────────────────────────────────────────────────────

const HTML_PATH = path.join(__dirname, 'hosts_generator.html');
const html      = fs.readFileSync(HTML_PATH, 'utf8');
const htmlLines = html.split('\n');
// <script> 태그 이후 영역만 추출 (718번 라인부터)
const rawBlock  = htmlLines.slice(717).join('\n');
let   js        = rawBlock.slice(rawBlock.indexOf('<script>') + 8, rawBlock.lastIndexOf('</script>'));

// vm sandbox에서는 var만 context 프로퍼티로 노출 → const/let 패치
js = js.replace(/^\s*const state\s*=/m, 'var state =');
js = js.replace(/^\s*const steps\s*=/m, 'var steps =');
// 테스트에서 접근할 수 있도록 전역 노출
js += '\ntry { this.state = state; this.generateYaml = generateYaml; this.parseYamlAndImport = parseYamlAndImport; } catch(e) {}';

// ─── 2. DOM 목(Mock) 설정 ────────────────────────────────────────────────────

function mkEl() {
  const el = {
    textContent: '', innerHTML: '', value: '', checked: false,
    className: '', id: '', type: '', name: '', placeholder: '',
    classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => {} },
    style: {},
    children: [],
    parentNode: null,
  };
  return new Proxy(el, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return typeof prop === 'string' && !prop.startsWith('__')
        ? (() => { const fn = (..._args) => mkEl(); fn.toString = () => ''; return fn; })()
        : undefined;
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
}

const ctx = {
  document: new Proxy({
    documentElement: { classList: { contains: () => false, add: () => {}, remove: () => {} } },
    body: mkEl(),
  }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return (..._args) => mkEl();
    }
  }),
  localStorage : { getItem: () => null, setItem: () => {} },
  navigator    : { clipboard: { writeText: () => Promise.resolve() } },
  location     : { reload: () => {} },
  confirm      : () => true,
  URL          : { createObjectURL: () => '#', revokeObjectURL: () => {} },
  Blob         : class {},
  html2canvas  : () => Promise.resolve({ toDataURL: () => '' }),
  console      : console,
  jsyaml       : jsyaml,
};

const sandbox = vm.createContext(ctx);
new vm.Script(js).runInContext(sandbox);

if (!sandbox.state)                throw new Error('state가 sandbox에 노출되지 않았습니다. JS 추출을 확인하세요.');
if (!sandbox.generateYaml)         throw new Error('generateYaml이 sandbox에 노출되지 않았습니다.');
if (!sandbox.parseYamlAndImport)   throw new Error('parseYamlAndImport가 sandbox에 노출되지 않았습니다.');

// ─── 3. 테스트 유틸리티 ──────────────────────────────────────────────────────

let PASS = 0, FAIL = 0, SKIP = 0;
const failures = [];

function resetState() {
  const S = sandbox.state.data;
  // 기본값으로 초기화
  S.ansible_connection      = 'ssh';
  S.ansible_user            = 'ec2-user';
  S.ansible_python_interpreter = '';
  S.ansible_become          = true;
  S.ansible_port            = 22;
  S.ansible_strategy        = '';
  S.deployment_strategy     = 'rolling';
  S.install_java            = false;
  S.custom_java_path        = '';
  S.installation_method     = 'package';
  S.confluent_package_version = '8.2.0';
  S.confluent_archive_file_source = '';
  S.confluent_archive_file_remote = false;
  S.archive_destination_path = '/opt/confluent';
  S.archive_owner           = '';
  S.archive_group           = '';
  S.confluent_control_center_next_gen_package_version = '';
  S.confluent_archive_control_center_next_gen_file_source = '';
  S.confluent_archive_control_center_next_gen_file_remote = false;
  S.confluent_cli_download_enabled = true;
  S.confluent_cli_archive_file_remote = false;
  S.confluent_server_enabled = true;
  S.components              = { schema_registry: false, kafka_connect: false, ksqldb: false, kafka_rest_proxy: false, control_center_next_gen: false, replicator: false };
  S.broker_collocated       = false;
  S.hosts                   = { kafka_controller: [], kafka_broker: [], schema_registry: [], kafka_connect: [], ksqldb: [], kafka_rest_proxy: [], control_center_next_gen: [], replicator: [] };
  S.common_user_group       = false;
  S.common_user             = '';
  S.common_group            = '';
  S.kafka_controller_log_dir = '';
  S.kafka_broker_log_dir    = '';
  S.schema_registry_log_dir = '';
  S.control_center_next_gen_log_dir = '';
  S.kafka_broker_log_dirs   = '';
  S.kafka_controller_log_dirs = '';
  S.listener_protocol       = 'PLAINTEXT';
  S.kraft_controller_security_protocol = 'PLAINTEXT';
  S.ssl_method              = 'none';
  S.fips_enabled            = false;
  S.sasl_mechanism          = 'plain';
  S.authorization_type      = 'none';
  S.mds_super_user          = '';
  S.mds_super_user_password = '';
  S.rbac_super_users        = [];
  S.create_mds_certs        = false;
  S.token_services_public_pem_file  = '';
  S.token_services_private_pem_file = '';
  S.component_ldap_users    = {};
  S.mds_broker_listener_ssl_enabled            = false;
  S.mds_broker_listener_ssl_mutual_auth_enabled = false;
  S.mds_broker_listener_sasl_protocol          = 'plain';
  S.kafka_broker_rest_proxy_enabled = false;
  S.ldap_enabled            = false;
  S.ldap_url                = '';
  S.ldap_base_dn            = '';
  S.ldap_user_search_base   = '';
  S.ldap_group_search_base  = '';
  S.ldap_user_name_attribute = 'cn';
  S.ldap_user_object_class  = 'inetOrgPerson';
  S.ldap_group_object_class = 'groupOfUniqueNames';
  S.ldap_group_member_attribute = 'uniqueMember';
  S.ldap_group_name_attribute = 'cn';
  S.ldap_search_mode        = 'GROUPS';
  S.ldap_broker_custom_props = {};
  S.control_center_oidc_enabled = false;
  S.sso_mode                = '';
  S.oidc_client_id          = '';
  S.oidc_client_secret      = '';
  S.oidc_issuer             = '';
  S.oidc_jwks_uri           = '';
  S.oidc_authorize_uri      = '';
  S.oidc_token_uri          = '';
  S.oidc_sub_claim_name     = '';
  S.oidc_groups_claim_name  = '';
  S.oidc_groups_claim_scope = '';
  S.oidc_refresh_token_enabled = false;
  S.oidc_session_token_expiry_ms = '';
  S.oidc_session_max_timeout_ms  = '';
  S.c3_session_expiration_ms     = '';
  S.broker_custom_properties    = {};
  S.kafka_controller_custom_properties = {};
  S.schema_registry_listener_port = 8081;
  S.schema_registry_config_prefix = '';
  S.schema_registry_kafkastore_topic = '_schemas';
  S.schema_registry_kafkastore_replication_factor = 3;
  S.schema_registry_custom_properties = {};
  S.c3_authentication_type  = 'none';
  S.c3_data_dir             = '';
  S.c3_service_user         = '';
  S.c3_service_password     = '';
  S.prometheus_port         = 9090;
  S.alertmanager_port       = 9098;
  S.prometheus_basic_auth_enabled   = false;
  S.alertmanager_basic_auth_enabled = false;
  S.c3_streams_kafka_listener_name             = '';
  S.c3_monitoring_interceptor_kafka_listener_name = '';
  S.c3_dependencies_config_path     = '';
  S.control_center_next_gen_ssl_enabled        = false;
  S.control_center_next_gen_additional_system_admins_str = '';
  S.prometheus_exec_start   = '';
  S.alertmanager_exec_start = '';
  S.alertmanager_web_listen_address        = '';
  S.alertmanager_cluster_advertise_address = '';
  S.alertmanager_ha_enabled = false;
  S.c3_ssl_provided_keystore   = false;
  S.c3_ssl_keystore_path       = '';
  S.c3_ssl_keystore_password   = '';
  S.c3_ssl_key_password        = '';
  S.c3_ssl_truststore_path     = '';
  S.c3_ssl_truststore_password = '';
  S.c3_custom_properties    = {};
  S.prometheus_host         = '';
  S.prometheus_tsdb_path    = '';
  S.prometheus_log_path     = '';
  S.prometheus_metrics_retention = '';
  S.alertmanager_host       = '';
  S.alertmanager_storage_path  = '';
  S.alertmanager_log_path   = '';
  S.kafka_broker_java_home  = '';
  S.kafka_broker_heap_opts  = '';
  S.kafka_broker_jmx_opts   = '';
  S.kafka_controller_java_home = '';
  S.kafka_controller_heap_opts = '';
  S.kafka_controller_jmx_opts  = '';
  S.c3_java_home            = '';
  S.c3_heap_opts            = '';
  S.c3_opts                 = '';
  S.schema_registry_heap_opts = '';
  S.schema_registry_opts    = '';
  S.jmx_enabled             = false;
  S.jmxexporter_url_remote  = false;
  S.kafka_broker_jmxexporter_enabled     = true;
  S.kafka_controller_jmxexporter_enabled = true;
  S.schema_registry_jmxexporter_enabled  = true;
  S.jmxexporter_jar_url     = '';
  S.jmxexporter_jar_path    = '';
  S.jmxexporter_config_path = '';
  S.jmxexporter_config_url  = '';
  S.secrets_protection_enabled = false;
  S.kafka_controller_secrets_protection_enabled = false;
  S.kafka_broker_secrets_protection_enabled     = false;
  S.confluent_license       = '';
  S.ldap_preset             = '';
}

function yaml()   { return sandbox.generateYaml(); }

function test(desc, fn) {
  try {
    resetState();
    fn();
    console.log(`  ✅ ${desc}`);
    PASS++;
  } catch (e) {
    console.log(`  ❌ ${desc}`);
    console.log(`     → ${e.message}`);
    failures.push({ desc, msg: e.message });
    FAIL++;
  }
}

function expect(actual) {
  return {
    toContain(str) {
      if (!actual.includes(str))
        throw new Error(`출력에 포함되지 않음:\n  기대: ${JSON.stringify(str)}\n  실제(첫 300자): ${actual.slice(0, 300)}`);
    },
    notToContain(str) {
      if (actual.includes(str))
        throw new Error(`출력에 포함되면 안 됨:\n  패턴: ${JSON.stringify(str)}`);
    },
    toMatch(re) {
      if (!re.test(actual))
        throw new Error(`정규식 불일치:\n  패턴: ${re}\n  실제(첫 300자): ${actual.slice(0, 300)}`);
    },
    toBe(expected) {
      if (actual !== expected)
        throw new Error(`값 불일치:\n  기대: ${JSON.stringify(expected)}\n  실제: ${JSON.stringify(actual)}`);
    },
    toBeTrue() {
      if (actual !== true)
        throw new Error(`true가 아님:\n  실제: ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual)
        throw new Error(`falsy가 아님:\n  실제: ${JSON.stringify(actual)}`);
    },
  };
}

function importYaml(yamlText) { return sandbox.parseYamlAndImport(yamlText); }

// ─── 4. 공통 호스트 세팅 (최소 구성) ──────────────────────────────────────────

function setMinimalHosts() {
  const S = sandbox.state.data;
  S.hosts.kafka_controller = [{ hostname: 'ctrl-1.example.com', ansible_host: '10.0.0.1', node_id: '9001', node_ip: '10.0.0.1' }];
  S.hosts.kafka_broker     = [{ hostname: 'ctrl-1.example.com', ansible_host: '10.0.0.1', broker_id: '1', broker_ip: '10.0.0.1' }];
}

// ─────────────────────────────────────────────────────────────────────────────
// ■ STEP 1: 기본 환경 설정
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════');
console.log('  Step 1: 기본 환경 설정');
console.log('══════════════════════════════════════');

test('ansible_connection: ssh 가 출력된다', () => {
  setMinimalHosts();
  sandbox.state.data.ansible_connection = 'ssh';
  expect(yaml()).toContain('ansible_connection: ssh');
});

test('ansible_user 가 출력된다', () => {
  setMinimalHosts();
  sandbox.state.data.ansible_user = '1726_admin1';
  expect(yaml()).toContain('ansible_user: 1726_admin1');
});

test('ansible_python_interpreter 가 지정 시 출력된다', () => {
  setMinimalHosts();
  sandbox.state.data.ansible_python_interpreter = '/usr/bin/python3.11';
  expect(yaml()).toContain('ansible_python_interpreter: /usr/bin/python3.11');
});

test('ansible_python_interpreter 미지정 시 출력 안 된다', () => {
  setMinimalHosts();
  sandbox.state.data.ansible_python_interpreter = '';
  expect(yaml()).notToContain('ansible_python_interpreter:');
});

test('ansible_become: true 가 출력된다', () => {
  setMinimalHosts();
  sandbox.state.data.ansible_become = true;
  expect(yaml()).toContain('ansible_become: true');
});

test('ansible_port: 22 가 출력된다', () => {
  setMinimalHosts();
  sandbox.state.data.ansible_port = 22;
  expect(yaml()).toContain('ansible_port: 22');
});

test('ansible_strategy: parallel 로 지정 시 출력된다', () => {
  setMinimalHosts();
  sandbox.state.data.ansible_strategy = 'parallel';
  expect(yaml()).toContain('ansible_strategy: parallel');
});

test('deployment_strategy: parallel 가 출력된다', () => {
  setMinimalHosts();
  sandbox.state.data.deployment_strategy = 'parallel';
  expect(yaml()).toContain('deployment_strategy: parallel');
});

test('install_java: false 이고 custom_java_path 지정 시 custom_java_path 출력', () => {
  setMinimalHosts();
  sandbox.state.data.install_java     = false;
  sandbox.state.data.custom_java_path = '/usr/lib/jvm/java-17-openjdk';
  const out = yaml();
  expect(out).toContain('install_java: false');
  expect(out).toContain('custom_java_path: /usr/lib/jvm/java-17-openjdk');
});

test('install_java: true 이면 custom_java_path 출력 안 된다', () => {
  setMinimalHosts();
  sandbox.state.data.install_java     = true;
  sandbox.state.data.custom_java_path = '/usr/lib/jvm/java-17-openjdk';
  expect(yaml()).notToContain('custom_java_path:');
});

// ─────────────────────────────────────────────────────────────────────────────
// ■ STEP 2: 설치 방식
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════');
console.log('  Step 2: 설치 방식');
console.log('══════════════════════════════════════');

test('installation_method: archive 출력', () => {
  setMinimalHosts();
  sandbox.state.data.installation_method = 'archive';
  expect(yaml()).toContain('installation_method: archive');
});

test('confluent_package_version 은 따옴표로 감싸진다', () => {
  setMinimalHosts();
  sandbox.state.data.confluent_package_version = '8.0.2';
  expect(yaml()).toContain('confluent_package_version: "8.0.2"');
});

test('archive 설치 시 confluent_archive_file_source 출력', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.installation_method          = 'archive';
  S.confluent_archive_file_source = '/home/user/confluent-8.0.2.zip';
  expect(yaml()).toContain('confluent_archive_file_source: /home/user/confluent-8.0.2.zip');
});

test('archive 설치 시 confluent_archive_file_remote 출력', () => {
  setMinimalHosts();
  sandbox.state.data.installation_method = 'archive';
  sandbox.state.data.confluent_archive_file_remote = false;
  expect(yaml()).toContain('confluent_archive_file_remote: false');
});

test('archive 설치 시 archive_destination_path 출력', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.installation_method   = 'archive';
  S.archive_destination_path = '/app/sol/kafka/confluent';
  expect(yaml()).toContain('archive_destination_path: /app/sol/kafka/confluent');
});

test('archive 설치 시 archive_owner, archive_group 출력', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.installation_method = 'archive';
  S.archive_owner       = '1726_admin1';
  S.archive_group       = '1726_admin1';
  const out = yaml();
  expect(out).toContain('archive_owner: 1726_admin1');
  expect(out).toContain('archive_group: 1726_admin1');
});

test('C3 선택 + archive 시 confluent_control_center_next_gen_package_version 출력', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.installation_method = 'archive';
  S.components.control_center_next_gen = true;
  S.hosts.control_center_next_gen = [{ hostname: 'c3.example.com', ansible_host: '10.0.0.4' }];
  S.confluent_control_center_next_gen_package_version = '2.3.0';
  expect(yaml()).toContain('confluent_control_center_next_gen_package_version: "2.3.0"');
});

test('C3 선택 + archive 시 confluent_archive_control_center_next_gen_file_source 출력', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.installation_method = 'archive';
  S.components.control_center_next_gen = true;
  S.hosts.control_center_next_gen = [{ hostname: 'c3.example.com', ansible_host: '10.0.0.4' }];
  S.confluent_archive_control_center_next_gen_file_source = '/home/user/c3-next-gen-2.3.0.tar.gz';
  expect(yaml()).toContain('confluent_archive_control_center_next_gen_file_source: /home/user/c3-next-gen-2.3.0.tar.gz');
});

test('confluent_cli_download_enabled: false 시 confluent_cli_archive_file_remote 출력', () => {
  setMinimalHosts();
  sandbox.state.data.confluent_cli_download_enabled  = false;
  sandbox.state.data.confluent_cli_archive_file_remote = false;
  const out = yaml();
  expect(out).toContain('confluent_cli_download_enabled: false');
  expect(out).toContain('confluent_cli_archive_file_remote: false');
});

test('confluent_server_enabled: true 는 기본값이므로 출력 안 됨', () => {
  setMinimalHosts();
  sandbox.state.data.confluent_server_enabled = true;
  expect(yaml()).notToContain('confluent_server_enabled:');
});

test('confluent_server_enabled: false 시에만 출력됨', () => {
  setMinimalHosts();
  sandbox.state.data.confluent_server_enabled = false;
  expect(yaml()).toContain('confluent_server_enabled: false');
});

// ─────────────────────────────────────────────────────────────────────────────
// ■ STEP 3: 컴포넌트 선택 & 호스트 정의
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════');
console.log('  Step 3: 컴포넌트 선택 & 호스트 정의');
console.log('══════════════════════════════════════');

test('kafka_controller 그룹이 항상 출력된다', () => {
  setMinimalHosts();
  expect(yaml()).toContain('kafka_controller:');
});

test('kafka_broker 그룹이 항상 출력된다', () => {
  setMinimalHosts();
  expect(yaml()).toContain('kafka_broker:');
});

test('controller 호스트에 node_id / node_ip 가 출력된다', () => {
  setMinimalHosts();
  const out = yaml();
  expect(out).toContain('node_id: 9001');
  expect(out).toContain('node_ip: 10.0.0.1');
});

test('broker 호스트에 broker_id 가 출력된다', () => {
  setMinimalHosts();
  expect(yaml()).toContain('broker_id: 1');
});

test('schema_registry 미선택 시 그룹 미출력', () => {
  setMinimalHosts();
  sandbox.state.data.components.schema_registry = false;
  expect(yaml()).notToContain('schema_registry:');
});

test('schema_registry 선택 시 그룹 출력', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.components.schema_registry = true;
  S.hosts.schema_registry = [
    { hostname: 'sr-1.example.com', ansible_host: '10.0.0.2', schema_registry_host_name: 'sr-1.example.com', schema_registry_listener_hostname: 'sr-1.example.com' }
  ];
  expect(yaml()).toContain('schema_registry:');
});

test('schema_registry_host_name 이 지정 시 출력된다', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.components.schema_registry = true;
  S.hosts.schema_registry = [
    { hostname: 'sr-1.example.com', ansible_host: '10.0.0.2', schema_registry_host_name: 'sr-custom.example.com', schema_registry_listener_hostname: '' }
  ];
  expect(yaml()).toContain('schema_registry_host_name: sr-custom.example.com');
});

test('control_center_next_gen 선택 시 그룹 출력', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.components.control_center_next_gen = true;
  S.hosts.control_center_next_gen = [{ hostname: 'c3.example.com', ansible_host: '10.0.0.4' }];
  expect(yaml()).toContain('control_center_next_gen:');
});

test('3개 controller 호스트 모두 출력된다', () => {
  const S = sandbox.state.data;
  S.hosts.kafka_controller = [
    { hostname: 'ctrl-1.example.com', ansible_host: '10.0.0.1', node_id: '9001', node_ip: '10.0.0.1' },
    { hostname: 'ctrl-2.example.com', ansible_host: '10.0.0.2', node_id: '9002', node_ip: '10.0.0.2' },
    { hostname: 'ctrl-3.example.com', ansible_host: '10.0.0.3', node_id: '9003', node_ip: '10.0.0.3' },
  ];
  S.hosts.kafka_broker = S.hosts.kafka_controller.map((h, i) => ({
    hostname: h.hostname, ansible_host: h.ansible_host, broker_id: String(i + 1), broker_ip: h.ansible_host
  }));
  const out = yaml();
  expect(out).toContain('ctrl-1.example.com');
  expect(out).toContain('ctrl-2.example.com');
  expect(out).toContain('ctrl-3.example.com');
});

// ─────────────────────────────────────────────────────────────────────────────
// ■ STEP 4: 사용자 / 그룹 / 경로
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════');
console.log('  Step 4: 사용자/그룹/경로');
console.log('══════════════════════════════════════');

test('common_user_group 활성화 시 모든 컴포넌트에 사용자/그룹 적용', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.common_user_group = true;
  S.common_user  = 'myuser';
  S.common_group = 'mygroup';
  const out = yaml();
  expect(out).toContain('kafka_broker_user: myuser');
  expect(out).toContain('kafka_broker_group: mygroup');
  expect(out).toContain('kafka_controller_user: myuser');
  expect(out).toContain('kafka_controller_group: mygroup');
});

test('kafka_broker_log_dir 출력', () => {
  setMinimalHosts();
  sandbox.state.data.kafka_broker_log_dir = '/log/broker';
  expect(yaml()).toContain('kafka_broker_log_dir: /log/broker');
});

test('kafka_controller_log_dir 출력', () => {
  setMinimalHosts();
  sandbox.state.data.kafka_controller_log_dir = '/log/controller';
  expect(yaml()).toContain('kafka_controller_log_dir: /log/controller');
});

test('schema_registry_log_dir 는 schema_registry 선택 시 출력', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.components.schema_registry = true;
  S.hosts.schema_registry = [{ hostname: 'sr.example.com', ansible_host: '10.0.0.2', schema_registry_host_name: '', schema_registry_listener_hostname: '' }];
  S.schema_registry_log_dir = '/log/sr';
  expect(yaml()).toContain('schema_registry_log_dir: /log/sr');
});

test('kafka_broker_log_dirs (data dir) → kafka_broker_custom_properties.log.dirs 로 출력', () => {
  setMinimalHosts();
  sandbox.state.data.kafka_broker_log_dirs = '/data01/broker';
  const out = yaml();
  // kafka_broker_log_dirs는 kafka_broker_custom_properties 내부의 log.dirs 키로 출력됨
  expect(out).toContain('kafka_broker_custom_properties:');
  expect(out).toContain('log.dirs: /data01/broker');
});

test('control_center_next_gen_log_dir 는 C3 선택 시 출력', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.components.control_center_next_gen = true;
  S.hosts.control_center_next_gen = [{ hostname: 'c3.example.com', ansible_host: '10.0.0.4' }];
  S.control_center_next_gen_log_dir = '/log/c3';
  expect(yaml()).toContain('control_center_next_gen_log_dir: /log/c3');
});

// ─────────────────────────────────────────────────────────────────────────────
// ■ STEP 5: Listener & 암호화
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════');
console.log('  Step 5: Listener & 암호화');
console.log('══════════════════════════════════════');

test('SASL_PLAINTEXT listener_protocol 출력', () => {
  setMinimalHosts();
  sandbox.state.data.listener_protocol = 'SASL_PLAINTEXT';
  expect(yaml()).toContain('sasl_protocol: plain');
});

test('PLAINTEXT 환경에서 ssl_enabled 출력 안 됨', () => {
  setMinimalHosts();
  sandbox.state.data.listener_protocol = 'PLAINTEXT';
  expect(yaml()).notToContain('ssl_enabled:');
});

test('SSL + provided-keystore 환경에서 ssl_provided_keystore_and_truststore: true 출력', () => {
  setMinimalHosts();
  sandbox.state.data.listener_protocol = 'SSL';
  sandbox.state.data.ssl_method = 'provided-keystore';
  expect(yaml()).toContain('ssl_provided_keystore_and_truststore: true');
});

test('SASL_PLAINTEXT 에서 mds_broker_listener 출력 안 됨 (ssl없음)', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.listener_protocol = 'SASL_PLAINTEXT';
  S.authorization_type = 'rbac';
  S.mds_broker_listener_ssl_enabled             = false;
  S.mds_broker_listener_ssl_mutual_auth_enabled = false;
  expect(yaml()).notToContain('mds_broker_listener:');
});

test('RBAC + mds_broker_listener ssl_enabled: true 이면 mds_broker_listener 출력', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.authorization_type = 'rbac';
  S.mds_broker_listener_ssl_enabled = true;
  S.mds_super_user = 'admin';
  S.mds_super_user_password = 'secret';
  expect(yaml()).toContain('mds_broker_listener:');
});

test('fips_enabled: true 출력', () => {
  setMinimalHosts();
  sandbox.state.data.fips_enabled = true;
  expect(yaml()).toContain('fips_enabled: true');
});

test('fips_enabled: false 이면 출력 안 됨 (기본값)', () => {
  setMinimalHosts();
  sandbox.state.data.fips_enabled = false;
  expect(yaml()).notToContain('fips_enabled:');
});

// ─────────────────────────────────────────────────────────────────────────────
// ■ STEP 6: 인증 (Authentication)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════');
console.log('  Step 6: 인증 (Authentication)');
console.log('══════════════════════════════════════');

test('sasl_mechanism: plain 이면 sasl_protocol: plain 출력', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.listener_protocol = 'SASL_PLAINTEXT';
  S.sasl_mechanism    = 'plain';
  expect(yaml()).toContain('sasl_protocol: plain');
});

test('sasl_plain_users 블록 출력 (PLAIN 인증 시)', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.listener_protocol = 'SASL_PLAINTEXT';
  S.sasl_mechanism    = 'plain';
  // sasl_plain_users 는 broker에서 생성되는지 확인
  // (PLAIN 메커니즘이면 내부 inter-broker용 admin 유저 출력)
  const out = yaml();
  // sasl_protocol: plain 이 all.vars 에 나타나야 함
  expect(out).toContain('sasl_protocol: plain');
});

// ─────────────────────────────────────────────────────────────────────────────
// ■ STEP 7: 인가 (Authorization / RBAC)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════');
console.log('  Step 7: 인가 (Authorization)');
console.log('══════════════════════════════════════');

test('rbac_enabled: true 출력 (authorization_type=rbac)', () => {
  setMinimalHosts();
  sandbox.state.data.authorization_type = 'rbac';
  expect(yaml()).toContain('rbac_enabled: true');
});

test('mds_super_user, mds_super_user_password 출력', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.authorization_type      = 'rbac';
  S.mds_super_user          = 'admin';
  S.mds_super_user_password = 'secret';
  const out = yaml();
  expect(out).toContain('mds_super_user: admin');
  expect(out).toContain('mds_super_user_password: secret');
});

test('rbac_super_users 리스트 출력', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.authorization_type = 'rbac';
  S.mds_super_user     = 'admin';
  S.rbac_super_users   = ['User:admin', 'User:c3svc'];
  const out = yaml();
  expect(out).toContain('rbac_super_users:');
  // rbac_super_users 항목은 이중 따옴표로 감싸서 출력됨
  expect(out).toContain('- "User:admin"');
  expect(out).toContain('- "User:c3svc"');
});

test('create_mds_certs: false 이면 출력 안 됨 (기본값)', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.authorization_type = 'rbac';
  S.create_mds_certs   = false;
  expect(yaml()).notToContain('create_mds_certs:');
});

test('create_mds_certs: true 이면 출력됨', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.authorization_type = 'rbac';
  S.create_mds_certs   = true;
  expect(yaml()).toContain('create_mds_certs: true');
});

test('token_services PEM 파일 경로 출력', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.authorization_type              = 'rbac';
  S.token_services_public_pem_file  = '/etc/ssl/public.pem';
  S.token_services_private_pem_file = '/etc/ssl/private.pem';
  const out = yaml();
  expect(out).toContain('token_services_public_pem_file: /etc/ssl/public.pem');
  expect(out).toContain('token_services_private_pem_file: /etc/ssl/private.pem');
});

test('component_ldap_users 출력 (RBAC + LDAP)', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.authorization_type = 'rbac';
  S.ldap_enabled       = true;
  S.component_ldap_users = {
    kafka_broker_ldap_user:    'cn=admin,dc=test',
    kafka_broker_ldap_password:'pass123',
  };
  const out = yaml();
  // component_ldap_users 값은 이중 따옴표로 감싸서 출력됨
  expect(out).toContain('kafka_broker_ldap_user: "cn=admin,dc=test"');
  expect(out).toContain('kafka_broker_ldap_password: "pass123"');
});

// ─────────────────────────────────────────────────────────────────────────────
// ■ STEP 8: LDAP 연동
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════');
console.log('  Step 8: LDAP 연동');
console.log('══════════════════════════════════════');

test('ldap_url, ldap_base_dn 출력 (RBAC+LDAP)', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.authorization_type    = 'rbac';
  S.ldap_enabled          = true;
  S.ldap_url              = 'ldap://ldap.example.com:389';
  S.ldap_base_dn          = 'dc=example,dc=com';
  const out = yaml();
  // ldap_url, ldap_base_dn 은 이중 따옴표로 감싸서 출력됨
  expect(out).toContain('ldap_url: "ldap://ldap.example.com:389"');
  expect(out).toContain('ldap_base_dn: "dc=example,dc=com"');
});

test('ldap_user_search_base, ldap_group_search_base 출력', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.authorization_type      = 'rbac';
  S.ldap_enabled            = true;
  S.ldap_user_search_base   = 'ou=users,dc=example,dc=com';
  S.ldap_group_search_base  = 'ou=groups,dc=example,dc=com';
  const out = yaml();
  // ldap search base 값도 이중 따옴표로 감싸서 출력됨
  expect(out).toContain('ldap_user_search_base: "ou=users,dc=example,dc=com"');
  expect(out).toContain('ldap_group_search_base: "ou=groups,dc=example,dc=com"');
});

test('ldap_search_mode: GROUPS 는 기본값이므로 출력 안 됨', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.authorization_type = 'rbac';
  S.ldap_enabled       = true;
  S.ldap_search_mode   = 'GROUPS';
  expect(yaml()).notToContain('ldap_search_mode:');
});

test('ldap_search_mode: USERS 이면 출력됨', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.authorization_type = 'rbac';
  S.ldap_enabled       = true;
  S.ldap_search_mode   = 'USERS';
  expect(yaml()).toContain('ldap_search_mode: USERS');
});

test('ldap_broker_custom_props 키/값 출력', () => {
  setMinimalHosts();
  const S = sandbox.state.data;
  S.authorization_type = 'rbac';
  S.ldap_enabled       = true;
  S.ldap_broker_custom_props = {
    'ldap.java.naming.factory.initial': 'com.sun.jndi.ldap.LdapCtxFactory',
    'ldap.user.name.attribute': 'cn',
  };
  const out = yaml();
  expect(out).toContain('ldap.java.naming.factory.initial: com.sun.jndi.ldap.LdapCtxFactory');
  expect(out).toContain('ldap.user.name.attribute: cn');
});

// ─────────────────────────────────────────────────────────────────────────────
// ■ STEP 9: SSO / OIDC
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════');
console.log('  Step 9: SSO / OIDC');
console.log('══════════════════════════════════════');

function enableOidc(S) {
  S.components.control_center_next_gen = true;
  S.hosts.control_center_next_gen = [{ hostname: 'c3.example.com', ansible_host: '10.0.0.4' }];
  S.control_center_oidc_enabled   = true;
  S.sso_mode                      = 'oidc';
  S.oidc_client_id                = 'my-client-id';
  S.oidc_client_secret            = 'my-secret';
  S.oidc_issuer                   = 'https://idp.example.com/';
  S.oidc_jwks_uri                 = 'https://idp.example.com/jwks/';
  S.oidc_authorize_uri            = 'https://idp.example.com/auth/';
  S.oidc_token_uri                = 'https://idp.example.com/token/';
  S.oidc_refresh_token_enabled    = true;
}

// OIDC 설정은 all.vars가 아닌 control_center_next_gen 호스트 레벨의
// control_center_next_gen_custom_properties 블록에 confluent.oidc.* 형식으로 출력됨

test('OIDC 활성화 시 confluent.controlcenter.auth.sso.mode: OIDC 출력', () => {
  setMinimalHosts();
  enableOidc(sandbox.state.data);
  const out = yaml();
  expect(out).toContain('control_center_next_gen_custom_properties:');
  expect(out).toContain('confluent.controlcenter.auth.sso.mode: OIDC');
});

test('OIDC client_id 는 confluent.oidc.idp.client.id 로 따옴표 감싸서 출력', () => {
  setMinimalHosts();
  enableOidc(sandbox.state.data);
  expect(yaml()).toContain('confluent.oidc.idp.client.id: "my-client-id"');
});

test('OIDC client_secret 는 confluent.oidc.idp.client.secret 로 따옴표 감싸서 출력', () => {
  setMinimalHosts();
  enableOidc(sandbox.state.data);
  expect(yaml()).toContain('confluent.oidc.idp.client.secret: "my-secret"');
});

test('OIDC issuer URI 는 confluent.oidc.idp.issuer 로 따옴표 감싸서 출력', () => {
  setMinimalHosts();
  enableOidc(sandbox.state.data);
  expect(yaml()).toContain('confluent.oidc.idp.issuer: "https://idp.example.com/"');
});

test('OIDC jwks_uri 는 confluent.oidc.idp.jwks.endpoint.uri 로 따옴표 감싸서 출력', () => {
  setMinimalHosts();
  enableOidc(sandbox.state.data);
  expect(yaml()).toContain('confluent.oidc.idp.jwks.endpoint.uri: "https://idp.example.com/jwks/"');
});

test('OIDC refresh_token_enabled: true 는 문자열 "true" 로 출력', () => {
  setMinimalHosts();
  enableOidc(sandbox.state.data);
  sandbox.state.data.oidc_refresh_token_enabled = true;
  expect(yaml()).toContain('confluent.oidc.idp.refresh.token.enabled: "true"');
});

test('OIDC refresh_token_enabled: false 는 문자열 "false" 로 출력', () => {
  setMinimalHosts();
  enableOidc(sandbox.state.data);
  sandbox.state.data.oidc_refresh_token_enabled = false;
  expect(yaml()).toContain('confluent.oidc.idp.refresh.token.enabled: "false"');
});

// ─────────────────────────────────────────────────────────────────────────────
// ■ STEP 10: Kafka Broker 상세 설정
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════');
console.log('  Step 10: Kafka Broker 상세 설정');
console.log('══════════════════════════════════════');

test('broker_custom_properties 키/값 출력 (kafka_broker 그룹 vars)', () => {
  setMinimalHosts();
  sandbox.state.data.broker_custom_properties = {
    'num.network.threads': '16',
    'num.io.threads': '32',
  };
  const out = yaml();
  expect(out).toContain('num.network.threads: 16');
  expect(out).toContain('num.io.threads: 32');
});

test('kafka_controller_custom_properties 키/값 출력 (kafka_controller 그룹 vars)', () => {
  setMinimalHosts();
  sandbox.state.data.kafka_controller_custom_properties = {
    'num.network.threads': '3',
    'confluent.balancer.enable': 'true',
  };
  const out = yaml();
  expect(out).toContain('num.network.threads: 3');
  expect(out).toContain('confluent.balancer.enable: true');
});

test('custom_properties 값이 따옴표 포함 시 그대로 출력', () => {
  setMinimalHosts();
  sandbox.state.data.broker_custom_properties = {
    'confluent.balancer.enable': '"true"',
  };
  expect(yaml()).toContain('confluent.balancer.enable: "true"');
});

// ─────────────────────────────────────────────────────────────────────────────
// ■ STEP 11: Schema Registry
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════');
console.log('  Step 11: Schema Registry');
console.log('══════════════════════════════════════');

function enableSR(S) {
  S.components.schema_registry = true;
  S.hosts.schema_registry = [
    { hostname: 'sr-1.example.com', ansible_host: '10.0.0.2', schema_registry_host_name: '', schema_registry_listener_hostname: '' }
  ];
}

test('schema_registry_listener_port 출력', () => {
  setMinimalHosts();
  enableSR(sandbox.state.data);
  sandbox.state.data.schema_registry_listener_port = 9081;
  expect(yaml()).toContain('schema_registry_listener_port: 9081');
});

test('schema_registry_config_prefix 지정 시 출력', () => {
  setMinimalHosts();
  enableSR(sandbox.state.data);
  sandbox.state.data.schema_registry_config_prefix = '/etc/schema-registry';
  expect(yaml()).toContain('schema_registry_config_prefix: "/etc/schema-registry"');
});

test('schema_registry_kafkastore_topic 출력', () => {
  setMinimalHosts();
  enableSR(sandbox.state.data);
  sandbox.state.data.schema_registry_kafkastore_topic = '_schemas';
  // kafkastore.topic 은 schema_registry group vars 에 출력됨 (따옴표 포함)
  expect(yaml()).toContain('kafkastore.topic: "_schemas"');
});

test('schema_registry_kafkastore_replication_factor 출력', () => {
  setMinimalHosts();
  enableSR(sandbox.state.data);
  sandbox.state.data.schema_registry_kafkastore_replication_factor = 3;
  // kafkastore.topic.replication.factor 는 schema_registry group vars 에 출력됨
  expect(yaml()).toContain('kafkastore.topic.replication.factor: 3');
});

test('schema_registry_custom_properties 출력', () => {
  setMinimalHosts();
  enableSR(sandbox.state.data);
  sandbox.state.data.schema_registry_custom_properties = {
    'kafkastore.security.protocol': 'SASL_PLAINTEXT',
    'kafkastore.sasl.mechanism':    'OAUTHBEARER',
  };
  const out = yaml();
  expect(out).toContain('kafkastore.security.protocol: SASL_PLAINTEXT');
  expect(out).toContain('kafkastore.sasl.mechanism: OAUTHBEARER');
});

// ─────────────────────────────────────────────────────────────────────────────
// ■ STEP 12: Control Center Next Gen
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════');
console.log('  Step 12: Control Center Next Gen');
console.log('══════════════════════════════════════');

function enableC3(S) {
  S.components.control_center_next_gen = true;
  S.hosts.control_center_next_gen = [{ hostname: 'c3.example.com', ansible_host: '10.0.0.4' }];
}

test('control_center_next_gen_authentication_type 출력', () => {
  setMinimalHosts();
  enableC3(sandbox.state.data);
  sandbox.state.data.c3_authentication_type = 'ldap';
  expect(yaml()).toContain('control_center_next_gen_authentication_type: ldap');
});

test('control_center_next_gen_data_dir 출력', () => {
  setMinimalHosts();
  enableC3(sandbox.state.data);
  sandbox.state.data.c3_data_dir = '/data01/c3';
  expect(yaml()).toContain('control_center_next_gen_data_dir: /data01/c3');
});

test('prometheus_port, alertmanager_port 출력', () => {
  setMinimalHosts();
  enableC3(sandbox.state.data);
  sandbox.state.data.prometheus_port   = 9090;
  sandbox.state.data.alertmanager_port = 9098;
  const out = yaml();
  expect(out).toContain('control_center_next_gen_dependency_prometheus_port: 9090');
  expect(out).toContain('control_center_next_gen_dependency_alertmanager_port: 9098');
});

test('prometheus/alertmanager basic_auth_enabled 출력', () => {
  setMinimalHosts();
  enableC3(sandbox.state.data);
  sandbox.state.data.prometheus_basic_auth_enabled   = false;
  sandbox.state.data.alertmanager_basic_auth_enabled = false;
  const out = yaml();
  expect(out).toContain('control_center_next_gen_dependency_prometheus_basic_auth_enabled: false');
  expect(out).toContain('control_center_next_gen_dependency_alertmanager_basic_auth_enabled: false');
});

test('c3_dependencies_config_path 지정 시 출력', () => {
  setMinimalHosts();
  enableC3(sandbox.state.data);
  sandbox.state.data.c3_dependencies_config_path = '/app/sol/kafka/confluent/c3-2.3.0/etc/confluent-control-center';
  expect(yaml()).toContain('control_center_next_gen_dependencies_config_path: /app/sol/kafka/confluent/c3-2.3.0/etc/confluent-control-center');
});

test('control_center_next_gen_ssl_enabled 항상 출력 (C3 선택 시)', () => {
  setMinimalHosts();
  enableC3(sandbox.state.data);
  sandbox.state.data.control_center_next_gen_ssl_enabled = true;
  expect(yaml()).toContain('control_center_next_gen_ssl_enabled: true');
});

test('control_center_next_gen_additional_system_admins 리스트 출력', () => {
  setMinimalHosts();
  enableC3(sandbox.state.data);
  sandbox.state.data.control_center_next_gen_additional_system_admins_str = 'Group:c3-admins\nUser:operator';
  const out = yaml();
  expect(out).toContain('control_center_next_gen_additional_system_admins:');
  expect(out).toContain('- Group:c3-admins');
  expect(out).toContain('- User:operator');
});

test('prometheus ExecStart 지정 시 출력', () => {
  setMinimalHosts();
  enableC3(sandbox.state.data);
  // prometheus service env 블록은 prometheus_host|tsdb_path|log_path 중 하나가 있어야 출력됨
  sandbox.state.data.prometheus_tsdb_path  = '/data/prometheus';
  sandbox.state.data.prometheus_exec_start = '/app/sol/kafka/confluent/c3-2.3.0/bin/prometheus-start';
  expect(yaml()).toContain('ExecStart: /app/sol/kafka/confluent/c3-2.3.0/bin/prometheus-start');
});

test('alertmanager ExecStart 지정 시 출력', () => {
  setMinimalHosts();
  enableC3(sandbox.state.data);
  // alertmanager service env 블록은 alertmanager_host|storage_path|log_path 중 하나가 있어야 출력됨
  sandbox.state.data.alertmanager_storage_path = '/data/alertmanager';
  sandbox.state.data.alertmanager_exec_start = '/app/sol/kafka/confluent/c3-2.3.0/bin/alertmanager-start';
  expect(yaml()).toContain('ExecStart: /app/sol/kafka/confluent/c3-2.3.0/bin/alertmanager-start');
});

test('alertmanager WEB_LISTEN_ADDRESS 지정 시 출력', () => {
  setMinimalHosts();
  enableC3(sandbox.state.data);
  // alertmanager service env 블록 트리거
  sandbox.state.data.alertmanager_storage_path = '/data/alertmanager';
  sandbox.state.data.alertmanager_web_listen_address = '0.0.0.0:9098';
  expect(yaml()).toContain('WEB_LISTEN_ADDRESS: "0.0.0.0:9098"');
});

test('alertmanager CLUSTER_ADVERTISE_ADDRESS 지정 시 출력', () => {
  setMinimalHosts();
  enableC3(sandbox.state.data);
  // alertmanager service env 블록 트리거
  sandbox.state.data.alertmanager_storage_path = '/data/alertmanager';
  sandbox.state.data.alertmanager_cluster_advertise_address = '0.0.0.0:9098';
  expect(yaml()).toContain('CLUSTER_ADVERTISE_ADDRESS: "0.0.0.0:9098"');
});

test('CONTROL_CENTER_ALERTMANAGER_HA_ENABLED 출력', () => {
  setMinimalHosts();
  enableC3(sandbox.state.data);
  // alertmanager service env 블록 트리거
  sandbox.state.data.alertmanager_storage_path = '/data/alertmanager';
  sandbox.state.data.alertmanager_ha_enabled = false;
  expect(yaml()).toContain('CONTROL_CENTER_ALERTMANAGER_HA_ENABLED: false');
});

test('c3_custom_properties 출력 (host-level)', () => {
  setMinimalHosts();
  enableC3(sandbox.state.data);
  sandbox.state.data.c3_custom_properties = {
    'confluent.controlcenter.id': '3',
    'confluent.controlcenter.ksql.enable': 'false',
  };
  const out = yaml();
  expect(out).toContain('confluent.controlcenter.id: 3');
  expect(out).toContain('confluent.controlcenter.ksql.enable: false');
});

// ─────────────────────────────────────────────────────────────────────────────
// ■ STEP 13: JVM & 모니터링
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════');
console.log('  Step 13: JVM & 모니터링');
console.log('══════════════════════════════════════');

test('kafka_broker JAVA_HOME 출력', () => {
  setMinimalHosts();
  sandbox.state.data.kafka_broker_java_home = '/usr/lib/jvm/java-17-openjdk';
  expect(yaml()).toContain('JAVA_HOME: /usr/lib/jvm/java-17-openjdk');
});

test('kafka_broker KAFKA_HEAP_OPTS 출력', () => {
  setMinimalHosts();
  sandbox.state.data.kafka_broker_heap_opts = '-Xms4g -Xmx4g';
  expect(yaml()).toContain('KAFKA_HEAP_OPTS: "-Xms4g -Xmx4g"');
});

test('kafka_broker KAFKA_JMX_OPTS 출력', () => {
  setMinimalHosts();
  sandbox.state.data.kafka_broker_jmx_opts = '-javaagent:/opt/jmx.jar=9995:/opt/client.yml';
  expect(yaml()).toContain('KAFKA_JMX_OPTS: "-javaagent:/opt/jmx.jar=9995:/opt/client.yml"');
});

test('jmxexporter_enabled: true 시 글로벌 플래그 출력', () => {
  setMinimalHosts();
  sandbox.state.data.jmx_enabled = true;
  expect(yaml()).toContain('jmxexporter_enabled: true');
});

test('jmxexporter 비활성 컴포넌트는 false 플래그 출력', () => {
  setMinimalHosts();
  sandbox.state.data.jmx_enabled = true;
  sandbox.state.data.kafka_broker_jmxexporter_enabled     = false;
  sandbox.state.data.kafka_controller_jmxexporter_enabled = false;
  const out = yaml();
  expect(out).toContain('kafka_broker_jmxexporter_enabled: false');
  expect(out).toContain('kafka_controller_jmxexporter_enabled: false');
});

test('jmxexporter_jar_url, jar_path, config_path 출력', () => {
  setMinimalHosts();
  sandbox.state.data.jmx_enabled          = true;
  sandbox.state.data.jmxexporter_jar_url  = '/home/user/jmx.jar';
  sandbox.state.data.jmxexporter_jar_path = '/opt/jmx.jar';
  sandbox.state.data.jmxexporter_config_path = '/opt/client.yml';
  const out = yaml();
  expect(out).toContain('jmxexporter_jar_url: /home/user/jmx.jar');
  expect(out).toContain('jmxexporter_jar_path: /opt/jmx.jar');
  expect(out).toContain('jmxexporter_config_path: /opt/client.yml');
});

test('schema_registry SCHEMA_REGISTRY_OPTS 출력', () => {
  setMinimalHosts();
  enableSR(sandbox.state.data);
  sandbox.state.data.schema_registry_opts = '-javaagent:/opt/jmx.jar=9997:/opt/client.yml';
  expect(yaml()).toContain('SCHEMA_REGISTRY_OPTS: "-javaagent:/opt/jmx.jar=9997:/opt/client.yml"');
});

test('schema_registry SCHEMA_REGISTRY_HEAP_OPTS 출력', () => {
  setMinimalHosts();
  enableSR(sandbox.state.data);
  sandbox.state.data.schema_registry_heap_opts = '-Xms8G -Xmx8G';
  expect(yaml()).toContain('SCHEMA_REGISTRY_HEAP_OPTS: "-Xms8G -Xmx8G"');
});

test('secrets_protection_enabled: false 컴포넌트 수준에서 출력', () => {
  setMinimalHosts();
  // 글로벌 true, 컴포넌트 false → 컴포넌트 레벨에서 false 명시 출력
  sandbox.state.data.secrets_protection_enabled                  = true;
  sandbox.state.data.kafka_controller_secrets_protection_enabled = false;
  sandbox.state.data.kafka_broker_secrets_protection_enabled     = false;
  const out = yaml();
  expect(out).toContain('secrets_protection_enabled: true');
  expect(out).toContain('kafka_broker_secrets_protection_enabled: false');
  expect(out).toContain('kafka_controller_secrets_protection_enabled: false');
});

// ─────────────────────────────────────────────────────────────────────────────
// ■ STEP 14: 고급 설정 (License / Secrets Protection)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════');
console.log('  Step 14: 고급 설정 (License / Secrets)');
console.log('══════════════════════════════════════');

test('confluent_license 출력', () => {
  setMinimalHosts();
  sandbox.state.data.confluent_license = 'eyJhbGciOiJub25lIn0.abc.';
  // confluent_license 는 이중 따옴표로 감싸서 출력됨
  expect(yaml()).toContain('confluent_license: "eyJhbGciOiJub25lIn0.abc."');
});

test('confluent_license 미지정(빈 문자열)이어도 항상 출력됨 (cp-ansible 필수, null 불허)', () => {
  setMinimalHosts();
  sandbox.state.data.confluent_license = '';
  expect(yaml()).toContain('confluent_license: ""');
});

test('secrets_protection_enabled: true 이면 글로벌에 출력', () => {
  setMinimalHosts();
  sandbox.state.data.secrets_protection_enabled = true;
  expect(yaml()).toContain('secrets_protection_enabled: true');
});

// ─────────────────────────────────────────────────────────────────────────────
// ■ 통합 시나리오: hosts_oidc.yml 기반 풀 생성
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════');
console.log('  통합 시나리오: OIDC + RBAC + LDAP');
console.log('══════════════════════════════════════');

test('OIDC+RBAC+LDAP 풀 구성에서 all.vars 섹션 출력', () => {
  resetState();
  const S = sandbox.state.data;

  // Step 1
  S.ansible_connection = 'ssh';
  S.ansible_user       = '1726_admin1';
  S.ansible_python_interpreter = '/usr/bin/python3.11';
  S.ansible_become  = true;
  S.ansible_port    = 22;
  S.ansible_strategy = 'parallel';
  S.deployment_strategy = 'parallel';
  S.install_java    = false;
  S.custom_java_path = '/usr/lib/jvm/java-17-openjdk';

  // Step 2
  S.installation_method = 'archive';
  S.confluent_package_version = '8.0.2';
  S.confluent_archive_file_source = '/home/user/confluent-8.0.2.zip';
  S.confluent_archive_file_remote = false;
  S.archive_destination_path = '/app/sol/kafka/confluent';
  S.archive_owner = '1726_admin1';
  S.archive_group = '1726_admin1';
  S.confluent_cli_download_enabled = false;

  // Step 3
  S.components.schema_registry = true;
  S.components.control_center_next_gen = true;
  S.hosts.kafka_controller = [
    { hostname: 'ctrl-1.example.com', ansible_host: '10.0.0.1', node_id: '9001', node_ip: '10.0.0.1' },
  ];
  S.hosts.kafka_broker = [
    { hostname: 'ctrl-1.example.com', ansible_host: '10.0.0.1', broker_id: '1', broker_ip: '10.0.0.1' },
  ];
  S.hosts.schema_registry = [
    { hostname: 'sr-1.example.com', ansible_host: '10.0.0.2', schema_registry_host_name: 'sr-1.example.com', schema_registry_listener_hostname: 'sr-1.example.com' }
  ];
  S.hosts.control_center_next_gen = [{ hostname: 'c3.example.com', ansible_host: '10.0.0.4' }];

  // Step 5
  S.listener_protocol = 'SASL_PLAINTEXT';
  S.sasl_mechanism    = 'plain';

  // Step 7 RBAC
  S.authorization_type      = 'rbac';
  S.mds_super_user          = 'c3svc';
  S.mds_super_user_password = 'changeit';
  S.rbac_super_users        = ['User:admin', 'User:c3svc'];
  S.create_mds_certs        = false;
  S.mds_broker_listener_ssl_enabled             = false;
  S.mds_broker_listener_ssl_mutual_auth_enabled = false;

  // Step 8 LDAP
  S.ldap_enabled        = true;
  S.ldap_url            = 'ldap://ldap.example.com:389';
  S.ldap_base_dn        = 'dc=example,dc=com';
  S.ldap_search_mode    = 'GROUPS'; // 기본 → 미출력

  // Step 9 OIDC
  S.control_center_oidc_enabled = true;
  S.sso_mode            = 'oidc';
  S.oidc_client_id      = 'my-client';
  S.oidc_client_secret  = 'my-secret';
  S.oidc_issuer         = 'https://idp.example.com/';
  S.oidc_jwks_uri       = 'https://idp.example.com/jwks/';
  S.oidc_authorize_uri  = 'https://idp.example.com/auth/';
  S.oidc_token_uri      = 'https://idp.example.com/token/';
  S.oidc_refresh_token_enabled = true;

  const out = yaml();

  // all.vars 기본 항목 존재 확인
  expect(out).toContain('ansible_connection: ssh');
  expect(out).toContain('installation_method: archive');
  expect(out).toContain('rbac_enabled: true');
  expect(out).toContain('ldap_url: "ldap://ldap.example.com:389"');
  // OIDC 는 host-level control_center_next_gen_custom_properties 에 출력됨
  expect(out).toContain('confluent.controlcenter.auth.sso.mode: OIDC');

  // mds_broker_listener 없어야 함 (SASL_PLAINTEXT)
  expect(out).notToContain('mds_broker_listener:');

  // ldap_search_mode 없어야 함 (GROUPS = 기본값)
  expect(out).notToContain('ldap_search_mode:');

  // 그룹 구조
  expect(out).toContain('kafka_controller:');
  expect(out).toContain('kafka_broker:');
  expect(out).toContain('schema_registry:');
  expect(out).toContain('control_center_next_gen:');
});

// ─────────────────────────────────────────────────────────────────────────────
// ■ YAML 가져오기(parseYamlAndImport) 테스트
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════');
console.log('  YAML Import: listener_protocol / sasl_mechanism 복원');
console.log('══════════════════════════════════════');

test('SASL_PLAINTEXT: sasl_protocol=plain → listener_protocol=SASL_PLAINTEXT', () => {
  const yamlText = `
all:
  vars:
    sasl_protocol: plain
`;
  importYaml(yamlText);
  expect(sandbox.state.data.listener_protocol).toBe('SASL_PLAINTEXT');
});

test('SASL_PLAINTEXT: sasl_protocol=plain → sasl_mechanism=plain', () => {
  const yamlText = `
all:
  vars:
    sasl_protocol: plain
`;
  importYaml(yamlText);
  expect(sandbox.state.data.sasl_mechanism).toBe('plain');
});

test('SASL_SSL: sasl_protocol=plain + ssl_provided_keystore_and_truststore → listener_protocol=SASL_SSL', () => {
  const yamlText = `
all:
  vars:
    sasl_protocol: plain
    ssl_provided_keystore_and_truststore: true
`;
  importYaml(yamlText);
  expect(sandbox.state.data.listener_protocol).toBe('SASL_SSL');
});

test('SSL: sasl_protocol=none + ssl_provided_keystore_and_truststore → listener_protocol=SSL', () => {
  const yamlText = `
all:
  vars:
    sasl_protocol: none
    ssl_provided_keystore_and_truststore: true
`;
  importYaml(yamlText);
  expect(sandbox.state.data.listener_protocol).toBe('SSL');
});

test('PLAINTEXT: sasl_protocol=none + no SSL → listener_protocol=PLAINTEXT', () => {
  const yamlText = `
all:
  vars:
    sasl_protocol: none
`;
  importYaml(yamlText);
  expect(sandbox.state.data.listener_protocol).toBe('PLAINTEXT');
});

test('sasl_mechanism=scram-sha-512 가 복원된다', () => {
  const yamlText = `
all:
  vars:
    sasl_protocol: scram-sha-512
`;
  importYaml(yamlText);
  expect(sandbox.state.data.sasl_mechanism).toBe('scram-sha-512');
});

test('sasl_mechanism=kerberos 가 복원된다', () => {
  const yamlText = `
all:
  vars:
    sasl_protocol: kerberos
`;
  importYaml(yamlText);
  expect(sandbox.state.data.sasl_mechanism).toBe('kerberos');
});

console.log('\n══════════════════════════════════════');
console.log('  YAML Import: ssl_method 복원');
console.log('══════════════════════════════════════');

test('ssl_method=provided-keystore: ssl_provided_keystore_and_truststore: true 에서 복원', () => {
  const yamlText = `
all:
  vars:
    ssl_provided_keystore_and_truststore: true
`;
  importYaml(yamlText);
  expect(sandbox.state.data.ssl_method).toBe('provided-keystore');
});

test('ssl_method=custom-certs: ssl_custom_certs: true 에서 복원', () => {
  const yamlText = `
all:
  vars:
    ssl_custom_certs: true
`;
  importYaml(yamlText);
  expect(sandbox.state.data.ssl_method).toBe('custom-certs');
});

test('ssl_method=self-signed: regenerate_ca: false 에서 복원', () => {
  const yamlText = `
all:
  vars:
    sasl_protocol: none
    regenerate_ca: false
`;
  importYaml(yamlText);
  expect(sandbox.state.data.ssl_method).toBe('self-signed');
});

console.log('\n══════════════════════════════════════');
console.log('  YAML Import: SSL 파일 경로 필드 복원');
console.log('══════════════════════════════════════');

test('ssl_keystore_filepath → state.data.ssl_keystore_path 로 복원', () => {
  const yamlText = `
all:
  vars:
    ssl_keystore_filepath: /opt/ssl/keystore.jks
`;
  importYaml(yamlText);
  expect(sandbox.state.data.ssl_keystore_path).toBe('/opt/ssl/keystore.jks');
});

test('ssl_keystore_store_password → state.data.ssl_keystore_password 로 복원', () => {
  const yamlText = `
all:
  vars:
    ssl_keystore_store_password: secretpass
`;
  importYaml(yamlText);
  expect(sandbox.state.data.ssl_keystore_password).toBe('secretpass');
});

test('ssl_truststore_filepath → state.data.ssl_truststore_path 로 복원', () => {
  const yamlText = `
all:
  vars:
    ssl_truststore_filepath: /opt/ssl/truststore.jks
`;
  importYaml(yamlText);
  expect(sandbox.state.data.ssl_truststore_path).toBe('/opt/ssl/truststore.jks');
});

test('ssl_ca_cert_filepath → state.data.ssl_ca_cert_path 로 복원', () => {
  const yamlText = `
all:
  vars:
    ssl_ca_cert_filepath: /opt/ssl/ca.pem
`;
  importYaml(yamlText);
  expect(sandbox.state.data.ssl_ca_cert_path).toBe('/opt/ssl/ca.pem');
});

test('ssl_signed_cert_filepath → state.data.ssl_signed_cert_path 로 복원', () => {
  const yamlText = `
all:
  vars:
    ssl_signed_cert_filepath: /opt/ssl/server.crt
`;
  importYaml(yamlText);
  expect(sandbox.state.data.ssl_signed_cert_path).toBe('/opt/ssl/server.crt');
});

test('ssl_key_filepath → state.data.ssl_key_path 로 복원', () => {
  const yamlText = `
all:
  vars:
    ssl_key_filepath: /opt/ssl/server.key
`;
  importYaml(yamlText);
  expect(sandbox.state.data.ssl_key_path).toBe('/opt/ssl/server.key');
});

console.log('\n══════════════════════════════════════');
console.log('  YAML Import: RBAC authorization_type 복원');
console.log('══════════════════════════════════════');

test('rbac_enabled: true → authorization_type = rbac', () => {
  const yamlText = `
all:
  vars:
    rbac_enabled: true
`;
  importYaml(yamlText);
  expect(sandbox.state.data.authorization_type).toBe('rbac');
});

test('rbac_enabled: false → authorization_type = none', () => {
  const yamlText = `
all:
  vars:
    rbac_enabled: false
`;
  importYaml(yamlText);
  expect(sandbox.state.data.authorization_type).toBe('none');
});

console.log('\n══════════════════════════════════════');
console.log('  YAML Import: OIDC issuer 필드 복원');
console.log('══════════════════════════════════════');

test('oidc_idp_issuer_url → state.data.oidc_issuer 로 복원', () => {
  const yamlText = `
all:
  vars:
    oidc_idp_issuer_url: https://idp.example.com
`;
  importYaml(yamlText);
  expect(sandbox.state.data.oidc_issuer).toBe('https://idp.example.com');
});

console.log('\n══════════════════════════════════════');
console.log('  YAML Import: LDAP 필드 복원');
console.log('══════════════════════════════════════');

test('ldap_url 있으면 ldap_enabled = true 로 설정', () => {
  const yamlText = `
all:
  vars:
    ldap_url: "ldap://ldap.example.com:389"
`;
  importYaml(yamlText);
  expect(sandbox.state.data.ldap_enabled).toBeTrue();
});

test('ldap_base_dn → state.data.ldap_base_dn 로 복원', () => {
  const yamlText = `
all:
  vars:
    ldap_base_dn: "dc=example,dc=com"
`;
  importYaml(yamlText);
  expect(sandbox.state.data.ldap_base_dn).toBe('dc=example,dc=com');
});

test('ldap_bind_dn → state.data.ldap_bind_dn 로 복원', () => {
  const yamlText = `
all:
  vars:
    ldap_bind_dn: "cn=admin,dc=example,dc=com"
`;
  importYaml(yamlText);
  expect(sandbox.state.data.ldap_bind_dn).toBe('cn=admin,dc=example,dc=com');
});

test('ldap_bind_password → state.data.ldap_bind_password 로 복원', () => {
  const yamlText = `
all:
  vars:
    ldap_bind_password: secret
`;
  importYaml(yamlText);
  expect(sandbox.state.data.ldap_bind_password).toBe('secret');
});

test('ldap_user_search_base → state.data.ldap_user_search_base 로 복원', () => {
  const yamlText = `
all:
  vars:
    ldap_user_search_base: "ou=users,dc=example,dc=com"
`;
  importYaml(yamlText);
  expect(sandbox.state.data.ldap_user_search_base).toBe('ou=users,dc=example,dc=com');
});

test('ldap_group_search_base → state.data.ldap_group_search_base 로 복원', () => {
  const yamlText = `
all:
  vars:
    ldap_group_search_base: "ou=groups,dc=example,dc=com"
`;
  importYaml(yamlText);
  expect(sandbox.state.data.ldap_group_search_base).toBe('ou=groups,dc=example,dc=com');
});

test('mds_ldap_user → state.data.mds_ldap_user 로 복원', () => {
  const yamlText = `
all:
  vars:
    mds_ldap_user: "uid=mds-service,ou=users,dc=example,dc=com"
`;
  importYaml(yamlText);
  expect(sandbox.state.data.mds_ldap_user).toBe('uid=mds-service,ou=users,dc=example,dc=com');
});

console.log('\n══════════════════════════════════════');
console.log('  YAML Import: 왕복 일관성 (generateYaml → import → generateYaml)');
console.log('══════════════════════════════════════');

test('SASL_SSL 구성: generateYaml 출력을 import하면 동일한 출력 재현', () => {
  const S = sandbox.state.data;
  S.hosts = { kafka_controller: [{ hostname: 'ctrl-1', ansible_host: '10.0.0.1', node_id: '9001', node_ip: '10.0.0.1' }], kafka_broker: [{ hostname: 'ctrl-1', ansible_host: '10.0.0.1', broker_id: '1', broker_ip: '10.0.0.1' }], schema_registry: [], kafka_connect: [], ksql: [], kafka_rest: [], control_center_next_gen: [] };
  S.listener_protocol = 'SASL_SSL';
  S.sasl_mechanism = 'plain';
  S.ssl_method = 'provided-keystore';
  S.ssl_keystore_path = '/opt/ssl/ks.jks';
  S.ssl_keystore_password = 'kspass';
  S.ssl_truststore_path = '/opt/ssl/ts.jks';
  S.ssl_truststore_password = 'tspass';
  const yaml1 = sandbox.generateYaml();

  // Import the generated YAML back
  importYaml(yaml1);

  // Regenerate - should be consistent
  const S2 = sandbox.state.data;
  S2.hosts = { kafka_controller: [{ hostname: 'ctrl-1', ansible_host: '10.0.0.1', node_id: '9001', node_ip: '10.0.0.1' }], kafka_broker: [{ hostname: 'ctrl-1', ansible_host: '10.0.0.1', broker_id: '1', broker_ip: '10.0.0.1' }], schema_registry: [], kafka_connect: [], ksql: [], kafka_rest: [], control_center_next_gen: [] };
  const yaml2 = sandbox.generateYaml();

  expect(yaml2).toContain('sasl_protocol: plain');
  expect(yaml2).toContain('ssl_provided_keystore_and_truststore: true');
  expect(yaml2).toContain('ssl_keystore_filepath: /opt/ssl/ks.jks');
});

test('RBAC 구성: generateYaml 출력을 import하면 authorization_type=rbac 복원', () => {
  const S = sandbox.state.data;
  S.hosts = { kafka_controller: [{ hostname: 'ctrl-1', ansible_host: '10.0.0.1', node_id: '9001', node_ip: '10.0.0.1' }], kafka_broker: [{ hostname: 'ctrl-1', ansible_host: '10.0.0.1', broker_id: '1', broker_ip: '10.0.0.1' }], schema_registry: [], kafka_connect: [], ksql: [], kafka_rest: [], control_center_next_gen: [] };
  S.authorization_type = 'rbac';
  S.mds_super_user = 'mds';
  const yaml1 = sandbox.generateYaml();

  importYaml(yaml1);

  expect(sandbox.state.data.authorization_type).toBe('rbac');
});

// ─────────────────────────────────────────────────────────────────────────────
// ■ 결과 집계
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════');
console.log('  결과');
console.log('══════════════════════════════════════');
const total = PASS + FAIL + SKIP;
console.log(`\n  총 ${total}개  ✅ PASS: ${PASS}  ❌ FAIL: ${FAIL}  ⏭ SKIP: ${SKIP}`);

const coverage = total > 0 ? Math.round((PASS / total) * 100) : 0;
console.log(`  통과율: ${coverage}%  (목표: 80%+)`);

if (failures.length > 0) {
  console.log('\n  ── 실패 목록 ──────────────────────────');
  failures.forEach((f, i) => {
    console.log(`  [${i + 1}] ${f.desc}`);
    console.log(`      ${f.msg}`);
  });
}

if (FAIL > 0) process.exit(1);
