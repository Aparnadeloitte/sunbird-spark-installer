# OpenTofu Azure Changelog — April 13–30, 2026

Changes to `opentofu/azure/` merged to `main` between Apr 13 and Apr 30, 2026.

---

## 1. AKS Network Plugin: Kubenet → Azure CNI with Overlay

**Commits:** `d66e2af` (Apr 14), `5ceee49` (Apr 14)  
**Author:** divyag@sanketika.in

### What Changed

Two back-to-back commits on Apr 14 switched the AKS cluster from the legacy Kubenet network plugin to Azure CNI with overlay mode.

**`opentofu/azure/modules/aks/main.tf`** — `network_profile` block gained `network_plugin_mode = "overlay"`:

```hcl
# Before
network_profile {
  network_plugin = var.network_plugin
  service_cidr   = var.service_cidr
  dns_service_ip = var.dns_service_ip
}

# After
network_profile {
  network_plugin      = var.network_plugin
  network_plugin_mode = "overlay"
  service_cidr        = var.service_cidr
  dns_service_ip      = var.dns_service_ip
}
```

**`opentofu/azure/modules/aks/variables.tf`** — the `network_plugin` variable default was changed from `"kubenet"` to `"azure"`:

```hcl
# Before
default = "kubenet"

# After
default = "azure"
```

### Why It Matters

Kubenet is a simpler plugin where each node gets a /24 and pods receive IP addresses via NAT. Azure CNI assigns each pod a real VNet IP, which is required for advanced features like network policies, private cluster egress controls, and direct pod-to-pod routing without NAT. Overlay mode is Azure CNI's scalability improvement — pods still get real IPs from an overlay address space but without consuming a VNet IP per pod, removing the historical "run out of IPs" problem that made Azure CNI impractical on large clusters. This change is a **breaking change for existing clusters** — the network plugin cannot be updated in-place; it requires cluster recreation.

---

## 2. Workload Identity: Activate Kubernetes Namespace Creation

**Commit:** `645844d` (Apr 14)  
**Author:** divyag@sanketika.in

### What Changed

The `kubernetes_namespace` resource block in the workload-identity module was uncommented, enabling OpenTofu to manage Kubernetes namespaces as part of infrastructure provisioning.

**`opentofu/azure/modules/workload-identity/main.tf`**:

```hcl
# Before (commented out)
# resource "kubernetes_namespace" "namespaces" {
#   for_each = toset(var.k8s_namespaces)
#   metadata {
#     name = each.value
#   }
# }

# After (active)
resource "kubernetes_namespace" "namespaces" {
  for_each = toset(var.k8s_namespaces)
  metadata {
    name = each.value
  }
}
```

### Why It Matters

Previously, Kubernetes namespaces had to be created manually (or by the Helm install phase) before workload identity service accounts could be bound to them. Making this a managed resource means `terragrunt run --all apply` now creates all required namespaces as part of the `workload-identity` module — before any Helm charts run. This eliminates a class of race-condition failures where the namespace did not exist when a federated credential was being configured.

---

## 3. Federated Identity Credential: Remove Redundant `resource_group_name`

**Commit:** `3eb4c3f` (Apr 17)  
**Author:** shashankp@sanketika.in

### What Changed

The `resource_group_name` attribute was removed from the `azurerm_federated_identity_credential` resource. It is not a valid argument for this resource type in the AzureRM provider (the parent managed identity already determines the resource group via `parent_id`).

**`opentofu/azure/modules/workload-identity/main.tf`**:

```hcl
# Before
resource "azurerm_federated_identity_credential" "workload_identity" {
  for_each = var.k8s_service_accounts

  name                = "${local.environment_name}-${each.key}-federated-cred"
  resource_group_name = var.resource_group_name       # invalid argument
  parent_id           = azurerm_user_assigned_identity.workload_identity.id
  audience            = ["api://AzureADTokenExchange"]
  ...
}

# After
resource "azurerm_federated_identity_credential" "workload_identity" {
  for_each = var.k8s_service_accounts

  name      = "${local.environment_name}-${each.key}-federated-cred"
  parent_id = azurerm_user_assigned_identity.workload_identity.id
  audience  = ["api://AzureADTokenExchange"]
  ...
}
```

### Why It Matters

Passing `resource_group_name` to `azurerm_federated_identity_credential` causes a provider-level validation error in newer versions of the AzureRM provider. Removing it makes the resource declaration correct and provider-version agnostic.

---

## 4. Storage Module Refactor: Remove Storage Account Access Key

**Commits:** `576d68d` (Apr 16), `d6cadd05` (Apr 24)  
**Author:** shashankp@sanketika.in

### What Changed

Across two commits, the storage account's primary access key was removed from outputs, the generated `global-cloud-values.yaml` template, and all downstream input wiring. An intermediate iteration (commit `576d68d`) introduced a `skip_storage_module` bypass path reading from an existing `global-cloud-values.yaml`; this was reverted in `d6cadd05` to keep the storage dependency unconditional.

**Removed output** — `opentofu/azure/modules/storage/outputs.tf`:
```hcl
# Removed entirely
output "azurerm_storage_account_key" {
  value     = azurerm_storage_account.storage_account.primary_access_key
  sensitive = true
}
```

**Removed from generated config file** — `opentofu/azure/modules/output-file/global-cloud-values.yaml.tfpl`:
```yaml
# Before
cloud_storage_access_key: ${azure_storage_account_name}
cloud_storage_secret_key: ${azure_storage_account_key}   # removed

# After
cloud_storage_access_key: ${azure_storage_account_name}
```

**Removed variable** — `opentofu/azure/modules/output-file/variables.tf`:
```hcl
# Removed entirely
variable "storage_account_primary_access_key" {
  type        = string
  description = "Storage account primary access key."
  default     = ""
}
```

**Removed from mock outputs** — `opentofu/azure/_common/output-file.hcl`:
```hcl
# Removed from mock_outputs block
azurerm_storage_account_key = "dummy-key"
```

**Final state of `output-file.hcl` inputs** (after both commits):
```hcl
storage_account_name     = dependency.storage.outputs.azurerm_storage_account_name
storage_container_public = dependency.storage.outputs.azurerm_storage_container_public
storage_container_private = dependency.storage.outputs.azurerm_storage_container_private
```

### Why It Matters

Storing the storage account primary access key in the generated `global-cloud-values.yaml` file was a security risk — that file is written to disk inside the environment directory and could be accidentally committed to version control. Azure Blob access for the workload identity now relies on Azure RBAC (the `blob_operator_least_privilege` role definition), making the access key unnecessary for runtime operations. This is the correct model for key-less access in AKS workloads using managed identities.

---

## 5. Workload Identity Role Assignment Cleanup

**Commits:** `ae2bf60f` (Apr 27), `79d08751` (Apr 28), `1f98bedf` (Apr 28), `4ff3ef63` (Apr 28)  
**Author:** shashankp@sanketika.in

### What Changed

A sequence of four commits cleaned up the role assignment model for the workload identity module, removing the deployer-specific blob role assignment and the propagation sleep timer that depended on it.

**Commit `ae2bf60f`** — Removed the `deployer_blob_containers` role assignment and rewired the propagation sleep to depend on the workload identity role instead:

```hcl
# Removed: deployer-specific blob data plane access
resource "azurerm_role_assignment" "deployer_blob_containers" {
  for_each             = toset(var.container_names)
  principal_id         = data.azurerm_client_config.current.object_id
  scope                = "${var.storage_account_id}/blobServices/default/containers/${each.value}"
  role_definition_id   = azurerm_role_definition.blob_operator_least_privilege.role_definition_resource_id
}

# time_sleep now depends on workload_identity_containers instead
resource "time_sleep" "wait_for_deployer_role_propagation" {
  create_duration = "60s"
  depends_on      = [azurerm_role_assignment.workload_identity_containers]  # was: deployer_blob_containers
}
```

**Commit `79d08751`** — Removed the `time` provider dependency entirely and deleted the `time_sleep` resource and `deployer_role_ready` output:

```hcl
# Removed provider block
time = {
  source  = "hashicorp/time"
  version = "~> 0.9"
}

# Removed resource
resource "time_sleep" "wait_for_deployer_role_propagation" { ... }

# Removed output
output "deployer_role_ready" { ... }
```

**Commits `1f98bedf` and `4ff3ef63`** — Removed the `workload_identity` dependency block (and its mock outputs) from both `keys.hcl` and `upload-files.hcl`. Previously, these modules depended on workload-identity to gate on the `deployer_role_ready` signal. Since the sleep timer is gone, the dependency is no longer needed:

```hcl
# Removed from both _common/keys.hcl and _common/upload-files.hcl
dependency "workload_identity" {
  config_path = "../workload-identity"
}
```

### Why It Matters

The original design gave the deployer identity (the service principal running `tofu apply`) direct `Storage Blob Data` role on each container, then used a 60-second `time_sleep` to let the RBAC propagate before downstream modules tried to use those permissions. This was fragile for two reasons: (1) it added a 60-second forced wait on every `apply`, and (2) it gave the deployer identity data-plane blob access that it doesn't need. Blob uploads during install now use the workload identity path (managed identity RBAC), which is already correctly gated by the `workload_identity_containers` role assignment. Removing the deployer blob role eliminates unnecessary privilege escalation.

---

## 6. Kubernetes Version Pinning for AKS (and Subsequent Revert)

**Commits:** `96f70ae5` (Apr 27), `53cb650b` (Apr 28), `f682c73d` (Apr 28), `a32a6e6c` (Apr 28)  
**Author:** shashankp@sanketika.in

### What Changed

This sequence is best read as a failed attempt to surface `aks_version` as an operator-controlled field in `global-values.yaml`, which was ultimately reverted. The net result across all four commits is that AKS cluster version pinning via `kubernetes_version` in `main.tf` was **removed entirely** — the cluster now uses Azure's automatic version selection.

**Timeline of changes:**

| Commit | Change |
|--------|--------|
| `96f70ae5` | Added `aks_version = local.global_vars.global.aks_version` to `aks.hcl` inputs; made `aks_version` variable in `variables.tf` required (no default); added `aks_version: "1.33"` to `global-values.yaml` template |
| `53cb650b` | Softened the `aks.hcl` input to `try(local.global_vars.global.aks_version, null)` to handle environments without the key |
| `f682c73d` | Reverted `aks.hcl` (removed the `aks_version` input line); restored the `default = "1.33.6"` on the variable; removed `aks_version` from `global-values.yaml` template |
| `a32a6e6c` | Removed `kubernetes_version = var.aks_version` from `main.tf` and deleted the `aks_version` variable from `variables.tf` entirely |

**Net state after all four commits** in `opentofu/azure/modules/aks/main.tf`:
```hcl
resource "azurerm_kubernetes_cluster" "aks" {
  location            = var.location
  resource_group_name = var.resource_group_name
  dns_prefix          = "${local.environment_name}"
  # kubernetes_version is absent — Azure selects the default supported version
  ...
}
```

### Why It Matters

When `kubernetes_version` is omitted from the AKS resource, Azure deploys the cluster at whatever version it currently considers the default stable release. This avoids hard-coded version strings becoming stale, but it also means the Kubernetes version can shift between deployments. Operators who need a specific version (e.g., for compatibility with a specific Helm chart or add-on) will need to add `kubernetes_version` back to `main.tf` manually and pin it to an output of `az aks get-versions --location <region> --output table`.

---

## 7. Postman Environment: Add Google OAuth Client ID

**Commit:** `a55cc5ce` (Apr 15)  
**Author:** shashankp@sanketika.in

### What Changed

The `generate_postman_env` function in `install.sh` now reads the Google OAuth client ID from the cluster and injects it into the generated `env.json` file for Postman collection runs.

**`opentofu/azure/template/install.sh`** — new line added to variable extraction and `sed` substitution:
```bash
google_oauth_client_id=$(kubectl get cm -n sunbird player-env \
  -ojsonpath='{.data.GOOGLE_OAUTH_CLIENT_ID}')
...
-e "s|REPLACE_WITH_GOOGLE_OAUTH_CLIENT_ID|${google_oauth_client_id}|g" \
```

**`opentofu/azure/template/postman.env.json`** — new entry added to the environment variables array:
```json
{
  "key": "google_oauth_client_id",
  "value": "REPLACE_WITH_GOOGLE_OAUTH_CLIENT_ID",
  "type": "default",
  "enabled": true
}
```

### Why It Matters

Post-install API tests that exercise Google OAuth sign-in flows (e.g., social login validation in the Postman collection) require the OAuth client ID to be present in the Postman environment. Previously this had to be manually added to `env.json` after generation; now it is pulled automatically from the `player-env` ConfigMap.

---

## 8. Postman Collection Run: Switch to Versioned Collection File

**Commit:** `a21ec1b3` (Apr 20)  
**Author:** jeraldj@sanketika.in

### What Changed

The `run_post_install` function in `install.sh` was updated to use a fixed filename instead of a `${RELEASE}`-variable filename for the Postman collection.

**`opentofu/azure/template/install.sh`**:
```bash
# Before
cp ../../../postman-collection/collection${RELEASE}.json .
postman collection run collection${RELEASE}.json --environment env.json --delay-request 500 --bail --insecure

# After
cp ../../../postman-collection/sunbird-spark-collection-v1.json .
postman collection run sunbird-spark-collection-v1.json --environment env.json --delay-request 500 --bail --insecure
```

### Why It Matters

The previous pattern required a `$RELEASE` environment variable to be set correctly, failing silently with a "file not found" copy error if the variable was wrong or unset. The new fixed name `sunbird-spark-collection-v1.json` is explicit and version-controlled — the collection file lives at that path in the repo. Version bumps to the collection will be handled by updating this filename.

---

## 9. Azure README Rewrite

**Commit:** `48f5901b` (Apr 24)  
**Author:** shashankp@sanketika.in

### What Changed

`opentofu/azure/README.md` was substantially rewritten — reduced from 52 lines to 44 lines but with significantly more structured and accurate content. The old README contained a raw dump of `global-values.yaml` fields with no context. The new README:

- States clearly that no manual Azure resource creation is needed
- Documents both deployment approaches (GitHub Actions OIDC and Azure VM managed identity)
- Provides a structured table of what OpenTofu provisions (AKS, VNet, Storage, Key Vault, Managed Identity, state backend)
- Documents the most important `global-values.yaml` fields as a reference table with descriptions
- Adds a note about Let's Encrypt SSL (`lets_encrypt_ssl: true`) as an alternative to providing a manual cert

---

## 10. Asset Enrichment Addon

**Commits:** `c5eebe31` (Apr 29), `d04739da` (Apr 29)  
**Author:** shashankp@sanketika.in

### What Changed

Asset enrichment was extracted from the core Flink deployment and packaged as a standalone addon. The `opentofu/azure/template/global-values.yaml` template was updated as part of this work.

**Commit `c5eebe31`** — Initial introduction, which temporarily removed `enable_asset_enrichment` from `global-values.yaml`:
```yaml
# Removed in c5eebe31
enable_asset_enrichment: &enable_asset_enrichment "false"
...
  enable_asset_enrichment: *enable_asset_enrichment
```

**Commit `d04739da`** — Restored `enable_asset_enrichment` to `global-values.yaml` as a top-level feature flag (alongside the new addon):
```yaml
# Restored in d04739da
enable_asset_enrichment: &enable_asset_enrichment "false"
...
  enable_asset_enrichment: *enable_asset_enrichment
```

The net effect on `opentofu/azure/` is that `global-values.yaml` retains `enable_asset_enrichment: "false"` as a default — unchanged from the state before these commits. The bulk of this feature (Helm chart, addon script, ConfigMap templates) lives under `addons/asset-enrichment/` and `addons/asset-enrichment/helmcharts/asset-enrichment/`, which are outside the scope of this changelog.

### Why It Matters

Asset enrichment (the service that auto-tags and enriches uploaded content assets) is now an optional addon that can be installed independently with `./addon.sh install azure` rather than being baked into the core `knowledgebb` Flink job deployment. The `enable_asset_enrichment` flag in `global-values.yaml` controls whether downstream Helm charts wire up the enrichment pipeline.

---

## Summary Table

| Date | Hash | Author | Description |
|------|------|--------|-------------|
| Apr 14 | `d66e2af` | divyag@sanketika.in | Add `network_plugin_mode = "overlay"` to AKS network profile |
| Apr 14 | `5ceee49` | divyag@sanketika.in | Change `network_plugin` default from `kubenet` to `azure` |
| Apr 14 | `645844d` | divyag@sanketika.in | Uncomment `kubernetes_namespace` resource block in workload-identity |
| Apr 15 | `a55cc5ce` | shashankp@sanketika.in | Add Google OAuth client ID extraction to `generate_postman_env` |
| Apr 16 | `576d68d` | shashankp@sanketika.in | Remove storage account access key from outputs, variables, and generated config |
| Apr 17 | `3eb4c3f` | shashankp@sanketika.in | Remove invalid `resource_group_name` from `azurerm_federated_identity_credential` |
| Apr 20 | `a21ec1b` | jeraldj@sanketika.in | Switch Postman collection run to fixed filename `sunbird-spark-collection-v1.json` |
| Apr 24 | `48f5901` | shashankp@sanketika.in | Rewrite `opentofu/azure/README.md` with structured tables and deployment guidance |
| Apr 24 | `d6cadd0` | shashankp@sanketika.in | Remove `skip_storage_module` bypass; revert storage inputs to unconditional dependency |
| Apr 27 | `ae2bf60` | shashankp@sanketika.in | Remove deployer blob role assignment; rewire propagation sleep to workload identity roles |
| Apr 27 | `96f70ae` | shashankp@sanketika.in | Add `aks_version` input wired from `global-values.yaml` (later reverted) |
| Apr 28 | `53cb650` | shashankp@sanketika.in | Soften `aks_version` lookup with `try(..., null)` to handle missing key |
| Apr 28 | `f682c73` | shashankp@sanketika.in | Revert `aks_version` input from `aks.hcl`; restore default in `variables.tf` |
| Apr 28 | `a32a6e6` | shashankp@sanketika.in | Remove `aks_version` variable and `kubernetes_version` from AKS `main.tf` entirely |
| Apr 28 | `79d08751` | shashankp@sanketika.in | Remove `time` provider, `time_sleep` resource, and `deployer_role_ready` output |
| Apr 28 | `1f98bedf` | shashankp@sanketika.in | Remove `mock_outputs` from workload-identity dependency in `keys.hcl` and `upload-files.hcl` |
| Apr 28 | `4ff3ef6` | shashankp@sanketika.in | Remove `workload_identity` dependency block from `keys.hcl` and `upload-files.hcl` |
| Apr 29 | `c5eebe3` | shashankp@sanketika.in | Introduce asset enrichment addon; temporarily remove `enable_asset_enrichment` flag |
| Apr 29 | `d04739d` | shashankp@sanketika.in | Restore `enable_asset_enrichment` flag to `global-values.yaml` template |
