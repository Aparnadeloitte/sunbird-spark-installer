# Video Stream Generator Addon

## Prerequisites

- `helm` 3.x installed
- `kubectl` configured and connected to cluster
- OpenTofu has been run (generates global-cloud-values.yaml)

## Checklist

- [ ] Running Sunbird cluster
- [ ] Media service configured (Azure Media Services or AWS Elemental MediaConvert)

## Quick Installation

```bash
cd addons/video-stream-generator
./script/manage.sh install
```

**That's it!** The script automatically:
- Uses namespace `sunbird`
- Loads all configuration from terraform output
- Configures all service endpoints

## Verify Installation

```bash
# Check pod status
kubectl get pods -n sunbird -l app.kubernetes.io/name=video-stream-generator

# Check logs
kubectl logs -n sunbird -l app.kubernetes.io/name=video-stream-generator -f
```

## Uninstallation

```bash
./script/manage.sh uninstall
```
