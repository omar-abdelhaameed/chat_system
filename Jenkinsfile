pipeline {
    agent any

    options {
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    parameters {
        booleanParam(name: 'FORCE_PULL', defaultValue: false,
                      description: 'Force pull the latest Kingfisher image even on a push-triggered build')
    }

    triggers {
        githubPush()
        cron('H 3 * * 0')
    }

    environment {
        PROJECT_NAME    = "chat-system-ci-${BUILD_NUMBER}"
        COMPOSE_FILES   = "-f docker-compose.yml -f docker-compose.ci.yml"
        // nginx is the only service published to the host under docker-compose.ci.yml (18080:80).
        // fastapi/fastapi-1/fastapi-2/postgres/redis/rabbitmq are internal-network-only.
        DAST_TARGET_URL = 'http://localhost:18080/docs'
    }

    stages {

        stage('Checkout') {
            steps {
                deleteDir()
                git branch: 'main',
                    url: 'https://github.com/omar-abdelhaameed/chat_system.git'
            }
        }

        stage('Pull Kingfisher') {
            when {
                anyOf {
                    expression { params.FORCE_PULL }
                    triggeredBy 'TimerTrigger'
                }
            }
            steps {
                sh 'docker pull ghcr.io/mongodb/kingfisher:latest'
            }
        }

        stage('Verify Kingfisher Image Present') {
            steps {
                sh '''
                    if ! docker image inspect ghcr.io/mongodb/kingfisher:latest >/dev/null 2>&1; then
                        echo "No local Kingfisher image found. Re-run with FORCE_PULL=true once."
                        exit 1
                    fi
                '''
            }
        }

        stage('Debug Workspace') {
            steps {
                sh '''
                    echo "WORKSPACE=$WORKSPACE"
                    echo "PROJECT_NAME=$PROJECT_NAME"
                    ls -lah "$WORKSPACE"
                '''
            }
        }

        stage('Secret Scan (Kingfisher)') {
            options { timeout(time: 10, unit: 'MINUTES') }
            steps {
                script {
                    def scanExit = sh(
                        script: '''
                            mkdir -p "$WORKSPACE/reports"
                            docker run --rm \
                              --user root \
                              --volumes-from "$HOSTNAME" \
                              ghcr.io/mongodb/kingfisher:latest \
                              scan "$WORKSPACE" \
                              -f json \
                              -o "$WORKSPACE/reports/kingfisher-findings.json"
                        ''',
                        returnStatus: true
                    )
                    echo "Kingfisher exited with code ${scanExit}"
                    if (scanExit == 200 || scanExit == 205) {
                        currentBuild.result = 'UNSTABLE'
                    } else if (scanExit != 0) {
                        error("Kingfisher scan failed unexpectedly (exit code ${scanExit})")}
                }
            }
        }

        stage('SAST (Semgrep)') {
            options { timeout(time: 10, unit: 'MINUTES') }
            steps {
                script {
                    def sastExit = sh(
                        script: '''
                            docker run --rm \
                              --volumes-from "$HOSTNAME" \
                              -w "$WORKSPACE" \
                              semgrep/semgrep \
                              semgrep scan --config auto \
                              --json --output "$WORKSPACE/reports/sast-findings.json" \
                              "$WORKSPACE"
                        ''',
                        returnStatus: true
                    )
                    echo "Semgrep exited with code ${sastExit}"
                    if (sastExit != 0 && sastExit != 1) {
                        error("Semgrep SAST scan failed unexpectedly (exit code ${sastExit})")
                    }
                    // Semgrep's own exit 1 just means "any finding present", not severity —
                    // so gate on actual severity in the report rather than the exit code.
                    def hasHighSeverity = sh(
                        script: '''
                            grep -q '"severity"[[:space:]]*:[[:space:]]*"ERROR"' "$WORKSPACE/reports/sast-findings.json"
                        ''',
                        returnStatus: true
                    )
                    if (hasHighSeverity == 0) {
                        error("SAST found HIGH/CRITICAL-equivalent (ERROR severity) findings — see reports/sast-findings.json")
                    }
                }
            }
        }

        stage('Deploy App for DAST') {
            steps {
                sh '''
                    cd "$WORKSPACE"
                    docker compose -p ${PROJECT_NAME} ${COMPOSE_FILES} up -d --build
                    echo "Waiting for app to become reachable..."
                    for i in $(seq 1 40); do
                        code=$(curl -s -o /dev/null -w "%{http_code}" "$DAST_TARGET_URL") || true
                        if [ "$code" != "000" ]; then
                            echo "App is responding (HTTP $code)."
                            break
                        fi
                        sleep 3
                    done
                '''
            }
        }

        stage('DAST (OWASP ZAP)') {
            options { timeout(time: 15, unit: 'MINUTES') }
            steps {
                script {
                    def dastExit = sh(
                        script: '''
                            docker run \
                              --user root \
                              --network host \
                              --name zap-scan-$BUILD_NUMBER \
                              -v /zap/wrk \
                              zaproxy/zap-stable \
                              zap-baseline.py \
                              -t "$DAST_TARGET_URL" \
                              -J dast-findings.json \
                              -I
                        ''',
                        returnStatus: true
                    )
                    echo "ZAP exited with code ${dastExit}"

                    sh '''
                        docker cp "zap-scan-$BUILD_NUMBER:/zap/wrk/dast-findings.json" "$WORKSPACE/reports/dast-findings.json"
                        docker rm -fv "zap-scan-$BUILD_NUMBER"
                    '''

                    // zap-baseline.py: 0=pass, 1=warn, 2=fail-threshold reached (HIGH/CRITICAL-equivalent)
                    if (dastExit == 2) {
                        error("DAST found HIGH/CRITICAL-equivalent findings — see reports/dast-findings.json")
                    } else if (dastExit != 0 && dastExit != 1) {
                        error("ZAP DAST scan failed unexpectedly (exit code ${dastExit})")
                    }
                }
            }
        }

        stage('Verify Reports') {
            steps {
                sh '''
                    cd "$WORKSPACE/reports"
                    for f in kingfisher-findings.json sast-findings.json dast-findings.json; do
                        if [ ! -s "$f" ]; then
                            echo "Missing or empty report: $f"
                            exit 1
                        fi
                        if ! python3 -m json.tool "$f" > /dev/null 2>&1; then
                            echo "Invalid JSON in report: $f"
                            exit 1
                        fi
                        echo "$f OK ($(du -h "$f" | cut -f1))"
                    done
                '''
            }
        }

        stage('Archive Reports') {
            steps {
                archiveArtifacts artifacts: 'reports/*.json', fingerprint: true, allowEmptyArchive: true
            }
        }
    }

    post {
        success {
            echo "Build passed — tearing down CI stack '${PROJECT_NAME}'"
            sh 'cd "$WORKSPACE" && docker compose -p ${PROJECT_NAME} ${COMPOSE_FILES} down -v || true'
            sh 'docker rm -f "zap-scan-$BUILD_NUMBER" 2>/dev/null || true'
        }
        failure {
            echo "Build failed — leaving stack '${PROJECT_NAME}' running for debugging."
            echo "Inspect with: docker compose -p ${PROJECT_NAME} ${COMPOSE_FILES} ps"
            echo "Tear down manually when done: docker compose -p ${PROJECT_NAME} ${COMPOSE_FILES} down -v"
            sh 'docker rm -f "zap-scan-$BUILD_NUMBER" 2>/dev/null || true'
        }
        always {
            echo "Pipeline finished with result: ${currentBuild.result ?: 'SUCCESS'}"
        }
    }
}