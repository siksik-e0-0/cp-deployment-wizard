/**
 * test_roundtrip.js
 * hosts.yml.old → import → generateYaml() 왕복 검증 테스트
 *
 * TDD: RED → GREEN → REFACTOR
 * 실행: node test_roundtrip.js
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const vm     = require('vm');
const jsyaml = require('js-yaml');

// ─── 샌드박스 설정 (test_steps.js와 동일한 패턴) ────────────────────────────

const HTML_PATH = path.join(__dirname, 'hosts_generator.html');
const html      = fs.readFileSync(HTML_PATH, 'utf8');
const htmlLines = html.split('\n');
const rawBlock  = htmlLines.slice(717).join('\n');
let js          = rawBlock.slice(rawBlock.indexOf('<script>') + 8, rawBlock.lastIndexOf('</script>'));
js = js.replace(/^\s*const state\s*=/m, 'var state =');
js = js.replace(/^\s*const steps\s*=/m, 'var steps =');
js += '\ntry { this.state = state; this.generateYaml = generateYaml; this.parseYamlAndImport = parseYamlAndImport; } catch(e) {}';

function mkEl() {
    const el = {
        textContent: '', innerHTML: '', value: '', checked: false,
        className: '', id: '', type: '', name: '', placeholder: '',
        classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => {} },
        style: {}, children: [], parentNode: null,
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

/** 독립적인 샌드박스 컨텍스트 객체 생성 (그룹 레벨 테스트용) */
function createSandboxContext() {
    return {
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
}

const sandbox = vm.createContext(createSandboxContext());
new vm.Script(js).runInContext(sandbox);

// ─── 유틸리티 ────────────────────────────────────────────────────────────────

let PASS = 0, FAIL = 0;
const failures = [];

function test(desc, fn) {
    try {
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
            if (!String(actual).includes(String(str)))
                throw new Error(`포함되지 않음:\n  기대: ${JSON.stringify(str)}\n  실제(앞 400자): ${String(actual).slice(0, 400)}`);
        },
        notToContain(str) {
            if (String(actual).includes(String(str)))
                throw new Error(`포함되면 안 됨:\n  패턴: ${JSON.stringify(str)}`);
        },
        toBe(expected) {
            if (actual !== expected)
                throw new Error(`값 불일치:\n  기대: ${JSON.stringify(expected)}\n  실제: ${JSON.stringify(actual)}`);
        },
        toBeTrue() {
            if (actual !== true) throw new Error(`true가 아님: ${JSON.stringify(actual)}`);
        },
        toEqual(expected) {
            const a = JSON.stringify(actual), b = JSON.stringify(expected);
            if (a !== b) throw new Error(`객체 불일치:\n  기대: ${b}\n  실제: ${a}`);
        },
    };
}

/** YAML 텍스트에서 key→value 플랫 맵 생성 (의미 비교용) */
function flattenKeys(obj, prefix = '') {
    const out = {};
    if (obj === null || typeof obj !== 'object') {
        out[prefix] = obj;
        return out;
    }
    if (Array.isArray(obj)) {
        obj.forEach((v, i) => Object.assign(out, flattenKeys(v, `${prefix}[${i}]`)));
        return out;
    }
    for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k;
        Object.assign(out, flattenKeys(v, key));
    }
    return out;
}

// ─── 대상 파일 읽기 ──────────────────────────────────────────────────────────

const OLD_PATH = path.join(__dirname, 'hosts.yml');
const GEN_PATH = path.join(__dirname, 'analysis', 'hosts.yml.generated');

const oldYaml = fs.readFileSync(OLD_PATH, 'utf8');
// jsyaml는 첫 줄의 ## 주석을 무시하고 파싱함
const oldParsed = jsyaml.load(oldYaml);

// Import → Generate 1회 실행
sandbox.parseYamlAndImport(oldYaml);
const generatedYaml = sandbox.generateYaml();

// 생성된 YAML 저장
fs.writeFileSync(GEN_PATH, generatedYaml, 'utf8');
console.log(`\n📄 생성된 YAML 저장: ${GEN_PATH}\n`);

const genParsed = jsyaml.load(generatedYaml);

// ─── 테스트 ──────────────────────────────────────────────────────────────────

console.log('══════════════════════════════════════');
console.log('  Step 1: 기본 환경 (all.vars)');
console.log('══════════════════════════════════════');

test('ansible_user: 1726_admin1 → 복원', () => {
    expect(generatedYaml).toContain('ansible_user: 1726_admin1');
});

test('ansible_python_interpreter: /usr/bin/python3.11 → 복원', () => {
    expect(generatedYaml).toContain('ansible_python_interpreter: /usr/bin/python3.11');
});

test('deployment_strategy: parallel → 복원', () => {
    expect(generatedYaml).toContain('deployment_strategy: parallel');
});

test('ansible_strategy: parallel → 복원', () => {
    expect(generatedYaml).toContain('ansible_strategy: parallel');
});

console.log('\n══════════════════════════════════════');
console.log('  Step 2: 설치 방식 (archive)');
console.log('══════════════════════════════════════');

test('installation_method: archive → 복원', () => {
    expect(generatedYaml).toContain('installation_method: archive');
});

test('confluent_package_version: "8.1.2" → 복원', () => {
    expect(generatedYaml).toContain('confluent_package_version: "8.1.2"');
});

test('confluent_control_center_next_gen_package_version: "2.5.0" → 복원', () => {
    expect(generatedYaml).toContain('confluent_control_center_next_gen_package_version: "2.5.0"');
});

test('confluent_cli_download_enabled: false → 복원', () => {
    expect(generatedYaml).toContain('confluent_cli_download_enabled: false');
});

test('archive_destination_path: /app/sol/kafka/confluent → 복원', () => {
    expect(generatedYaml).toContain('archive_destination_path: /app/sol/kafka/confluent');
});

test('archive_owner: 1726_admin1 → 복원', () => {
    expect(generatedYaml).toContain('archive_owner: 1726_admin1');
});

test('archive_group: 1726_admin1 → 복원', () => {
    expect(generatedYaml).toContain('archive_group: 1726_admin1');
});

test('confluent_archive_file_source 경로 → 복원', () => {
    expect(generatedYaml).toContain('confluent_archive_file_source:');
    expect(generatedYaml).toContain('confluent-8.1.2.zip');
});

test('confluent_archive_control_center_next_gen_file_source 경로 → 복원', () => {
    expect(generatedYaml).toContain('confluent_archive_control_center_next_gen_file_source:');
    expect(generatedYaml).toContain('confluent-control-center-next-gen-2.5.0.tar.gz');
});

test('install_java: false → 복원', () => {
    expect(generatedYaml).toContain('install_java: false');
});

test('custom_java_path: /usr/lib/jvm/java-17-openjdk → 복원', () => {
    expect(generatedYaml).toContain('custom_java_path: /usr/lib/jvm/java-17-openjdk');
});

console.log('\n══════════════════════════════════════');
console.log('  Step 3: 호스트 구성');
console.log('══════════════════════════════════════');

test('kafka_controller 그룹 — 3개 호스트 복원', () => {
    const ctrlHosts = (genParsed.kafka_controller || {}).hosts || {};
    const count = Object.keys(ctrlHosts).length;
    if (count !== 3) throw new Error(`kafka_controller 호스트 수: 기대 3, 실제 ${count}`);
});

test('kafka_controller kiju-cp-test-1 node_id: 9991 → 복원', () => {
    const hosts = (genParsed.kafka_controller || {}).hosts || {};
    const h = hosts['kiju-cp-test-1.fgcp-integration.com'];
    if (!h) throw new Error('kiju-cp-test-1 컨트롤러 호스트가 없음');
    if (Number(h.node_id) !== 9991) throw new Error(`node_id 불일치: ${h.node_id}`);
});

test('kafka_controller kiju-cp-test-1 node_ip: 192.168.20.246 → 복원', () => {
    const hosts = (genParsed.kafka_controller || {}).hosts || {};
    const h = hosts['kiju-cp-test-1.fgcp-integration.com'];
    if (!h) throw new Error('kiju-cp-test-1 컨트롤러 호스트가 없음');
    if (h.node_ip !== '192.168.20.246') throw new Error(`node_ip 불일치: ${h.node_ip}`);
});

test('kafka_controller kiju-cp-test-2 node_ip: 192.168.20.247 → 복원', () => {
    const hosts = (genParsed.kafka_controller || {}).hosts || {};
    const h = hosts['kiju-cp-test-2.fgcp-integration.com'];
    if (!h) throw new Error('kiju-cp-test-2 컨트롤러 호스트가 없음');
    if (h.node_ip !== '192.168.20.247') throw new Error(`node_ip 불일치: ${h.node_ip}`);
});

test('kafka_controller kiju-cp-test-3 node_ip: 192.168.20.248 → 복원', () => {
    const hosts = (genParsed.kafka_controller || {}).hosts || {};
    const h = hosts['kiju-cp-test-3.fgcp-integration.com'];
    if (!h) throw new Error('kiju-cp-test-3 컨트롤러 호스트가 없음');
    if (h.node_ip !== '192.168.20.248') throw new Error(`node_ip 불일치: ${h.node_ip}`);
});

test('kafka_broker 그룹 — 3개 호스트 복원', () => {
    const brokerHosts = (genParsed.kafka_broker || {}).hosts || {};
    const count = Object.keys(brokerHosts).length;
    if (count !== 3) throw new Error(`kafka_broker 호스트 수: 기대 3, 실제 ${count}`);
});

test('kafka_broker kiju-cp-test-2 broker_id: 2 → 복원', () => {
    const hosts = (genParsed.kafka_broker || {}).hosts || {};
    const h = hosts['kiju-cp-test-2.fgcp-integration.com'];
    if (!h) throw new Error('kiju-cp-test-2 브로커 호스트가 없음');
    if (Number(h.broker_id) !== 2) throw new Error(`broker_id 불일치: ${h.broker_id}`);
});

test('kafka_broker kiju-cp-test-1 broker_ip: 192.168.20.246 → 복원', () => {
    const hosts = (genParsed.kafka_broker || {}).hosts || {};
    const h = hosts['kiju-cp-test-1.fgcp-integration.com'];
    if (!h) throw new Error('kiju-cp-test-1 브로커 호스트가 없음');
    if (h.broker_ip !== '192.168.20.246') throw new Error(`broker_ip 불일치: ${h.broker_ip}`);
});

test('kafka_broker kiju-cp-test-2 broker_ip: 192.168.20.247 → 복원', () => {
    const hosts = (genParsed.kafka_broker || {}).hosts || {};
    const h = hosts['kiju-cp-test-2.fgcp-integration.com'];
    if (!h) throw new Error('kiju-cp-test-2 브로커 호스트가 없음');
    if (h.broker_ip !== '192.168.20.247') throw new Error(`broker_ip 불일치: ${h.broker_ip}`);
});

test('kafka_broker kiju-cp-test-3 broker_ip: 192.168.20.248 → 복원', () => {
    const hosts = (genParsed.kafka_broker || {}).hosts || {};
    const h = hosts['kiju-cp-test-3.fgcp-integration.com'];
    if (!h) throw new Error('kiju-cp-test-3 브로커 호스트가 없음');
    if (h.broker_ip !== '192.168.20.248') throw new Error(`broker_ip 불일치: ${h.broker_ip}`);
});

test('schema_registry 그룹 — 2개 호스트 복원', () => {
    const srHosts = (genParsed.schema_registry || {}).hosts || {};
    const count = Object.keys(srHosts).length;
    if (count !== 2) throw new Error(`schema_registry 호스트 수: 기대 2, 실제 ${count}`);
});

test('control_center_next_gen 그룹 — 1개 호스트 복원', () => {
    const c3Hosts = (genParsed.control_center_next_gen || {}).hosts || {};
    const count = Object.keys(c3Hosts).length;
    if (count !== 1) throw new Error(`control_center_next_gen 호스트 수: 기대 1, 실제 ${count}`);
});

console.log('\n══════════════════════════════════════');
console.log('  Step 4: OS 사용자/그룹 & 로그 디렉토리');
console.log('══════════════════════════════════════');

test('kafka_controller_log_dir → 복원', () => {
    expect(generatedYaml).toContain('kafka_controller_log_dir: /log/sol/kafka/confluent/controller');
});

test('kafka_broker_log_dir → 복원', () => {
    expect(generatedYaml).toContain('kafka_broker_log_dir: /log/sol/kafka/confluent/broker');
});

test('control_center_next_gen_log_dir → 복원', () => {
    expect(generatedYaml).toContain('control_center_next_gen_log_dir: /log/sol/kafka/confluent/c3');
});

test('schema_registry_log_dir → 복원', () => {
    expect(generatedYaml).toContain('schema_registry_log_dir: /log/sol/kafka/confluent/schema-registry');
});

console.log('\n══════════════════════════════════════');
console.log('  Step 5: SASL / 보안 프로토콜');
console.log('══════════════════════════════════════');

test('sasl_protocol: plain → 복원 (SASL_PLAINTEXT)', () => {
    expect(generatedYaml).toContain('sasl_protocol: plain');
});

test('sasl_plain_users admin 항목 → 복원', () => {
    expect(generatedYaml).toContain('admin:');
    expect(generatedYaml).toContain('admin-secret');
});

console.log('\n══════════════════════════════════════');
console.log('  Step 7: RBAC / MDS');
console.log('══════════════════════════════════════');

test('rbac_enabled: true → 복원', () => {
    expect(generatedYaml).toContain('rbac_enabled: true');
});

test('mds_super_user: akadmin → 복원', () => {
    expect(generatedYaml).toContain('mds_super_user: akadmin');
});

test('mds_super_user_password: changeit → 복원', () => {
    expect(generatedYaml).toContain('mds_super_user_password: changeit');
});

test('rbac_super_users: ["User:akadmin"] → 복원', () => {
    expect(generatedYaml).toContain('User:akadmin');
});

test('token_services_public_pem_file → 복원', () => {
    expect(generatedYaml).toContain('token_services_public_pem_file:');
    expect(generatedYaml).toContain('public.pem');
});

test('token_services_private_pem_file → 복원', () => {
    expect(generatedYaml).toContain('token_services_private_pem_file:');
    expect(generatedYaml).toContain('tokenKeypair.pem');
});

test('mds_ldap_user → 복원 (DN 포함)', () => {
    expect(generatedYaml).toContain('mds_ldap_user:');
    expect(generatedYaml).toContain('cn=akadmin');
});

test('mds_ldap_password: changeit → 복원', () => {
    expect(generatedYaml).toContain('mds_ldap_password: changeit');
});

console.log('\n══════════════════════════════════════');
console.log('  Step 8: LDAP 설정');
console.log('══════════════════════════════════════');

test('ldap_url → 복원', () => {
    expect(generatedYaml).toContain('ldap_url:');
    expect(generatedYaml).toContain('kiju-cp-test-4.fgcp-integration.com:389');
});

test('ldap_base_dn → 복원', () => {
    expect(generatedYaml).toContain('ldap_base_dn:');
    expect(generatedYaml).toContain('dc=ldap,dc=goauthentik,dc=io');
});

test('ldap_user_search_base → 복원', () => {
    expect(generatedYaml).toContain('ldap_user_search_base:');
    expect(generatedYaml).toContain('ou=users');
});

test('ldap_group_search_base → 복원', () => {
    expect(generatedYaml).toContain('ldap_group_search_base:');
    expect(generatedYaml).toContain('ou=groups');
});

console.log('\n══════════════════════════════════════');
console.log('  Step 11: Schema Registry');
console.log('══════════════════════════════════════');

test('sr_service_user: srsvc → 복원', () => {
    expect(generatedYaml).toContain('sr_service_user: srsvc');
});

test('sr_service_password: changeit → 복원', () => {
    // 생성된 YAML은 비밀번호를 따옴표로 감쌈: `"changeit"`
    expect(generatedYaml).toContain('sr_service_password: "changeit"');
});

test('schema_registry_listener_port: 9081 → 복원', () => {
    expect(generatedYaml).toContain('schema_registry_listener_port: 9081');
});

test('schema_registry_config_prefix → 복원', () => {
    expect(generatedYaml).toContain('schema_registry_config_prefix:');
    expect(generatedYaml).toContain('/etc/schema-registry');
});

console.log('\n══════════════════════════════════════');
console.log('  Step 12: Control Center');
console.log('══════════════════════════════════════');

test('c3_service_user: c3svc → 복원', () => {
    expect(generatedYaml).toContain('c3_service_user: c3svc');
});

test('c3_service_password: changeit → 복원', () => {
    // 생성된 YAML은 비밀번호를 따옴표로 감쌈: `"changeit"`
    expect(generatedYaml).toContain('c3_service_password: "changeit"');
});

test('control_center_next_gen_authentication_type: ldap → 복원', () => {
    expect(generatedYaml).toContain('control_center_next_gen_authentication_type: ldap');
});

test('control_center_next_gen_data_dir → 복원', () => {
    expect(generatedYaml).toContain('control_center_next_gen_data_dir: /data01/sol/kafka/confluent/c3');
});

test('ssl_file_dir → 복원', () => {
    expect(generatedYaml).toContain('ssl_file_dir: /app/sol/kafka/confluent/etc/ssl');
});

test('ssl_enabled: true → 복원', () => {
    expect(generatedYaml).toContain('ssl_enabled: true');
});

test('ssl_keystore_and_truststore_custom_password: true → 복원', () => {
    expect(generatedYaml).toContain('ssl_keystore_and_truststore_custom_password: true');
});

test('ssl_client_authentication: required → 복원', () => {
    expect(generatedYaml).toContain('ssl_client_authentication: required');
});

console.log('\n══════════════════════════════════════');
console.log('  Step 5: Per-component 스토어패스');
console.log('══════════════════════════════════════');

test('kafka_controller_keystore_storepass: changeit → 복원', () => {
    expect(generatedYaml).toContain('kafka_controller_keystore_storepass: changeit');
});
test('kafka_controller_keystore_keypass: changeit → 복원', () => {
    expect(generatedYaml).toContain('kafka_controller_keystore_keypass: changeit');
});
test('kafka_controller_truststore_storepass: changeit → 복원', () => {
    expect(generatedYaml).toContain('kafka_controller_truststore_storepass: changeit');
});
test('kafka_broker_keystore_storepass: changeit → 복원', () => {
    expect(generatedYaml).toContain('kafka_broker_keystore_storepass: changeit');
});
test('kafka_broker_keystore_keypass: changeit → 복원', () => {
    expect(generatedYaml).toContain('kafka_broker_keystore_keypass: changeit');
});
test('kafka_broker_truststore_storepass: changeit → 복원', () => {
    expect(generatedYaml).toContain('kafka_broker_truststore_storepass: changeit');
});
test('schema_registry_keystore_storepass: changeit → 복원', () => {
    expect(generatedYaml).toContain('schema_registry_keystore_storepass: changeit');
});
test('schema_registry_keystore_keypass: changeit → 복원', () => {
    expect(generatedYaml).toContain('schema_registry_keystore_keypass: changeit');
});
test('schema_registry_truststore_storepass: changeit → 복원', () => {
    expect(generatedYaml).toContain('schema_registry_truststore_storepass: changeit');
});
test('control_center_next_gen_keystore_storepass: changeit → 복원', () => {
    expect(generatedYaml).toContain('control_center_next_gen_keystore_storepass: changeit');
});
test('control_center_next_gen_keystore_keypass: changeit → 복원', () => {
    expect(generatedYaml).toContain('control_center_next_gen_keystore_keypass: changeit');
});
test('control_center_next_gen_truststore_storepass: changeit → 복원', () => {
    expect(generatedYaml).toContain('control_center_next_gen_truststore_storepass: changeit');
});

console.log('\n══════════════════════════════════════');
console.log('  Listener name refs');
console.log('══════════════════════════════════════');

test('kafka_broker_inter_broker_listener_name: internal → 복원', () => {
    expect(generatedYaml).toContain('kafka_broker_inter_broker_listener_name: internal');
});
test('kafka_broker_rest_proxy_listener_name: internal_token → 복원', () => {
    expect(generatedYaml).toContain('kafka_broker_rest_proxy_listener_name: internal_token');
});
test('schema_registry_kafka_listener_name: internal_token → 복원', () => {
    expect(generatedYaml).toContain('schema_registry_kafka_listener_name: internal_token');
});
test('control_center_next_gen_kafka_listener_name: internal_token → 복원', () => {
    expect(generatedYaml).toContain('control_center_next_gen_kafka_listener_name: internal_token');
});

console.log('\n══════════════════════════════════════');
console.log('  C3 추가 설정 / LDAP 직접 값 / Metrics');
console.log('══════════════════════════════════════');

test('control_center_next_gen_mds_cert_auth_only: false → 복원', () => {
    expect(generatedYaml).toContain('control_center_next_gen_mds_cert_auth_only: false');
});
test('control_center_next_gen_ldap_user: c3svc → all.vars 복원', () => {
    expect(generatedYaml).toContain('control_center_next_gen_ldap_user: c3svc');
});
test('control_center_next_gen_ldap_password: changeit → all.vars 복원', () => {
    expect(generatedYaml).toContain('control_center_next_gen_ldap_password: changeit');
});
test('schema_registry_ldap_user: srsvc → all.vars 복원', () => {
    expect(generatedYaml).toContain('schema_registry_ldap_user: srsvc');
});
test('schema_registry_ldap_password: changeit → all.vars 복원', () => {
    expect(generatedYaml).toContain('schema_registry_ldap_password: changeit');
});
test('kafka_controller_metrics_reporter_enabled: false → 복원', () => {
    expect(generatedYaml).toContain('kafka_controller_metrics_reporter_enabled: false');
});
test('kafka_broker_metrics_reporter_enabled: false → 복원', () => {
    expect(generatedYaml).toContain('kafka_broker_metrics_reporter_enabled: false');
});
test('C3 all.vars custom_properties: confluent.controlcenter.id: 3 → 복원', () => {
    expect(generatedYaml).toContain('confluent.controlcenter.id: 3');
});
test('C3 host node_ip: 192.168.20.249 → 복원', () => {
    expect(generatedYaml).toContain('node_ip: 192.168.20.249');
});

console.log('\n══════════════════════════════════════');
console.log('  Step 10: Custom Properties import 검증');
console.log('══════════════════════════════════════');

// ── kafka_broker_custom_properties ──────────────────────────────────────
test('kafka_broker_custom_properties 섹션 존재', () => {
    expect(generatedYaml).toContain('kafka_broker_custom_properties:');
});

test('kafka_broker_custom_properties: confluent.telemetry.metrics.collector.interval.ms → 복원', () => {
    expect(generatedYaml).toContain('confluent.telemetry.metrics.collector.interval.ms: 60000');
});

test('kafka_broker_custom_properties: num.network.threads: 16 → 복원', () => {
    expect(generatedYaml).toContain('num.network.threads: 16');
});

test('kafka_broker_custom_properties: default.replication.factor: 3 → 복원', () => {
    expect(generatedYaml).toContain('default.replication.factor: 3');
});

test('kafka_broker_custom_properties: min.insync.replicas: 2 → 복원', () => {
    expect(generatedYaml).toContain('min.insync.replicas: 2');
});

test('kafka_broker_custom_properties: confluent.balancer.enable → "true" 쌍따옴표 필수', () => {
    expect(generatedYaml).toContain('confluent.balancer.enable: "true"');
});

test('kafka_broker_custom_properties: confluent.balancer.heal.uneven.load.trigger → "EMPTY_BROKER" 쌍따옴표 필수', () => {
    expect(generatedYaml).toContain('confluent.balancer.heal.uneven.load.trigger: "EMPTY_BROKER"');
});

// log.dirs는 state.data.kafka_broker_log_dirs로 추출되어 같은 값이 출력되어야 함
test('kafka_broker_log_dirs → state에서 import 후 복원', () => {
    const imported = sandbox.state.data.kafka_broker_log_dirs;
    if (!imported || !imported.includes('/data01/sol/kafka/confluent/broker')) {
        throw new Error(`kafka_broker_log_dirs 미복원: "${imported}"`);
    }
});

// ── kafka_controller_custom_properties ──────────────────────────────────
test('kafka_controller_custom_properties 섹션 존재', () => {
    expect(generatedYaml).toContain('kafka_controller_custom_properties:');
});

test('kafka_controller_custom_properties: metric.reporters → 복원', () => {
    expect(generatedYaml).toContain('metric.reporters: io.confluent.telemetry.reporter.TelemetryReporter');
});

test('kafka_controller_custom_properties: confluent.metadata.security.protocol → 복원', () => {
    expect(generatedYaml).toContain('confluent.metadata.security.protocol: SASL_SSL');
});

test('kafka_controller_custom_properties: confluent.metadata.sasl.mechanism → 복원', () => {
    expect(generatedYaml).toContain('confluent.metadata.sasl.mechanism: PLAIN');
});

test('kafka_controller_custom_properties: num.network.threads: 3 → 복원', () => {
    expect(generatedYaml).toContain('num.network.threads: 3');
});

// log.dirs는 state.data.kafka_controller_log_dirs로 추출되어야 함
test('kafka_controller_log_dirs → state에서 import 후 복원', () => {
    const imported = sandbox.state.data.kafka_controller_log_dirs;
    if (!imported || !imported.includes('/data01/sol/kafka/confluent/controller')) {
        throw new Error(`kafka_controller_log_dirs 미복원: "${imported}"`);
    }
});

// 그룹 레벨(kafka_controller.vars) custom_properties import 검증
// 별도 YAML 조각으로 테스트
test('kafka_controller.vars 레벨 kafka_controller_custom_properties import', () => {
    const sandbox2 = vm.createContext(createSandboxContext());
    const s2 = new vm.Script(js);
    s2.runInContext(sandbox2);
    const groupLevelYaml = `
all:
  vars:
    ansible_user: test
kafka_controller:
  vars:
    kafka_controller_custom_properties:
      my.controller.prop: value123
  hosts:
    controller-1.example.com:
      node_id: 1
kafka_broker:
  hosts:
    broker-1.example.com:
      broker_id: 1
`.trim();
    sandbox2.parseYamlAndImport(groupLevelYaml);
    const g2 = sandbox2.generateYaml();
    if (!g2.includes('my.controller.prop: value123')) {
        throw new Error(`kafka_controller.vars 레벨 custom_properties 미반영\n생성:\n${g2.slice(0,600)}`);
    }
});

test('kafka_broker.vars 레벨 kafka_broker_custom_properties import', () => {
    const sandbox3 = vm.createContext(createSandboxContext());
    const s3 = new vm.Script(js);
    s3.runInContext(sandbox3);
    const groupLevelYaml = `
all:
  vars:
    ansible_user: test
kafka_broker:
  vars:
    kafka_broker_custom_properties:
      my.broker.prop: value456
  hosts:
    broker-1.example.com:
      broker_id: 1
kafka_controller:
  hosts:
    controller-1.example.com:
      node_id: 1
`.trim();
    sandbox3.parseYamlAndImport(groupLevelYaml);
    const g3 = sandbox3.generateYaml();
    if (!g3.includes('my.broker.prop: value456')) {
        throw new Error(`kafka_broker.vars 레벨 custom_properties 미반영\n생성:\n${g3.slice(0,600)}`);
    }
});

console.log('\n══════════════════════════════════════');
console.log('  Step 13: JMX Exporter');
console.log('══════════════════════════════════════');

test('jmxexporter_jar_url → 복원', () => {
    expect(generatedYaml).toContain('jmxexporter_jar_url:');
    expect(generatedYaml).toContain('jmx_prometheus_javaagent-0.20.0.jar');
});

test('jmxexporter_jar_path → 복원', () => {
    expect(generatedYaml).toContain('jmxexporter_jar_path:');
    expect(generatedYaml).toContain('/app/sol/kafka/confluent/etc/jmx_prometheus_javaagent-0.20.0.jar');
});

test('kafka_controller_jmxexporter_port: 9995 → 복원', () => {
    expect(generatedYaml).toContain('kafka_controller_jmxexporter_port: 9995');
});

test('kafka_broker_jmxexporter_port: 9999 → 복원', () => {
    expect(generatedYaml).toContain('kafka_broker_jmxexporter_port: 9999');
});

console.log('\n══════════════════════════════════════');
console.log('  Step 14: 고급 설정');
console.log('══════════════════════════════════════');

test('confluent_license: "" → 항상 출력 (cp-ansible 필수)', () => {
    expect(generatedYaml).toContain('confluent_license: ""');
});


console.log('\n══════════════════════════════════════');
console.log('  Prometheus / Alertmanager 설정');
console.log('══════════════════════════════════════');

test('Prometheus 포트 9090 → 복원', () => {
    expect(generatedYaml).toContain('9090');
});

test('Alertmanager 포트 9098 → 복원', () => {
    expect(generatedYaml).toContain('9098');
});

// ─── 의미론적 diff 분석 ──────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════');
console.log('  🔬 시맨틱 Diff: hosts.yml ↔ hosts.yml.generated');
console.log('══════════════════════════════════════\n');

const oldFlat = flattenKeys(oldParsed);
const genFlat = flattenKeys(genParsed);

// OLD에는 있으나 GENERATED에 없는 키 (회색 주석 제외)
const missingInGen = Object.keys(oldFlat).filter(k => !(k in genFlat));
// GENERATED에는 있으나 OLD에 없는 키
const extraInGen   = Object.keys(genFlat).filter(k => !(k in oldFlat));
// 값이 다른 키
const diffValues   = Object.keys(oldFlat).filter(k => k in genFlat && String(oldFlat[k]) !== String(genFlat[k]));

if (missingInGen.length === 0) {
    console.log('  ✅ OLD 키 누락 없음');
} else {
    console.log(`  ⚠️  OLD에만 있는 키 (${missingInGen.length}개) — GENERATED에서 누락:`);
    missingInGen.forEach(k => console.log(`     - ${k}: ${JSON.stringify(oldFlat[k])}`));
}

if (extraInGen.length === 0) {
    console.log('  ✅ GENERATED 추가 키 없음');
} else {
    console.log(`\n  📎 GENERATED에만 있는 키 (${extraInGen.length}개) — 새로 추가됨:`);
    extraInGen.forEach(k => console.log(`     + ${k}: ${JSON.stringify(genFlat[k])}`));
}

if (diffValues.length === 0) {
    console.log('  ✅ 공통 키의 값 차이 없음');
} else {
    console.log(`\n  🔄 값이 변경된 키 (${diffValues.length}개):`);
    diffValues.forEach(k => console.log(`     ~ ${k}\n       OLD: ${JSON.stringify(oldFlat[k])}\n       GEN: ${JSON.stringify(genFlat[k])}`));
}

// ─── 결과 집계 ────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════');
console.log('  결과');
console.log('══════════════════════════════════════');
const total = PASS + FAIL;
console.log(`\n  총 ${total}개  ✅ PASS: ${PASS}  ❌ FAIL: ${FAIL}`);
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
