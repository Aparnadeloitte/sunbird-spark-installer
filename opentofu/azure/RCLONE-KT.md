# KT Document: rclone in `opentofu/azure/`

## Overview

rclone appears in the Azure OpenTofu setup in **two distinct roles**:

| Role | Location | Purpose |
|---|---|---|
| Config backup | `opentofu/azure/template/install.sh:16` | Protect pre-existing rclone config on the operator's machine |
| Config template | `opentofu/azure/modules/upload-files/config.tfpl` | Declarative rclone config for Azure Blob, prepared but not actively used at runtime |

> **Important:** Actual blob transfers in the Azure setup do **not** use rclone at runtime — they use `azcopy` and `az storage` CLI. rclone is listed as a required tool because the GCP path uses it actively, and the config template is prepared for future use or alternate deployment paths.

---

## 1. Config Backup — `install.sh`

**File:** `opentofu/azure/template/install.sh` (lines 10–18)

```bash
function backup_configs() {
    timestamp=$(date +%d%m%y_%H%M%S)
    mkdir -p ~/.kube
    mv ~/.kube/config ~/.kube/config.$timestamp || true
    mkdir -p ~/.config/rclone
    mv ~/.config/rclone/rclone.conf ~/.config/rclone/rclone.conf.$timestamp || true
    export KUBECONFIG=~/.kube/config
}
```

**When it runs:** Called as the very first step in the full `./install.sh` (no-arg mode), before `create_tf_resources`.

**What it does:**
- Creates `~/.config/rclone/` if it does not exist
- Renames any existing `rclone.conf` to `rclone.conf.<timestamp>` (e.g., `rclone.conf.050526_143201`)
- `|| true` makes the rename non-fatal — if no conf exists, the script continues silently
- Prevents the installer from overwriting an operator's pre-existing rclone credentials

**Why it matters:** An operator running the installer on an Azure VM or local machine may already have rclone configured for other purposes. Without this backup, any subsequent step that writes a new `rclone.conf` would silently destroy their existing config.

---

## 2. rclone Config Template — `modules/upload-files/config.tfpl`

**File:** `opentofu/azure/modules/upload-files/config.tfpl`

```ini
[ownaccount]
type = azureblob
account = ${storage_account_name}
env_auth = true
# Uses DefaultAzureCredential chain for authentication
# Picks up: Azure CLI (az login), environment variables, managed identity, etc.
# AZURE_CLIENT_ID env var helps select the specific managed identity
# Developer must run: az login before tofu apply

[sunbird]
type = azureblob
account = ${sunbird_public_artifacts_account}
sas_url = ${sunbird_public_artifacts_account_sas_url}
```

This is a Terraform template file (`.tfpl`). The `${...}` variables are substituted by OpenTofu at `terragrunt apply` time with real values.

### Template Variables

| Variable | Source | Description |
|---|---|---|
| `${storage_account_name}` | Output of `storage` module | Your deployment's Azure Blob storage account name |
| `${sunbird_public_artifacts_account}` | `variables.tf` default: `downloadableartifacts` | Sunbird's public release artifacts account |
| `${sunbird_public_artifacts_account_sas_url}` | `variables.tf` default: pre-signed URL valid until 2030-12-31 | Read-only SAS token for Sunbird public account |

### The Two rclone Remotes Explained

**`[ownaccount]`** — Your own Azure Blob Storage
- Auth method: `env_auth = true` → uses the DefaultAzureCredential chain
- Resolution order: Azure CLI (`az login`) → Environment variables (`AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`) → Managed Identity (on AKS/VM)
- The operator must have run `az login` before `tofu apply`, OR the process runs under a managed identity

**`[sunbird]`** — Sunbird's public release artifacts store
- Auth method: `sas_url` → SAS (Shared Access Signature) token embedded in the URL
- Read-only access to the `release700` container (default)
- The default SAS URL in `variables.tf` expires 2030-12-31

---

## 3. The `upload-files` Module — What Actually Runs

**File:** `opentofu/azure/modules/upload-files/main.tf`

Despite rclone being configured via the template, the actual data movement at runtime uses `azcopy` and `az storage` CLI:

### Step 1: Copy Sunbird public artifacts → your storage account

```hcl
resource "null_resource" "copy_from_sunbird_container" {
  provisioner "local-exec" {
    command = <<EOT
      AZCOPY_AUTO_LOGIN_TYPE=AZCLI azcopy copy \
        "https://downloadableartifacts.blob.core.windows.net/release700/*?<sas_token>" \
        "https://<your_account>.blob.core.windows.net/<public_container>" \
        --recursive \
        --exclude-path ".terragrunt-source-manifest"
    EOT
  }
}
```

**What this does:** Copies the entire Sunbird `release700` container (fonts, form configs, content assets, player assets) from Sunbird's public account into your deployment's public container. `AZCOPY_AUTO_LOGIN_TYPE=AZCLI` means azcopy authenticates using your active `az login` session — no separate credentials needed.

### Step 2: Upload SunbirdRC credential schemas

```hcl
resource "null_resource" "upload_rc_schemas_to_public_blob" {
  provisioner "local-exec" {
    command = "az storage blob upload-batch \
      --account-name <your_account> \
      --destination <public_container>/schemas \
      --source <path>/sunbird-rc/schemas \
      --auth-mode login"
  }
  depends_on = [local_file.output_files]
}
```

**What this does:** Uploads two credential schema JSON files (`credential_template.json` and `project_credential_template.json`) into the `schemas/` prefix of your public container. Before upload, OpenTofu renders the templates and injects the actual storage account URL into the `cloud_storage_schema_url` field inside the JSON files.

---

## 4. Storage Module — What Gets Created

**File:** `opentofu/azure/modules/storage/main.tf`

The `storage` module provisions all Azure Blob infrastructure that `upload-files` operates on:

```
Storage Account: <building_block><environment><subscription_prefix>
  ├── Public container:  <bb>-<env>-public-<uuid>   (access: blob / public read)
  ├── Private container: <bb>-<env>-private-<uuid>  (access: private)
  └── Velero container:  <bb>-<env>-velero-private-<uuid> (access: private)
```

| Container | Access | Purpose |
|---|---|---|
| `<bb>-<env>-public-<uuid>` | `blob` (public read) | Stores Sunbird artifacts, RC schemas, content assets — publicly readable by the platform |
| `<bb>-<env>-private-<uuid>` | `private` | Stores generated `global-cloud-values.yaml`, config backups |
| `<bb>-<env>-velero-private-<uuid>` | `private` | Velero Kubernetes backup storage |

The storage account name is deterministic:
- Pattern: `{building_block}{environment}{first-segment-of-subscription-id}`
- Example: `sparkdev<sub_prefix>`

---

## 5. Module Wiring — How It All Connects

```
_common/upload-files.hcl
  └── depends on: ../storage          (outputs: storage_account_name, storage_container_public)
  └── source: ../../modules//upload-files/
```

**Dependency chain (Terragrunt module execution order):**

```
network → storage → upload-files
                  → workload-identity
                  → output-file
```

**`_common/upload-files.hcl`** wires the storage outputs into the upload-files module:

```hcl
dependency "storage" {
    config_path = "../storage"
}

inputs = {
  storage_account_name     = dependency.storage.outputs.azurerm_storage_account_name
  storage_container_public = dependency.storage.outputs.azurerm_storage_container_public
}
```

The Sunbird source account/container/SAS variables are not wired here — they come from defaults in `variables.tf` and can be overridden per environment if needed.

---

## 6. `global-cloud-values.yaml` — The Bridge Between OpenTofu and Helm

After provisioning, the `output-file` module generates `global-cloud-values.yaml` using `modules/output-file/global-cloud-values.yaml.tfpl`. This file is what all `helm upgrade --install` calls pick up (as the last values file in the layering order).

Relevant storage-related values it contains:

```yaml
global:
  cloud_storage_access_key: <storage_account_name>
  public_container_name: <public_container>
  private_container_name: <private_container>
  object_storage_endpoint: <storage_account_name>.blob.core.windows.net
  cloud_storage_auth_type: "OIDC"
  azure_client_id: <workload_identity_client_id>
```

This tells services like Lern, KnowledgeBB, Flink, and the Player portal exactly which Azure Blob account and containers to read/write content to. The file is also uploaded to the private container:

```hcl
resource "null_resource" "upload_global_cloud_values_yaml" {
  provisioner "local-exec" {
    command = "az storage blob upload \
      --account-name <storage_account_name> \
      --container-name <private_container> \
      --file global-cloud-values.yaml \
      --name <environment>-global-cloud-values.yaml \
      --overwrite"
  }
}
```

---

## 7. Why rclone Is a Required Tool Despite Not Running for Azure

From `CLAUDE.md` and `README.md`:
> Required CLI Tools: `jq`, `yq`, `rclone`, `openssl`, `kubectl`, `helm`, ...

Three reasons rclone is still required:

1. **GCP path uses rclone actively** — The GCP `install.sh` follows the same `backup_configs()` pattern, and the GCP `upload-files` module uses rclone for GCS operations (Google Cloud Storage has no equivalent of azcopy).
2. **Config template is prepared** — `config.tfpl` exists and is rendered. If a future step sources it, rclone commands against `[ownaccount]` and `[sunbird]` would work immediately without additional setup.
3. **Addons may use it** — The `dial` addon provisions additional cloud storage and may rely on rclone for cross-cloud sync scenarios.

---

## 8. End-to-End Flow Summary

```
./install.sh
  │
  ├─ backup_configs()
  │    └── mv ~/.config/rclone/rclone.conf → rclone.conf.<timestamp>
  │         (rclone itself is not invoked — only its config file is protected)
  │
  ├─ create_tf_resources()         (terragrunt run --all apply)
  │    │
  │    ├─ storage module
  │    │    └── Creates: Storage Account + public / private / velero containers
  │    │
  │    ├─ upload-files module
  │    │    ├─ azcopy copy          Sunbird release700/* → your public container
  │    │    └─ az blob upload-batch RC schemas/ → your public container/schemas/
  │    │         (rclone config.tfpl is rendered here but not executed)
  │    │
  │    └─ output-file module
  │         ├─ Renders global-cloud-values.yaml (with storage account name, containers, etc.)
  │         └─ az blob upload      global-cloud-values.yaml → your private container
  │
  └─ install_helm_components()
       └─ helm upgrade --install ... -f global-cloud-values.yaml
            (all services now know the storage account and container names)
```

---

## 9. Key Files Reference

| File | Role |
|---|---|
| `opentofu/azure/template/install.sh` (lines 10–18) | `backup_configs()` — backs up `~/.config/rclone/rclone.conf` |
| `opentofu/azure/modules/upload-files/config.tfpl` | rclone config template (two remotes: `ownaccount`, `sunbird`) |
| `opentofu/azure/modules/upload-files/main.tf` | Actual blob operations using `azcopy` and `az storage` CLI |
| `opentofu/azure/modules/upload-files/variables.tf` | Sunbird public account name, SAS URL, container name (with defaults) |
| `opentofu/azure/modules/storage/main.tf` | Creates the Azure Storage Account + 3 containers |
| `opentofu/azure/modules/storage/outputs.tf` | Exports account name and container names to dependent modules |
| `opentofu/azure/_common/upload-files.hcl` | Terragrunt wiring — passes `storage` outputs into `upload-files` |
| `opentofu/azure/_common/storage.hcl` | Terragrunt wiring for `storage` module |
| `opentofu/azure/modules/output-file/global-cloud-values.yaml.tfpl` | Helm values template populated with storage account details |
| `opentofu/azure/modules/output-file/main.tf` | Generates and uploads `global-cloud-values.yaml` |

---

## 10. Quick Reference: rclone Remote Config Values

After `terragrunt apply`, if the config were written to `~/.config/rclone/rclone.conf`, it would look like:

```ini
[ownaccount]
type = azureblob
account = sparkdev<subscription_prefix>     # your storage account
env_auth = true                             # use az login / managed identity

[sunbird]
type = azureblob
account = downloadableartifacts             # Sunbird public artifacts account
sas_url = https://downloadableartifacts.blob.core.windows.net/?se=2030-12-31T23%3A59%3A00Z&sp=rxlft&...
```

To use these remotes manually (e.g., for debugging):

```bash
# List Sunbird release artifacts
rclone ls sunbird:release700

# List your public container
rclone ls ownaccount:<public_container_name>

# Copy a specific file from Sunbird to your container
rclone copy sunbird:release700/some-asset ownaccount:<public_container_name>/
```
