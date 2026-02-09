#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADDON_DIR="$(dirname "$SCRIPT_DIR")"
HELMCHARTS_DIR="$ADDON_DIR/helmcharts"
REPO_ROOT="$(cd "$ADDON_DIR/../.." && pwd)"

DEFAULT_NAMESPACE="sunbird"
DEFAULT_RELEASE_NAME="video-stream-generator"
GLOBAL_VALUES_FILE="$REPO_ROOT/terraform/azure/template/global-cloud-values.yaml"

if [ -f "$REPO_ROOT/terraform/gcp/template/global-cloud-values.yaml" ]; then
    GLOBAL_VALUES_FILE="$REPO_ROOT/terraform/gcp/template/global-cloud-values.yaml"
fi

NAMESPACE="${NAMESPACE:-$DEFAULT_NAMESPACE}"
RELEASE_NAME="${RELEASE_NAME:-$DEFAULT_RELEASE_NAME}"
ACTION="$1"
shift 2>/dev/null || true

while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--namespace) NAMESPACE="$2"; shift 2 ;;
        -r|--release) RELEASE_NAME="$2"; shift 2 ;;
        -f|--values) VALUES_FILE="$2"; shift 2 ;;
        *) shift ;;
    esac
done

if [ "$ACTION" = "install" ]; then
    cd "$HELMCHARTS_DIR/video-stream-generator"
    helm dependency update
    
    HELM_ARGS="-f $GLOBAL_VALUES_FILE"
    [ -n "$VALUES_FILE" ] && HELM_ARGS="$HELM_ARGS -f $VALUES_FILE"
    
    helm upgrade --install "$RELEASE_NAME" . --namespace "$NAMESPACE" $HELM_ARGS --wait --timeout 10m
    
    echo "Video Stream Generator deployed successfully"

elif [ "$ACTION" = "uninstall" ]; then
    helm uninstall "$RELEASE_NAME" --namespace "$NAMESPACE"
    echo "Video Stream Generator uninstalled"
else
    echo "Usage: $0 [install|uninstall] [-n namespace] [-r release] [-f values-file]"
    exit 1
fi
