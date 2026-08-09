
pipeline {
    agent any

    options {
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
        timestamps()
    }

    parameters {
        booleanParam(
            name: 'FORCE_PULL',
            defaultValue: false,
            description: 'Force pull the latest Kingfisher image even on a push-triggered build'
        )
    }

    triggers {
        githubPush()
        cron('H 3 * * 0')
    }

    environment {
        DAST_TARGET_URL = 'http://localhost:8082/docs'

        KINGFISHER_IMAGE = 'ghcr.io/mongodb/kingfisher:latest'
        SEMGREP_IMAGE    = 'semgrep/semgrep:latest'
        ZAP_IMAGE        = 'zaproxy/zap-stable:latest'

        REPORTS_DIR = 'reports'
    }

    stages {

        // ============================================================
        // CHECKOUT
        // ============================================================

        stage('Checkout') {
            steps {
                deleteDir()

                git(
                    branch: 'main',
                    url: 'https://github.com/omar-abdelhaameed/chat_system.git'
                )

                sh '''
                    set -eu

                    mkdir -p "$WORKSPACE/$REPORTS_DIR"

                    echo "========================================="
                    echo "Checkout completed"
                    echo "========================================="
                    echo "Workspace: $WORKSPACE"
                    echo "Commit:"
                    git rev-parse HEAD
                '''
            }
        }


        // ============================================================
        // KINGFISHER IMAGE
        // ============================================================

        stage('Pull Kingfisher') {
            when {
                anyOf {
                    expression {
                        params.FORCE_PULL
                    }

                    triggeredBy 'TimerTrigger'
                }
            }

            steps {
                sh '''
                    set -eu

                    echo "Pulling latest Kingfisher image..."

                    docker pull "$KINGFISHER_IMAGE"
                '''
            }
        }


        stage('Verify Kingfisher Image Present') {
            steps {
                sh '''
                    set -eu

                    if ! docker image inspect "$KINGFISHER_IMAGE" >/dev/null 2>&1; then
                        echo "ERROR: Kingfisher image is not available locally."
                        echo "Run the pipeline once with FORCE_PULL=true."
                        exit 1
                    fi

                    echo "Kingfisher image:"
                    docker image inspect "$KINGFISHER_IMAGE" \
                        --format '{{.RepoTags}}'
                '''
            }
        }


        // ============================================================
        // DEBUG / WORKSPACE
        // ============================================================

        stage('Debug Workspace') {
            steps {
                sh '''
                    set -eu

                    echo "========================================="
                    echo "Workspace Debug"
                    echo "========================================="

                    echo "WORKSPACE=$WORKSPACE"
                    echo "HOSTNAME=$HOSTNAME"

                    echo
                    echo "Workspace contents:"
                    ls -lah "$WORKSPACE"

                    echo
                    echo "Reports directory:"
                    ls -lah "$WORKSPACE/$REPORTS_DIR" || true
                '''
            }
        }


        // ============================================================
        // KINGFISHER
        // ============================================================

        stage('Secret Scan (Kingfisher)') {
            options {
                timeout(time: 10, unit: 'MINUTES')
            }

            steps {
                script {

                    def scanExit = sh(
                        script: '''
                            set +e

                            mkdir -p "$WORKSPACE/$REPORTS_DIR"

                            echo "========================================="
                            echo "Kingfisher Secret Scan"
                            echo "========================================="

                            docker run --rm \
                                --user root \
                                --volumes-from "$HOSTNAME" \
                                "$KINGFISHER_IMAGE" \
                                scan "$WORKSPACE" \
                                -f json \
                                -o "$WORKSPACE/$REPORTS_DIR/kingfisher-findings.json"

                            status=$?

                            echo "Kingfisher exit code: $status"

                            exit "$status"
                        ''',
                        returnStatus: true
                    )

                    echo "Kingfisher exited with code ${scanExit}"

                    /*
                     * Kingfisher can return a non-zero status when findings
                     * are detected. Therefore the exit code alone is NOT
                     * our security policy.
                     *
                     * The JSON report is the source of truth.
                     */

                    if (scanExit > 1) {
                        error(
                            "Kingfisher scanner failed unexpectedly " +
                            "(exit code ${scanExit})"
                        )
                    }

                    sh '''
                        set -eu

                        test -s "$WORKSPACE/$REPORTS_DIR/kingfisher-findings.json"

                        python3 - <<'PY'
import json
import sys

path = "reports/kingfisher-findings.json"

with open(path, "r") as f:
    report = json.load(f)

summary = report.get("metadata", {}).get("summary", {})

findings = summary.get("findings", 0)
active = summary.get("active_findings", 0)
unknown = summary.get("unknown_validation_findings", 0)
successful = summary.get("successful_validations", 0)
failed = summary.get("failed_validations", 0)
skipped = summary.get("skipped_validations", 0)

print("")
print("=========================================")
print("KINGFISHER SECURITY SUMMARY")
print("=========================================")
print(f"Total findings:             {findings}")
print(f"Active findings:            {active}")
print(f"Unknown validation:         {unknown}")
print(f"Successful validations:     {successful}")
print(f"Failed validations:         {failed}")
print(f"Skipped validations:        {skipped}")
print("=========================================")

for item in report.get("findings", []):
    rule = item.get("rule", {})
    finding = item.get("finding", {})
    validation = finding.get("validation", {})

    print("")
    print(f"Rule:       {rule.get('name')}")
    print(f"Confidence: {finding.get('confidence')}")
    print(f"Path:       {finding.get('path')}")
    print(f"Line:       {finding.get('line')}")
    print(f"Validation: {validation.get('outcome')}")

print("")

# ------------------------------------------------------------
# CURRENT POLICY
#
# Active validated secrets = blocking
# Unknown / skipped validation = reported, not blocking
# No active secrets = pass
# ------------------------------------------------------------

if active > 0:
    print("SECURITY GATE: FAILED")
    print("Active validated secrets were detected.")
    sys.exit(10)

print("SECURITY GATE: PASSED")
print("No active validated secrets detected.")
PY
                    '''
                }
            }
        }


        // ============================================================
        // SAST
        // ============================================================

        stage('SAST (Semgrep)') {
            options {
                timeout(time: 10, unit: 'MINUTES')
            }

            steps {
                script {

                    def sastExit = sh(
                        script: '''
                            set +e

                            mkdir -p "$WORKSPACE/$REPORTS_DIR"

                            docker run --rm \
                                --volumes-from "$HOSTNAME" \
                                -w "$WORKSPACE" \
                                "$SEMGREP_IMAGE" \
                                semgrep scan \
                                --config auto \
                                --json \
                                --output "$WORKSPACE/$REPORTS_DIR/sast-findings.json" \
                                "$WORKSPACE"

                            status=$?

                            echo "Semgrep exit code: $status"

                            exit "$status"
                        ''',
                        returnStatus: true
                    )

                    echo "Semgrep exited with code ${sastExit}"

                    /*
                     * Semgrep:
                     *
                     * 0 = no findings
                     * 1 = findings
                     * other = scanner/runtime failure
                     */

                    if (sastExit == 1) {
                        currentBuild.result = 'UNSTABLE'

                        echo """
                        Semgrep found security issues.
                        The report will be archived and reviewed by
                        the security gate.
                        """
                    }
                    else if (sastExit != 0) {
                        error(
                            "Semgrep SAST scanner failed unexpectedly " +
                            "(exit code ${sastExit})"
                        )
                    }
                }
            }
        }


        // ============================================================
        // DEPLOY APPLICATION
        // ============================================================

        stage('Deploy App for DAST') {
            steps {
                sh '''
                    set -eu

                    cd "$WORKSPACE"

                    echo "========================================="
                    echo "Building application"
                    echo "========================================="

                    docker-compose up -d --build

                    echo
                    echo "Waiting for application..."
                    echo "Target: $DAST_TARGET_URL"

                    ready=0

                    for i in $(seq 1 40); do

                        code=$(curl \
                            -s \
                            -o /dev/null \
                            -w "%{http_code}" \
                            "$DAST_TARGET_URL" \
                            || true)

                        echo "Attempt $i/40 -> HTTP $code"

                        if [ "$code" != "000" ]; then
                            echo "Application is responding (HTTP $code)."
                            ready=1
                            break
                        fi

                        sleep 3
                    done

                    if [ "$ready" -ne 1 ]; then
                        echo "ERROR: Application did not become reachable."
                        docker-compose ps
                        docker-compose logs --tail=100
                        exit 1
                    fi
                '''
            }
        }


        // ============================================================
        // DAST / ZAP
        // ============================================================

        stage('DAST (OWASP ZAP)') {
            options {
                timeout(time: 15, unit: 'MINUTES')
            }

            steps {
                script {

                    def dastExit = sh(
                        script: '''
                            set +e

                            echo "========================================="
                            echo "OWASP ZAP Baseline Scan"
                            echo "========================================="

                            docker run \
                                --user root \
                                --network host \
                                --name "zap-scan-$BUILD_NUMBER" \
                                -v "$WORKSPACE/$REPORTS_DIR:/zap/wrk:rw" \
                                "$ZAP_IMAGE" \
                                zap-baseline.py \
                                -t "$DAST_TARGET_URL" \
                                -J dast-findings.json \
                                -r dast-report.html \
                                -I

                            status=$?

                            echo "ZAP exit code: $status"

                            exit "$status"
                        ''',
                        returnStatus: true
                    )

                    echo "ZAP exited with code ${dastExit}"

                    /*
                     * ZAP report is written directly into the Jenkins
                     * workspace through the mounted reports directory.
                     *
                     * Therefore docker cp is NOT required.
                     */

                    sh '''
                        set -eu

                        if [ ! -s "$WORKSPACE/$REPORTS_DIR/dast-findings.json" ]; then
                            echo "ERROR: ZAP JSON report was not generated."
                            exit 1
                        fi

                        echo "ZAP report generated successfully."
                        ls -lh "$WORKSPACE/$REPORTS_DIR/dast-findings.json"

                        if [ -f "$WORKSPACE/$REPORTS_DIR/dast-report.html" ]; then
                            echo "ZAP HTML report generated successfully."
                            ls -lh "$WORKSPACE/$REPORTS_DIR/dast-report.html"
                        fi
                    '''

                    /*
                     * ZAP baseline normally returns non-zero when alerts
                     * are found. That is not the same as scanner failure.
                     *
                     * We preserve the report and let the final security
                     * evaluation decide whether the build should fail.
                     */

                    if (dastExit != 0) {
                        currentBuild.result = 'UNSTABLE'

                        echo """
                        ZAP returned non-zero status (${dastExit}).
                        The DAST report will be evaluated by the security gate.
                        """
                    }
                }
            }
        }


        // ============================================================
        // TEAR DOWN APPLICATION
        // ============================================================

        stage('Tear Down App') {
            steps {
                sh '''
                    set +e

                    cd "$WORKSPACE"

                    docker-compose down -v

                    exit 0
                '''
            }
        }


        // ============================================================
        // REPORT VALIDATION
        // ============================================================

        stage('Verify Reports') {
            steps {
                sh '''
                    set -eu

                    cd "$WORKSPACE/$REPORTS_DIR"

                    echo "========================================="
                    echo "Report Validation"
                    echo "========================================="

                    for f in \
                        kingfisher-findings.json \
                        sast-findings.json \
                        dast-findings.json
                    do
                        if [ ! -s "$f" ]; then
                            echo "ERROR: Missing or empty report: $f"
                            exit 1
                        fi

                        if ! python3 -m json.tool "$f" > /dev/null 2>&1; then
                            echo "ERROR: Invalid JSON in report: $f"
                            exit 1
                        fi

                        echo "$f OK ($(du -h "$f" | cut -f1))"
                    done
                '''
            }
        }


        // ============================================================
        // SECURITY GATE
        // ============================================================

        stage('Security Gate') {
            steps {
                script {

                    /*
                     * Kingfisher
                     *
                     * Active findings are blocking.
                     * Unknown/skipped validation is currently non-blocking.
                     */

                    def kingfisherActive = sh(
                        script: '''
                            python3 - <<'PY'
import json

with open("reports/kingfisher-findings.json") as f:
    report = json.load(f)

summary = report.get("metadata", {}).get("summary", {})

print(summary.get("active_findings", 0))
PY
                        ''',
                        returnStdout: true
                    ).trim().toInteger()


                    /*
                     * Semgrep
                     *
                     * Parse actual findings rather than searching the
                     * JSON text for the word "error" or "high".
                     */

                    def semgrepFindings = sh(
                        script: '''
                            python3 - <<'PY'
import json

with open("reports/sast-findings.json") as f:
    report = json.load(f)

results = report.get("results", [])

print(len(results))
PY
                        ''',
                        returnStdout: true
                    ).trim().toInteger()


                    /*
                     * ZAP
                     *
                     * ZAP's JSON schema contains an "alerts" array.
                     *
                     * We only block on High or Critical alerts.
                     */

                    def zapHighCritical = sh(
                        script: '''
                            python3 - <<'PY'
import json

with open("reports/dast-findings.json") as f:
    report = json.load(f)

alerts = report.get("site", [])

count = 0

for site in alerts:
    for alert in site.get("alerts", []):
        risk = str(alert.get("riskcode", "")).lower()
        riskdesc = str(alert.get("riskdesc", "")).lower()

        if risk in ("3", "4"):
            count += 1
        elif "high" in riskdesc or "critical" in riskdesc:
            count += 1

print(count)
PY
                        ''',
                        returnStdout: true
                    ).trim().toInteger()


                    echo ""
                    echo "========================================="
                    echo "SECURITY GATE SUMMARY"
                    echo "========================================="
                    echo "Kingfisher active secrets : ${kingfisherActive}"
                    echo "Semgrep findings          : ${semgrepFindings}"
                    echo "ZAP High/Critical alerts  : ${zapHighCritical}"
                    echo "========================================="


                    /*
                     * CURRENT BLOCKING POLICY
                     *
                     * 1. Active validated secrets
                     * 2. ZAP High/Critical
                     *
                     * Semgrep findings are currently reported as UNSTABLE.
                     *
                     * We can later introduce severity-aware Semgrep
                     * gating instead of failing on every finding.
                     */

                    if (kingfisherActive > 0) {
                        error(
                            "Security Gate FAILED: " +
                            "${kingfisherActive} active secret(s) detected."
                        )
                    }

                    if (zapHighCritical > 0) {
                        error(
                            "Security Gate FAILED: " +
                            "${zapHighCritical} High/Critical ZAP alert(s) detected."
                        )
                    }

                    echo "SECURITY GATE PASSED"
                }
            }
        }


        // ============================================================
        // ARCHIVE
        // ============================================================

        stage('Archive Reports') {
            steps {
                archiveArtifacts(
                    artifacts: 'reports/**',
                    fingerprint: true,
                    allowEmptyArchive: false
                )
            }
        }
    }


    // ================================================================
    // POST
    // ================================================================

    post {

        always {

            /*
             * Always remove the application stack.
             *
             * This prevents failed builds from leaving containers,
             * networks and volumes behind.
             */

            sh '''
                set +e

                cd "$WORKSPACE"

                docker-compose down -v

                docker rm -f "zap-scan-$BUILD_NUMBER" 2>/dev/null || true

                exit 0
            '''

            echo "Pipeline finished with result: ${currentBuild.result ?: 'SUCCESS'}"
        }

        success {
            echo "DevSecOps pipeline completed successfully."
        }

        unstable {
            echo "Pipeline completed with UNSTABLE security findings."
        }

        failure {
            echo "DevSecOps pipeline FAILED."
            echo "Reports are available in Jenkins artifacts."
        }
    }
}
