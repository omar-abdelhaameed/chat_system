def notifyGitHub(String state, String context, String description) {
    sh """
        curl -s -X POST \\
          -H "Authorization: token ${env.GITHUB_TOKEN}" \\
          -H "Accept: application/vnd.github+json" \\
          "https://api.github.com/repos/${env.GITHUB_REPO}/statuses/${env.GIT_SHA}" \\
          -d '{"state":"${state}","context":"${context}","description":"${description}","target_url":"${env.BUILD_URL}"}'
    """
}

def notifySlack(String text) {
    sh """
        curl -s -X POST -H 'Content-type: application/json' \\
            --data '{"text":"${text}"}' \\
            "\$SLACK_WEBHOOK_URL"
    """
}

def recordFindingsRun(String status) {
    sh """
        docker network create devsecops-net || true
        docker run --rm --network devsecops-net postgres:13 \\
        psql "postgresql://devsecops:devsecops-findings-pw@devsecops-findings-db/devsecops" \\
        -c "INSERT INTO pipeline_runs (pipeline_name, build_number, git_commit, status) VALUES ('chat-system-devsecops', ${BUILD_NUMBER}, '${env.GIT_SHA ?: ""}', '${status}');" || true
    """
}

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
        PROJECT_NAME      = "chat-system-ci-${BUILD_NUMBER}"
        COMPOSE_FILES     = "-f docker-compose.yml -f docker-compose.ci.yml"
        // nginx is the only service published to the host under docker-compose.ci.yml (18080:80).
        // fastapi/fastapi-1/fastapi-2/postgres/redis/rabbitmq are internal-network-only.
        DAST_TARGET_URL   = 'http://localhost:18080/docs'
        GITHUB_REPO       = 'omar-abdelhaameed/chat_system'
        GITHUB_TOKEN      = credentials('github-token')
        SLACK_WEBHOOK_URL = credentials('slack-webhook-url')
    }

    stages {

        stage('Checkout') {
            steps {
                deleteDir()
                git branch: 'main',
                    url: 'https://github.com/omar-abdelhaameed/chat_system.git'
            }
        }

        stage('Resolve Commit Info') {
            steps {
                script {
                    env.GIT_SHA = sh(script: 'git rev-parse HEAD', returnStdout: true).trim()
                    echo "Resolved commit SHA: ${env.GIT_SHA}"
                }
            }
        }

        stage('Notify GitHub (Pending)') {
            steps {
                script {
                    env.SECRETS_REPORTED = 'false'
                    env.SAST_REPORTED    = 'false'
                    env.DAST_REPORTED    = 'false'
                    notifyGitHub('pending', 'ci/secrets-scan', 'Kingfisher secret scan running...')
                    notifyGitHub('pending', 'ci/sast', 'Semgrep SAST scan running...')
                    notifyGitHub('pending', 'ci/dast', 'OWASP ZAP DAST scan queued...')
                }
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
                    // exit 200/205 = findings present — mark build UNSTABLE, don't fail it
                    if (scanExit == 200 || scanExit == 205) {
                        echo "Secret scan found findings — marking build UNSTABLE. See reports/kingfisher-findings.json"
                        currentBuild.result = 'UNSTABLE'
                        notifyGitHub('failure', 'ci/secrets-scan', 'Kingfisher found secret(s) — see build artifacts')
                    } else if (scanExit != 0) {
                        notifyGitHub('error', 'ci/secrets-scan', 'Kingfisher scan errored unexpectedly')
                        env.SECRETS_REPORTED = 'true'
                        error("Kingfisher scan failed unexpectedly (exit code ${scanExit})")
                    } else {
                        notifyGitHub('success', 'ci/secrets-scan', 'No secrets found')
                    }
                    env.SECRETS_REPORTED = 'true'
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
                        notifyGitHub('error', 'ci/sast', 'Semgrep scan errored unexpectedly')
                        env.SAST_REPORTED = 'true'
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
                        echo "SAST found findings — marking build UNSTABLE. See reports/sast-findings.json"
                        currentBuild.result = 'UNSTABLE'
                        notifyGitHub('failure', 'ci/sast', 'Semgrep found ERROR-severity findings — see build artifacts')
                    } else {
                        notifyGitHub('success', 'ci/sast', 'No high-severity findings')
                    }
                    env.SAST_REPORTED = 'true'
                }
            }
        }

        stage('Cleanup Previous CI Stacks') {
            steps {
                sh '''
                    echo "Checking for containers currently holding host port 18080..."
                    STALE_CONTAINERS=$(docker ps -aq --filter "publish=18080")
                    if [ -n "$STALE_CONTAINERS" ]; then
                        for c in $STALE_CONTAINERS; do
                            proj=$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$c" 2>/dev/null || true)
                            if [ -n "$proj" ] && [ "$proj" != "$PROJECT_NAME" ]; then
                                echo "Container $c (project: $proj) holds port 18080 — tearing down that project"
                                docker compose -p "$proj" ${COMPOSE_FILES} down -v || true
                            else
                                echo "Container $c has no resolvable compose project — removing directly"
                                docker rm -f "$c" || true
                            fi
                        done
                    else
                        echo "No stale containers holding port 18080."
                    fi
                '''
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

                    // zap-baseline.py: 0=pass, 1=warn, 2=fail-threshold reached
                    if (dastExit == 2) {
                        echo "DAST found findings — marking build UNSTABLE. See reports/dast-findings.json"
                        currentBuild.result = 'UNSTABLE'
                        notifyGitHub('failure', 'ci/dast', 'ZAP found fail-threshold findings — see build artifacts')
                    } else if (dastExit != 0 && dastExit != 1) {
                        notifyGitHub('error', 'ci/dast', 'ZAP scan errored unexpectedly')
                        env.DAST_REPORTED = 'true'
                        error("ZAP DAST scan failed unexpectedly (exit code ${dastExit})")
                    } else {
                        notifyGitHub('success', 'ci/dast', 'No fail-threshold findings')
                    }
                    env.DAST_REPORTED = 'true'
                }
            }
        }
         stage('Tear Down App') {
            steps {
                sh '''
                    cd "$WORKSPACE"
                    docker-compose down -v || true
                '''
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
            script { notifySlack("✅ chat-system-devsecops build #${BUILD_NUMBER} passed — no findings") }
            build job: 'king-phisher',
              wait: false
        }
        unstable {
            echo "Build unstable (scan findings only, no pipeline error) — tearing down CI stack '${PROJECT_NAME}'"
            sh 'cd "$WORKSPACE" && docker compose -p ${PROJECT_NAME} ${COMPOSE_FILES} down -v || true'
            sh 'docker rm -f "zap-scan-$BUILD_NUMBER" 2>/dev/null || true'
            script { notifySlack("⚠️ chat-system-devsecops build #${BUILD_NUMBER} UNSTABLE — scan findings present, check reports") }
            build job: 'king-phisher',
              wait: false       
        }
        failure {
            echo "Build failed — leaving stack '${PROJECT_NAME}' running for debugging."
            echo "Inspect with: docker compose -p ${PROJECT_NAME} ${COMPOSE_FILES} ps"
            echo "Tear down manually when done: docker compose -p ${PROJECT_NAME} ${COMPOSE_FILES} down -v"
            sh 'docker rm -f "zap-scan-$BUILD_NUMBER" 2>/dev/null || true'
            script {
                if (env.GIT_SHA) {
                    if (env.SECRETS_REPORTED != 'true') {
                        notifyGitHub('error', 'ci/secrets-scan', 'Skipped — earlier pipeline failure')
                    }
                    if (env.SAST_REPORTED != 'true') {
                        notifyGitHub('error', 'ci/sast', 'Skipped — earlier pipeline failure')
                    }
                    if (env.DAST_REPORTED != 'true') {
                        notifyGitHub('error', 'ci/dast', 'Skipped — earlier pipeline failure')
                    }
                }
                notifySlack("❌ chat-system-devsecops build #${BUILD_NUMBER} FAILED — pipeline error, check console output")
            }
        }
        always {
            echo "Pipeline finished with result: ${currentBuild.result ?: 'SUCCESS'}"
            sh 'cd "$WORKSPACE" && docker-compose down -v || true'
            sh 'docker rm -f "zap-scan-$BUILD_NUMBER" 2>/dev/null || true'
            script { recordFindingsRun(currentBuild.currentResult ?: 'SUCCESS') }
        }
    }
}