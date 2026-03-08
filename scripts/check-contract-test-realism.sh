#!/usr/bin/env bash
set -euo pipefail

MODE="advisory"
REPORT_MD=""
REPORT_JSON=""
ALLOWLIST_PATH="packages/contracts/test/audit/mock-allowlist.json"

usage() {
    cat <<'USAGE'
Usage: scripts/check-contract-test-realism.sh [options]

Options:
  --mode advisory|enforce-must-fix|enforce-should-fix
  --report-md <path>
  --report-json <path>
  --allowlist <path>
  -h, --help
USAGE
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --mode)
            MODE="${2:-}"
            shift 2
            ;;
        --report-md)
            REPORT_MD="${2:-}"
            shift 2
            ;;
        --report-json)
            REPORT_JSON="${2:-}"
            shift 2
            ;;
        --allowlist)
            ALLOWLIST_PATH="${2:-}"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown argument: $1" >&2
            usage
            exit 2
            ;;
    esac
done

case "$MODE" in
    advisory|enforce-must-fix|enforce-should-fix)
        ;;
    *)
        echo "Invalid --mode: $MODE" >&2
        usage
        exit 2
        ;;
esac

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPORT_MD="${REPORT_MD:-$ROOT_DIR/output/contracts-test-audit/realism-report.md}"
REPORT_JSON="${REPORT_JSON:-$ROOT_DIR/output/contracts-test-audit/realism-report.json}"

mkdir -p "$(dirname "$REPORT_MD")" "$(dirname "$REPORT_JSON")"

<<<<<<< HEAD
# Resolve the worker script relative to this script's directory
WORKER_SCRIPT="$(cd "$(dirname "$0")" && pwd)/check-contract-test-realism-worker.js"

MODE="$MODE" \
ROOT_DIR="$ROOT_DIR" \
REPORT_MD="$REPORT_MD" \
REPORT_JSON="$REPORT_JSON" \
ALLOWLIST_PATH="$ALLOWLIST_PATH" \
node "$WORKER_SCRIPT"
=======
MODE="$MODE" ROOT_DIR="$ROOT_DIR" REPORT_MD="$REPORT_MD" REPORT_JSON="$REPORT_JSON" ALLOWLIST_PATH="$ALLOWLIST_PATH" node <<'NODE'
const fs = require('fs');
const path = require('path');

const mode = process.env.MODE;
const rootDir = process.env.ROOT_DIR;
const reportMdPath = path.resolve(process.env.REPORT_MD);
const reportJsonPath = path.resolve(process.env.REPORT_JSON);
const allowlistPath = path.resolve(rootDir, process.env.ALLOWLIST_PATH);
const today = process.env.REALISM_TODAY || new Date().toISOString().slice(0, 10);
const isCI = /^(1|true)$/i.test(process.env.CI || '');

const mandatoryNetworks = new Set(['sepolia', 'arbitrum']);
const primitivePatterns = new Set([
    'import-src-mocks',
    'vm.mockCall',
    'vm.mockCallRevert',
    'vm.store',
    'vm.etch'
]);

function toPosix(p) {
    return p.split(path.sep).join('/');
}

function rel(p) {
    return toPosix(path.relative(rootDir, p));
}

function walk(dir) {
    if (!fs.existsSync(dir)) return [];
    const out = [];
    const stack = [dir];
    while (stack.length > 0) {
        const current = stack.pop();
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(full);
            } else if (entry.isFile()) {
                out.push(full);
            }
        }
    }
    return out;
}

function lineFromOffset(text, offset) {
    return text.slice(0, offset).split('\n').length;
}

function normalizeNetworkScope(value) {
    if (Array.isArray(value)) {
        return value.map((v) => String(v).toLowerCase());
    }
    if (typeof value === 'string' && value.trim().length > 0) {
        return [value.toLowerCase()];
    }
    return [];
}

function parseDate(value) {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (!iso.test(value)) return null;
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function percentage(numerator, denominator) {
    if (denominator === 0) return 100;
    return (numerator / denominator) * 100;
}

const forkDir = path.join(rootDir, 'packages/contracts/test/fork');
const contractsTestDir = path.join(rootDir, 'packages/contracts/test');

const forkFiles = walk(forkDir).filter((f) => f.endsWith('.sol')).sort();
const topLevelE2EFiles = fs
    .readdirSync(contractsTestDir, { withFileTypes: true })
    .filter((d) => d.isFile() && /^E2E.*\.t\.sol$/.test(d.name))
    .map((d) => path.join(contractsTestDir, d.name))
    .sort();

const targetFiles = [...forkFiles, ...topLevelE2EFiles];

const observations = [];
const metrics = {
    total_test_files: walk(contractsTestDir).filter((f) => f.endsWith('.sol')).length,
    fork_e2e_files: targetFiles.length,
    fork_files: forkFiles.length,
    top_level_e2e_files: topLevelE2EFiles.length,
    mock_import_lines: 0,
    vm_mock_lines: 0,
    vm_store_lines: 0,
    vm_etch_lines: 0,
    prank_lines: 0,
    expect_revert_total: 0,
    expect_revert_generic: 0,
    expect_revert_selector_specific: 0,
    skip_logs: 0,
    skip_return_blocks: 0,
    skip_return_blocks_mandatory_networks: 0
};

for (const file of targetFiles) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    const relativeFile = rel(file);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNo = i + 1;

        if (/import\s+[^;]*src\/mocks\//.test(line)) {
            metrics.mock_import_lines += 1;
            observations.push({
                file: relativeFile,
                line: lineNo,
                pattern: 'import-src-mocks',
                network: null,
                message: 'Fork/E2E test imports from src/mocks'
            });
        }

        const vmMatches = [...line.matchAll(/vm\.(mockCallRevert|mockCall|store|etch)\s*\(/g)];
        for (const match of vmMatches) {
            const method = match[1];
            const pattern = `vm.${method}`;
            if (pattern === 'vm.mockCall' || pattern === 'vm.mockCallRevert') {
                metrics.vm_mock_lines += 1;
            } else if (pattern === 'vm.store') {
                metrics.vm_store_lines += 1;
            } else if (pattern === 'vm.etch') {
                metrics.vm_etch_lines += 1;
            }
            observations.push({
                file: relativeFile,
                line: lineNo,
                pattern,
                network: null,
                message: `Fork/E2E test uses ${pattern}`
            });
        }

        if (/vm\.(prank|startPrank)\s*\(/.test(line)) {
            metrics.prank_lines += 1;
        }

        if (/SKIPPED:/.test(line)) {
            metrics.skip_logs += 1;
        }
    }

    const expectRevertRegex = /vm\.expectRevert\s*\(([\s\S]*?)\)\s*;/g;
    let expectMatch;
    while ((expectMatch = expectRevertRegex.exec(text)) !== null) {
        metrics.expect_revert_total += 1;
        const inner = expectMatch[1].trim();
        const lineNo = lineFromOffset(text, expectMatch.index);
        if (inner.length === 0) {
            metrics.expect_revert_generic += 1;
            observations.push({
                file: relativeFile,
                line: lineNo,
                pattern: 'generic-expectRevert',
                network: null,
                message: 'Fork/E2E test uses generic vm.expectRevert() without selector'
            });
        }
        if (/(selector|abi\.encodeWithSelector|bytes4\s*\()/.test(inner)) {
            metrics.expect_revert_selector_specific += 1;
        }
    }

    const skipBlockRegex = /if\s*\(\s*!\s*_tryChainFork\(\s*"([^"]+)"\s*\)\s*\)\s*\{[\s\S]{0,260}?SKIPPED:[\s\S]{0,260}?return\s*;/g;
    let skipBlockMatch;
    while ((skipBlockMatch = skipBlockRegex.exec(text)) !== null) {
        metrics.skip_return_blocks += 1;
        const network = skipBlockMatch[1].toLowerCase();
        const lineNo = lineFromOffset(text, skipBlockMatch.index);
        if (mandatoryNetworks.has(network)) {
            metrics.skip_return_blocks_mandatory_networks += 1;
        }
        observations.push({
            file: relativeFile,
            line: lineNo,
            pattern: 'ci-skip-return',
            network,
            message: `Fork/E2E test contains early-return skip block for ${network}`
        });
    }
}

let allowlistRaw;
try {
    allowlistRaw = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
} catch (err) {
    console.error(`Failed to read allowlist: ${allowlistPath}`);
    console.error(err.message);
    process.exit(2);
}

const allowlistEntries = Array.isArray(allowlistRaw.entries) ? allowlistRaw.entries : [];
const allowlistMetadataFindings = [];
const expiredEntries = [];

for (let i = 0; i < allowlistEntries.length; i++) {
    const entry = allowlistEntries[i] || {};
    const requiredFields = ['file', 'pattern', 'reason', 'owner', 'expires_on', 'network_scope'];
    const missing = requiredFields.filter((field) => !(field in entry) || String(entry[field]).trim().length === 0);
    if (missing.length > 0) {
        allowlistMetadataFindings.push({
            id: `allowlist-metadata-${i}`,
            severity: 'must-fix',
            title: `Allowlist entry missing required fields: ${missing.join(', ')}`,
            file: rel(allowlistPath),
            detail: `Entry index ${i} is invalid.`
        });
        continue;
    }

    const date = parseDate(String(entry.expires_on));
    if (!date) {
        allowlistMetadataFindings.push({
            id: `allowlist-date-${i}`,
            severity: 'must-fix',
            title: 'Allowlist entry has invalid expires_on format (expected YYYY-MM-DD)',
            file: rel(allowlistPath),
            detail: `Entry index ${i} has expires_on=${entry.expires_on}`
        });
    } else if (entry.expires_on < today) {
        expiredEntries.push({
            entry,
            index: i
        });
    }

    const networkScope = normalizeNetworkScope(entry.network_scope);
    if (networkScope.length === 0) {
        allowlistMetadataFindings.push({
            id: `allowlist-scope-${i}`,
            severity: 'must-fix',
            title: 'Allowlist entry has empty network_scope',
            file: rel(allowlistPath),
            detail: `Entry index ${i} must target at least one network scope`
        });
    }
}

function isAllowlisted(observation) {
    const matches = allowlistEntries.filter((entry) => {
        if (entry.file !== observation.file) return false;
        if (entry.pattern !== observation.pattern) return false;
        const networks = normalizeNetworkScope(entry.network_scope);
        if (observation.network) {
            return networks.includes(observation.network) || networks.includes('all');
        }
        return true;
    });

    if (matches.length === 0) return { matched: false, entry: null, expired: false };

    const entry = matches[0];
    const expiration = parseDate(String(entry.expires_on));
    const expired = !expiration ? false : entry.expires_on < today;
    return { matched: true, entry, expired };
}

function aggregateByFilePattern(items) {
    const map = new Map();
    for (const item of items) {
        const key = `${item.file}|${item.pattern}`;
        if (!map.has(key)) {
            map.set(key, {
                file: item.file,
                pattern: item.pattern,
                count: 0,
                lines: [],
                networks: new Set(),
                messages: new Set()
            });
        }
        const agg = map.get(key);
        agg.count += 1;
        if (agg.lines.length < 6 && item.line) agg.lines.push(item.line);
        if (item.network) agg.networks.add(item.network);
        if (item.message) agg.messages.add(item.message);
    }
    return [...map.values()].map((agg) => ({
        ...agg,
        networks: [...agg.networks],
        messages: [...agg.messages]
    }));
}

const grouped = aggregateByFilePattern(observations);

const allowlistedFindings = [];
const unallowlistedGrouped = [];
for (const item of grouped) {
    const match = isAllowlisted(item);
    if (match.matched) {
        allowlistedFindings.push({
            file: item.file,
            pattern: item.pattern,
            count: item.count,
            lines: item.lines,
            classification: match.entry.classification || 'conditionally-allowed',
            reason: match.entry.reason,
            owner: match.entry.owner,
            expires_on: match.entry.expires_on,
            network_scope: match.entry.network_scope,
            sentinel_file: match.entry.sentinel_file || null,
            expired: match.expired
        });
    } else {
        unallowlistedGrouped.push(item);
    }
}

const mustFix = [];
const shouldFix = [];
const niceToHave = [];

for (const finding of allowlistMetadataFindings) {
    mustFix.push(finding);
}

for (const finding of expiredEntries) {
    shouldFix.push({
        id: `allowlist-expired-${finding.index}`,
        severity: 'should-fix',
        title: 'Allowlist entry is expired',
        file: rel(allowlistPath),
        detail: `Entry index ${finding.index} expired on ${finding.entry.expires_on}`
    });
}

for (let i = 0; i < allowlistEntries.length; i++) {
    const entry = allowlistEntries[i] || {};
    const classification = String(entry.classification || '').toLowerCase();
    if (classification !== 'conditionally-allowed') continue;

    const sentinelFile = String(entry.sentinel_file || '').trim();
    if (!sentinelFile) {
        shouldFix.push({
            id: `allowlist-conditional-sentinel-missing-${i}`,
            severity: 'should-fix',
            title: 'Conditionally-allowed mock entry is missing paired sentinel_file',
            file: rel(allowlistPath),
            detail:
                `Entry index ${i} (${entry.file} :: ${entry.pattern}) must include a real-contract sentinel_file ` +
                'in the same domain.'
        });
        continue;
    }

    const sentinelAbs = path.join(rootDir, sentinelFile);
    if (!fs.existsSync(sentinelAbs)) {
        shouldFix.push({
            id: `allowlist-conditional-sentinel-not-found-${i}`,
            severity: 'should-fix',
            title: 'Conditionally-allowed mock entry references missing sentinel_file',
            file: rel(allowlistPath),
            detail: `Entry index ${i} references missing sentinel_file: ${sentinelFile}`
        });
        continue;
    }

    const sentinelText = fs.readFileSync(sentinelAbs, 'utf8');
    if (/src\/mocks\//.test(sentinelText)) {
        shouldFix.push({
            id: `allowlist-conditional-sentinel-mocked-${i}`,
            severity: 'should-fix',
            title: 'Conditionally-allowed mock entry sentinel_file still imports src/mocks',
            file: sentinelFile,
            detail:
                `Entry index ${i} sentinel_file (${sentinelFile}) imports src/mocks. ` +
                'Sentinel coverage should prioritize real contracts.'
        });
    }
}

for (const item of unallowlistedGrouped) {
    const lineLabel = item.lines.length > 0 ? `lines ${item.lines.join(', ')}` : 'line unknown';

    if (primitivePatterns.has(item.pattern)) {
        mustFix.push({
            id: `primitive-${item.file}-${item.pattern}`,
            severity: 'must-fix',
            title: `Unallowlisted mock primitive: ${item.pattern}`,
            file: item.file,
            detail: `${item.pattern} appears ${item.count} time(s) at ${lineLabel}. Add allowlist metadata or replace with real contract interaction.`
        });
        continue;
    }

    if (item.pattern === 'generic-expectRevert') {
        shouldFix.push({
            id: `generic-revert-${item.file}`,
            severity: 'should-fix',
            title: 'Generic vm.expectRevert() lacks selector-specific assertion',
            file: item.file,
            detail: `Found ${item.count} generic expectRevert call(s) at ${lineLabel}. Use custom-error selectors or document allowlisted external nondeterminism.`
        });
        continue;
    }

    if (item.pattern === 'ci-skip-return') {
        const hitsMandatory = item.networks.some((network) => mandatoryNetworks.has(network));
        const severity = isCI && hitsMandatory ? 'should-fix' : 'nice-to-have';
        const bucket = severity === 'should-fix' ? shouldFix : niceToHave;
        bucket.push({
            id: `skip-return-${item.file}`,
            severity,
            title: 'Fork skip-return block requires governance for CI',
            file: item.file,
            detail: `Found ${item.count} skip-return block(s) for networks [${item.networks.join(', ')}] at ${lineLabel}.`
        });
    }
}

const selectorSpecificity = percentage(metrics.expect_revert_selector_specific, metrics.expect_revert_total);
const defaultThreshold = mode === 'enforce-should-fix' ? 80 : 70;
const configuredThreshold = process.env.REALISM_REVERT_THRESHOLD
    ? Number(process.env.REALISM_REVERT_THRESHOLD) * (Number(process.env.REALISM_REVERT_THRESHOLD) <= 1 ? 100 : 1)
    : defaultThreshold;

if (selectorSpecificity < configuredThreshold) {
    shouldFix.push({
        id: 'revert-specificity-threshold',
        severity: 'should-fix',
        title: 'Revert selector specificity below threshold',
        file: 'packages/contracts/test/fork/**',
        detail:
            `Selector-specific expectRevert ratio is ${selectorSpecificity.toFixed(2)}% ` +
            `(threshold ${configuredThreshold.toFixed(2)}%, total ${metrics.expect_revert_total}, selector-specific ${metrics.expect_revert_selector_specific}).`
    });
}

if (isCI && metrics.skip_return_blocks_mandatory_networks > 0) {
    shouldFix.push({
        id: 'ci-skip-target-zero',
        severity: 'should-fix',
        title: 'CI skip target violated for mandatory fork networks',
        file: 'packages/contracts/test/fork/**',
        detail:
            `Detected ${metrics.skip_return_blocks_mandatory_networks} skip-return blocks for mandatory networks ` +
            '(Sepolia/Arbitrum). CI target is 0.'
    });
}

const scenarioMatrix = {
    sepolia: {
        sentinel_file: 'packages/contracts/test/E2EWorkflow.t.sol',
        exists: false,
        required_contracts: [
            'GardenToken',
            'GardenAccount',
            'ActionRegistry',
            'WorkResolver',
            'WorkApprovalResolver',
            'AssessmentResolver',
            'HatsModule'
        ]
    },
    arbitrum: {
        sentinel_file: 'packages/contracts/test/fork/e2e/ArbitrumFullProtocolE2E.t.sol',
        exists: false,
        required_contracts: [
            'GardenToken',
            'GardenAccount',
            'ActionRegistry',
            'GardensModule',
            'YieldResolver',
            'GreenGoodsENS'
        ]
    }
};

for (const [network, matrix] of Object.entries(scenarioMatrix)) {
    const sentinelAbs = path.join(rootDir, matrix.sentinel_file);
    matrix.exists = fs.existsSync(sentinelAbs);

    if (!matrix.exists) {
        shouldFix.push({
            id: `scenario-matrix-${network}`,
            severity: 'should-fix',
            title: `Missing sentinel scenario file for ${network}`,
            file: matrix.sentinel_file,
            detail: `Required sentinel file for ${network} scenario matrix does not exist.`
        });
        continue;
    }

    const sentinelText = fs.readFileSync(sentinelAbs, 'utf8');
    matrix.uses_src_mocks = /src\/mocks\//.test(sentinelText);
    matrix.contract_presence = {};
    const missingContracts = [];

    for (const contractName of matrix.required_contracts) {
        const contractRegex = new RegExp(`\\b${escapeRegex(contractName)}\\b`);
        const present = contractRegex.test(sentinelText);
        matrix.contract_presence[contractName] = present;
        if (!present) {
            missingContracts.push(contractName);
        }
    }

    if (missingContracts.length > 0) {
        shouldFix.push({
            id: `scenario-matrix-contracts-${network}`,
            severity: 'should-fix',
            title: `Scenario matrix sentinel missing required contract references for ${network}`,
            file: matrix.sentinel_file,
            detail: `Missing references: ${missingContracts.join(', ')}.`
        });
    }

    if (matrix.uses_src_mocks) {
        shouldFix.push({
            id: `scenario-matrix-mocked-${network}`,
            severity: 'should-fix',
            title: `Scenario matrix sentinel imports src/mocks for ${network}`,
            file: matrix.sentinel_file,
            detail: 'Sentinel scenarios should exercise real contracts instead of src/mocks imports.'
        });
    }
}

const summary = {
    generated_at: new Date().toISOString(),
    mode,
    today,
    is_ci: isCI,
    allowlist_path: rel(allowlistPath),
    inventory: {
        total_test_files: metrics.total_test_files,
        fork_e2e_files: metrics.fork_e2e_files,
        fork_files: metrics.fork_files,
        top_level_e2e_files: metrics.top_level_e2e_files
    },
    metrics,
    thresholds: {
        selector_specificity_percent: selectorSpecificity,
        selector_specificity_threshold_percent: configuredThreshold
    },
    allowlist: {
        entries: allowlistEntries.length,
        allowlisted_findings: allowlistedFindings.length,
        expired_entries: expiredEntries.length,
        metadata_issues: allowlistMetadataFindings.length
    },
    scenario_matrix: scenarioMatrix,
    findings: {
        must_fix: mustFix,
        should_fix: shouldFix,
        nice_to_have: niceToHave
    },
    mock_map: {
        allowlisted: allowlistedFindings,
        unallowlisted: unallowlistedGrouped.map((item) => ({
            file: item.file,
            pattern: item.pattern,
            count: item.count,
            lines: item.lines,
            networks: item.networks,
            classification: primitivePatterns.has(item.pattern)
                ? 'disallowed'
                : item.pattern === 'generic-expectRevert'
                    ? 'requires-justification'
                    : item.pattern === 'ci-skip-return'
                        ? 'ci-governance-required'
                        : 'review-required'
        }))
    }
};

let exitCode = 0;
if (mode === 'enforce-must-fix') {
    exitCode = mustFix.length > 0 ? 1 : 0;
} else if (mode === 'enforce-should-fix') {
    exitCode = mustFix.length > 0 || shouldFix.length > 0 ? 1 : 0;
}
summary.status = {
    exit_code: exitCode,
    pass: exitCode === 0
};

function renderFindings(items) {
    if (!items.length) return '- None';
    return items
        .map((item) => `- ${item.title} (${item.file})\n  - ${item.detail}`)
        .join('\n');
}

const md = `# Contract Test Realism Audit\n\n` +
`## Summary\n` +
`- Mode: \`${mode}\`\n` +
`- Generated: \`${summary.generated_at}\`\n` +
`- Inventory: ${metrics.total_test_files} total Solidity test files, ${metrics.fork_e2e_files} fork/e2e files\n` +
`- Mock primitives: ${metrics.mock_import_lines} src/mocks imports, ${metrics.vm_mock_lines} vm.mockCall* calls, ${metrics.vm_store_lines} vm.store calls, ${metrics.vm_etch_lines} vm.etch calls\n` +
`- Revert specificity: ${metrics.expect_revert_selector_specific}/${metrics.expect_revert_total} selector-specific (${selectorSpecificity.toFixed(2)}%)\n` +
`- Generic expectRevert: ${metrics.expect_revert_generic}\n` +
`- Skip logs: ${metrics.skip_logs}, skip-return blocks: ${metrics.skip_return_blocks} (mandatory networks: ${metrics.skip_return_blocks_mandatory_networks})\n` +
`- Allowlist: ${allowlistEntries.length} entries, ${allowlistedFindings.length} matched, ${expiredEntries.length} expired\n\n` +
`## Severity Mapping\n` +
`- Critical/High -> must-fix\n` +
`- Medium -> should-fix\n` +
`- Low -> nice-to-have\n\n` +
`## Must-Fix\n${renderFindings(mustFix)}\n\n` +
`## Should-Fix\n${renderFindings(shouldFix)}\n\n` +
`## Nice-to-Have\n${renderFindings(niceToHave)}\n\n` +
`## Verification\n` +
`- Command: \`bash scripts/check-contract-test-realism.sh --mode ${mode} --report-md ${toPosix(reportMdPath)} --report-json ${toPosix(reportJsonPath)}\`\n` +
`- Allowlist source: \`${rel(allowlistPath)}\`\n` +
`- Mandatory networks: Sepolia, Arbitrum\n\n` +
`## Recommendation\n` +
`- Prioritize must-fix findings first.\n` +
`- Burn down should-fix findings before enabling \`enforce-should-fix\` as a hard gate.\n` +
`- Use allowlist expiry to force deterministic mock removals or explicit renewals.\n`;

fs.mkdirSync(path.dirname(reportMdPath), { recursive: true });
fs.mkdirSync(path.dirname(reportJsonPath), { recursive: true });
fs.writeFileSync(reportMdPath, md);
fs.writeFileSync(reportJsonPath, `${JSON.stringify(summary, null, 2)}\n`);

console.log(`Wrote Markdown report: ${toPosix(reportMdPath)}`);
console.log(`Wrote JSON report: ${toPosix(reportJsonPath)}`);
console.log(`Mode: ${mode} | Must-fix: ${mustFix.length} | Should-fix: ${shouldFix.length} | Nice-to-have: ${niceToHave.length}`);

process.exit(exitCode);
NODE
>>>>>>> release/1.1
