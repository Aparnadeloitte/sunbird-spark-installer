# Sunbird Addons

## Overview

Addons are optional services that can be deployed to an existing Sunbird cluster to extend its functionality. Each addon is independently deployable and manageable.

## Available Addons

### DIAL Service

QR code generation and management service for learning content.

**Documentation**: [addons/dial/README.md](dial/README.md)

**Quick Install**:
```bash
cd addons/dial
./script/manage.sh install
```

### Video Stream Generator

Flink job for video streaming and media processing.

**Documentation**: [addons/video-stream-generator/README.md](video-stream-generator/README.md)

**Quick Install**:
```bash
cd addons/video-stream-generator
./script/manage.sh install
```

## General Usage

All addons follow a similar pattern:

1. Navigate to the addon directory
2. Run `./script/manage.sh install`
3. Verify deployment with `kubectl get pods -n sunbird`

For detailed installation instructions, troubleshooting, and configuration options, refer to each addon's README file.
