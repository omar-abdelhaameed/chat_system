pipeline {
    agent any

    // ── TODO: fill this in from:
    //   docker volume inspect jenkins_home --format '{{ .Mountpoint }}'
    // This is the HOST filesystem path backing jenkins_home. Sibling
    // containers (scanners) need to bind-mount FROM the host, not from
    // paths inside the Jenkins container — those paths don't exist on
    // the host's Docker daemon.
    environment {
        HOST_JENKINS_HOME   = '/REPLACE/ME/host/path/to/jenkins_home'
        PROJECT_NAME        = "chat-system-ci-${BUILD_NUMBER}"
        COMPOSE_FILES       = "-f docker-compose.yml -f docker-compose.ci.yml"
        REPORTS_DIR         = "reports"
    }

    triggers {
        githubPush()
    }

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
                sh 'mkdir -p ${REPORTS_DIR}'
            }
        }

        stage('Build Images') {
            steps {
                sh 'docker compose -p ${PROJECT_NAME} ${COMPOSE_FILES} build'
            }
        }

        stage('Deploy Stack') {
            steps {
                sh 'docker compose -p ${PROJECT_NAME} ${COMPOSE_FILES} up -d'
            }
        }

        stage('Wait for Healthy') {
            steps {
                script {
                    // Poll up to ~2 minutes for all healthchecked services to report healthy
                    timeout(time: 2, unit: 'MINUTES') {
                        waitUntil {
                            def unhealthy = sh(
                                script: '''
                                    docker compose -p ${PROJECT_NAME} ${COMPOSE_FILES} ps --format json \
                                    | grep -c '"Health":"unhealthy"\\|"Health":"starting"' || true
                                ''',
                                returnStdout: true
                            ).trim()
                            return unhealthy == "0"
                        }
                    }
                }
            }
        }

        stage('Secret Scan — Kingfisher') {
            steps {
                sh '''
                    docker run --rm \
                      -v ${HOST_JENKINS_HOME}/workspace/${JOB_NAME}:/src:ro \
                      -v ${WORKSPACE}/${REPORTS_DIR}:/reports \
                      ghcr.io/mongodb/kingfisher:latest scan /src \
                      --format json --output /reports/kingfisher.json
                '''
            }
        }

        stage('SAST — Semgrep') {
            steps {
                sh '''
                    docker run --rm \
                      -v ${HOST_JENKINS_HOME}/workspace/${JOB_NAME}:/src:ro \
                      -v ${WORKSPACE}/${REPORTS_DIR}:/reports \
                      semgrep:latest semgrep scan /src \
                      --config auto \
                      --json --output /reports/semgrep.json
                '''
            }
        }

        stage('DAST — OWASP ZAP') {
            steps {
                // Scanner joins the compose project's network directly and hits
                // nginx by its service DNS name — avoids relying on the host-published
                // 18080 port, which keeps this working even if that port mapping changes.
                sh '''
                    docker run --rm \
                      --network ${PROJECT_NAME}_default \
                      -v ${WORKSPACE}/${REPORTS_DIR}:/zap/wrk:rw \
                      zap:latest zap-baseline.py \
                      -t http://nginx:80 \
                      -J zap-report.json \
                      -r zap-report.html || true
                    # zap-baseline.py exits non-zero on findings by design —
                    // don't let that fail the stage; we gate on parsed severity instead.
                '''
            }
        }

        stage('Evaluate Findings') {
            steps {
                script {
                    def highOrCritical = sh(
                        script: '''
                            python3 - <<'PYEOF'
import json, glob, sys

fail = False
for f in glob.glob("reports/*.json"):
    try:
        data = json.load(open(f))
    except Exception:
        continue
    text = json.dumps(data).lower()
    if '"high"' in text or '"critical"' in text or '"error"' in text:
        fail = True
        print(f"Potential HIGH/CRITICAL finding in {f}")

sys.exit(1 if fail else 0)
PYEOF
                        ''',
                        returnStatus: true
                    )
                    if (highOrCritical != 0) {
                        error("Build failed: HIGH/CRITICAL findings detected — see reports/ artifacts")
                    }
                }
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
        }
        success {
            echo "Build passed — tearing down CI stack"
            sh 'docker compose -p ${PROJECT_NAME} ${COMPOSE_FILES} down -v'
        }
        failure {
            echo "Build failed — leaving stack '${PROJECT_NAME}' running for debugging."
            echo "Inspect with: docker compose -p ${PROJECT_NAME} ${COMPOSE_FILES} ps"
            echo "Tear down manually when done: docker compose -p ${PROJECT_NAME} ${COMPOSE_FILES} down -v"
        }
    }
}