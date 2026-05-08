#!/usr/bin/env bash
# Env-parametric wrapper for running this network-mcp checkout against a
# specific Payvaro environment (local / dev / prod / ...).
#
# Usage:
#   scripts/run-mcp.sh <env-name>
#
# Looks up "$HOME/.payvaro/network-mcp-<env-name>.env" and sources it BEFORE
# exec'ing the built MCP. The env file is the single source of truth for
# NETWORK_API_KEY, NETWORK_API_BASE_URL, NETWORK_CLIENT_ID, NETWORK_ADMIN_MODE,
# NETWORK_ENVIRONMENT, etc. Keep it outside the repo — never commit secrets.
#
# Companion to the payvaro-dev plugin's network-mcp-wrapper.sh, which targets
# the local stack. This wrapper is intended for ad-hoc remote-environment use:
# register one entry per env via `claude mcp add -s user network-mcp-<env> ...`.
set -euo pipefail

ENV_NAME="${1:-}"
if [[ -z "${ENV_NAME}" ]]; then
  echo "usage: $0 <env-name>" >&2
  echo "  e.g. $0 dev    (sources ~/.payvaro/network-mcp-dev.env)" >&2
  exit 64
fi

ENV_FILE="${HOME}/.payvaro/network-mcp-${ENV_NAME}.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "env file not found: ${ENV_FILE}" >&2
  echo "create it with at minimum:" >&2
  echo "  NETWORK_API_KEY=..." >&2
  echo "  NETWORK_API_BASE_URL=https://api.payvaro-dev.com/network" >&2
  exit 66
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

if [[ -z "${NETWORK_API_KEY:-}" ]]; then
  echo "NETWORK_API_KEY is empty after sourcing ${ENV_FILE}" >&2
  exit 78
fi
if [[ -z "${NETWORK_API_BASE_URL:-}" ]]; then
  echo "NETWORK_API_BASE_URL is empty after sourcing ${ENV_FILE}" >&2
  exit 78
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="${REPO_ROOT}/dist/index.js"
if [[ ! -f "${DIST}" ]]; then
  echo "dist not built — running 'npm run build' in ${REPO_ROOT}" >&2
  (cd "${REPO_ROOT}" && npm run build >&2)
fi

exec node "${DIST}"
