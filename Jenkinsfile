
pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        skipDefaultCheckout(true)

        timeout(time: 30, unit: 'MINUTES')

        buildDiscarder(
            logRotator(
                numToKeepStr: '20',
                artifactNumToKeepStr: '20'
            )
        )
    }

    environment {
        COMPOSE_PROJECT_NAME = "chat-system-ci-${BUILD_NUMBER}"
        COMPOSE_FILES        = "-f docker-compose.yml -f docker-compose.ci.yml"

        APP_HOST_PORT        = "18080"

        DAST_TARGET          = "http://nginx"

        KINGFISHER_IMAGE = "ghcr.io/mongodb/kingfisher:latest"
        SEMGREP_IMAGE    = "semgrep/semgrep:latest"
        ZAP_IMAGE        = "zaproxy/zap-stable:latest"

        REPORT_DIR = "reports"
    }

    stages {

        stage('Checkout') {
            steps {
                deleteDir()

                checkout scm

                sh '''
                    set -eu

                    echo "========================================="
                    echo "Repository"
                    echo "========================================="

                    git rev-parse --show-toplevel
                    git rev-parse HEAD
                    git log -1 --oneline
                '''
            }
        }


        stage('Prepare Workspace') {
            steps {
                sh '''
                    set -eu

                    rm -rf "${REPORT_DIR}"

                    mkdir -p \
                        "${REPORT_DIR}/secrets" \
                        "${REPORT_DIR}/sast" \
                        "${REPORT_DIR}/dast"

                    echo "Workspace:"
                    pwd

                    echo
                    echo "Report directories:"
                    find "${REPORT_DIR}" -maxdepth 2 -type d -print
                '''
            }
        }


        stage('Static Security Analysis') {

            parallel {

                stage('Kingfisher - Secrets') {
    steps {
        sh '''
            set -eu

           
            echo "Jenkins workspace: ${WORKSPACE}"

            test -d "${WORKSPACE}"

            docker run --rm \
                --user root \
                --volumes-from "$HOSTNAME" \
                "${KINGFISHER_IMAGE}" \
                scan "${WORKSPACE}" \
                -f json \
                -o "${WORKSPACE}/${REPORT_DIR}/secrets/kingfisher.json"

            test -f "${WORKSPACE}/${REPORT_DIR}/secrets/kingfisher.json"

            echo "Kingfisher report generated:"
            ls -lh "${WORKSPACE}/${REPORT_DIR}/secrets/kingfisher.json"
        '''
    }
}


                stage('Semgrep - SAST') {
                    steps {
                        sh '''
                            set -eu

                            echo "Running Semgrep..."

                            docker run --rm \
                                -v "$PWD:/src:ro" \
                                -v "$PWD/${REPORT_DIR}/sast:/reports" \
                                "${SEMGREP_IMAGE}" \
                                semgrep scan \
                                --config auto \
                                --json \
                                --output /reports/semgrep.json \
                                /src
                        '''
                    }
                }


                stage('Application Tests') {
                    steps {
                        sh '''
                            set -eu

                            echo "Application test stage"

                            if [ -f "backend/requirements.txt" ]; then
                                echo "Backend requirements detected."
                            fi

                            if [ -f "backend/pytest.ini" ] || \
                               [ -f "backend/pyproject.toml" ] || \
                               [ -d "backend/tests" ]; then

                                echo "Python test configuration detected."

                                docker run --rm \
                                    -v "$PWD/backend:/workspace" \
                                    -w /workspace \
                                    python:3.12-slim \
                                    sh -c '
                                        set -eu
                                        if [ -f requirements.txt ]; then
                                            pip install --no-cache-dir -r requirements.txt
                                        fi

                                        if command -v pytest >/dev/null 2>&1; then
                                            pytest
                                        else
                                            echo "pytest is not installed; skipping."
                                        fi
                                    '
                            else
                                echo "No backend pytest configuration detected."
                                echo "Skipping application tests for this build."
                            fi
                        '''
                    }
                }
            }
        }


        stage('Deploy CI Environment') {
            steps {
                sh '''
                    set -eu

                    echo "Compose project: ${COMPOSE_PROJECT_NAME}"

                    docker compose \
                        ${COMPOSE_FILES} \
                        -p "${COMPOSE_PROJECT_NAME}" \
                        up -d --build

                    echo
                    echo "Compose services:"
                    docker compose \
                        ${COMPOSE_FILES} \
                        -p "${COMPOSE_PROJECT_NAME}" \
                        ps
                '''
            }
        }


        stage('Health Check') {
            steps {
                sh '''
                    set -eu

                    echo "Waiting for application..."

                    timeout 120 sh -c '
                        until docker compose \
                            ${COMPOSE_FILES} \
                            -p "${COMPOSE_PROJECT_NAME}" \
                            ps --status running | grep -q nginx;
                        do
                            sleep 3
                        done
                    '

                    echo "Checking application through Nginx..."

                    docker run --rm \
                        --network "${COMPOSE_PROJECT_NAME}_default" \
                        curlimages/curl:latest \
                        curl \
                        --fail \
                        --silent \
                        --show-error \
                        --max-time 10 \
                        "${DAST_TARGET}/"

                    echo
                    echo "Application is reachable."
                '''
            }
        }


        stage('DAST - OWASP ZAP') {
            steps {
                script {

                    int zapStatus = sh(
                        script: '''
                            set +e

                            echo "Running OWASP ZAP baseline scan..."
                            echo "Target: ${DAST_TARGET}"

                            docker run --rm \
                                --network "${COMPOSE_PROJECT_NAME}_default" \
                                -v "$PWD/${REPORT_DIR}/dast:/zap/wrk:rw" \
                                "${ZAP_IMAGE}" \
                                zap-baseline.py \
                                -t "${DAST_TARGET}" \
                                -r zap-report.html \
                                -J zap-report.json \
                                -x zap-report.xml \
                                -I

                            status=$?

                            echo "ZAP exit code: ${status}"

                            exit "${status}"
                        ''',
                        returnStatus: true
                    )

                    if (zapStatus == 3) {
                        error("ZAP encountered a scan/runtime error.")
                    }

                    if (zapStatus == 1) {
                        unstable("ZAP reported FAIL-level findings.")
                    }

                    if (zapStatus == 2) {
                        unstable("ZAP reported WARN-level findings.")
                    }

                    echo "ZAP scan completed with status ${zapStatus}."
                }
            }
        }


        stage('Security Report Summary') {
            steps {
                sh '''
                    set +e

                    echo
                    echo "========================================="
                    echo "SECURITY REPORTS"
                    echo "========================================="

                    find "${REPORT_DIR}" \
                        -type f \
                        -printf "%p (%s bytes)\\n" \
                        | sort

                    echo
                    echo "Kingfisher report:"
                    if [ -f "${REPORT_DIR}/secrets/kingfisher.json" ]; then
                        python3 -m json.tool \
                            "${REPORT_DIR}/secrets/kingfisher.json" \
                            | head -40
                    fi

                    echo
                    echo "Semgrep report:"
                    if [ -f "${REPORT_DIR}/sast/semgrep.json" ]; then
                        python3 -m json.tool \
                            "${REPORT_DIR}/sast/semgrep.json" \
                            | head -40
                    fi
                '''
            }
        }
    }

    post {

        always {
            archiveArtifacts(
                artifacts: 'reports/**/*',
                allowEmptyArchive: true,
                fingerprint: true
            )

            junit(
                testResults: 'reports/**/*.xml',
                allowEmptyResults: true
            )

            echo "Security reports archived."
        }


        cleanup {
            sh '''
                set +e

                echo "Cleaning CI environment..."

                docker compose \
                    ${COMPOSE_FILES} \
                    -p "${COMPOSE_PROJECT_NAME}" \
                    down \
                    --remove-orphans

                echo "CI environment removed."
            '''
        }
    }
}
