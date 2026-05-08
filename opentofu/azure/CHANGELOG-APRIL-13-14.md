# OpenTofu Azure Changes — April 13–14, 2026

All commits below affect `opentofu/azure/` only.  
Author: **divyagovindaiah** (divyag@sanketika.in)

---

## 1. Add `network_plugin_mode` to AKS Network Profile
**Commit:** `d66e2af` · Apr 14, 13:01 IST

**File:** `opentofu/azure/modules/aks/main.tf`

Added `network_plugin_mode = "overlay"` to the AKS `network_profile` block, enabling Azure CNI Overlay mode for improved IP address management.

```diff
 network_profile {
-  network_plugin = var.network_plugin
-  service_cidr   = var.service_cidr
-  dns_service_ip = var.dns_service_ip
+  network_plugin      = var.network_plugin
+  network_plugin_mode = "overlay"
+  service_cidr        = var.service_cidr
+  dns_service_ip      = var.dns_service_ip
 }
```

---

## 2. Change Default Network Plugin from `kubenet` to `azure`
**Commit:** `5ceee49` · Apr 14, 13:01 IST

**File:** `opentofu/azure/modules/aks/variables.tf`

Updated the default value of `network_plugin` variable to `azure` (Azure CNI), consistent with the overlay mode added above.

```diff
 variable "network_plugin" {
   type        = string
   description = "AKS cluster network plugin."
-  default     = "kubenet"
+  default     = "azure"
 }
```

---

## 3. Uncomment `kubernetes_namespace` Resource Block
**Commit:** `645844d` · Apr 14, 15:30 IST

**File:** `opentofu/azure/modules/workload-identity/main.tf`

Re-enabled the `kubernetes_namespace` resource that creates K8s namespaces during workload identity provisioning (was previously commented out).

```diff
-# resource "kubernetes_namespace" "namespaces" {
-#   for_each = toset(var.k8s_namespaces)
-#   metadata {
-#     name = each.value
-#   }
-# }
+resource "kubernetes_namespace" "namespaces" {
+  for_each = toset(var.k8s_namespaces)
+  metadata {
+    name = each.value
+  }
+}
```

---

## 4. Storage Module Support — Terragrunt HCL Refactor
**Commit:** `9d2a7de` · Apr 14, 17:15 IST

**Files changed:**
- `opentofu/azure/_common/keys.hcl`
- `opentofu/azure/_common/output-file.hcl`
- `opentofu/azure/_common/upload-files.hcl`
- `opentofu/azure/_common/workload-identity.hcl`
- `opentofu/azure/template/global-values.yaml`
- `opentofu/azure/template/storage/terragrunt.hcl`

Major refactor to make all Terragrunt HCL modules conditionally source storage values either from:
- **`dependency.storage` outputs** — when `skip_storage_module: false` (storage module creates Azure storage account), or
- **`global-cloud-values.yaml`** — when `skip_storage_module: true` (pre-existing storage account provided via private repo).

### Key changes per file

#### `_common/keys.hcl`
- Added `skip_storage_module` local from `global-values.yaml`
- Added `dependency "storage"` block with mock outputs
- Inputs now use ternary: `skip_storage_module ? cloud_vars.* : dependency.storage.outputs.*`

#### `_common/output-file.hcl`
- Added `skip_storage_module` local
- Added `dependency "storage"` block with mock outputs (includes `azurerm_storage_account_key`, `azurerm_velero_container_name`)
- Swapped `dependency "workload_identity"` → `dependency "keys"` ordering
- All 5 storage-related inputs now use `skip_storage_module` ternary

#### `_common/upload-files.hcl`
- Replaced hardcoded `cloud_vars` locals with `skip_storage_module` flag
- Added `dependency "storage"` block
- Storage inputs now use `skip_storage_module` ternary

#### `_common/workload-identity.hcl`
- Removed direct `storage_account_name/container` locals sourced from `cloud_vars`
- Added `dependency "storage"` block with full mock outputs
- `storage_account_id` now built from storage dependency output (or manual subscription path when skipping)
- `container_names` list now uses ternary to pick from storage dependency vs `cloud_vars`
- Removed `mock_outputs_allowed_terraform_commands` (no longer needed)

#### `template/global-values.yaml`
- Added new field `skip_storage_module: true` with inline documentation

#### `template/storage/terragrunt.hcl`
- Removed hardcoded `skip = true` and all commented-out blocks
- Now dynamically reads `skip_storage_module` from `global-values.yaml`:
  ```hcl
  locals {
    global_vars = yamldecode(file(find_in_parent_folders("global-values.yaml")))
  }
  skip = local.global_vars.global.skip_storage_module
  ```
- Re-enabled `include "root"` and `include "environment"` blocks pointing to `_common/storage.hcl`

---

## 5. Storage Module Support — Backend & Global Values
**Commit:** `0ce0b35` · Apr 14, 18:56 IST

**Files changed:**
- `opentofu/azure/template/create_tf_backend.sh`
- `opentofu/azure/template/global-values.yaml`

### `create_tf_backend.sh`
Made the resource group name configurable instead of hardcoded to `"ed-sandbox"`:

```diff
+resource_group_name=$(yq '.global.resource_group_name' global-values.yaml)
 ...
-RESOURCE_GROUP_NAME="ed-sandbox"
+if [[ -z "$resource_group_name" || "$resource_group_name" == "null" ]]; then
+  RESOURCE_GROUP_NAME="${building_block}-${environment_name}"
+else
+  RESOURCE_GROUP_NAME="$resource_group_name"
+fi
```

### `global-values.yaml`
- Added `resource_group_name: ""` field (Azure resource group; auto-generated from building_block+environment if left empty)
- Changed `skip_storage_module` default to `false` (storage module now active by default)

```diff
-  skip_storage_module: true
+  skip_storage_module: false
+  resource_group_name: ""    # Azure resource group name; created if it does not exist
```

---

## 6. Storage Module Support — Re-enable Storage in install.sh
**Commit:** `d9d7586` · Apr 14, 19:11 IST

**File:** `opentofu/azure/template/install.sh`

Added `deploy_tf_module storage` back into the `create_tf_resources` function so storage account creation runs as part of the standard install flow:

```diff
 function create_tf_resources() {
     source tf.sh
     echo -e "\nCreating resources on azure cloud"
-    # storage is skipped (skip = true in storage/terragrunt.hcl) — reusing existing
     deploy_tf_module network
+    deploy_tf_module storage
     deploy_tf_module aks
```

---

## Summary

| # | Commit | Time (IST) | Area | What Changed |
|---|--------|-----------|------|-------------|
| 1 | `d66e2af` | 13:01 | `modules/aks/main.tf` | Added `network_plugin_mode = "overlay"` |
| 2 | `5ceee49` | 13:01 | `modules/aks/variables.tf` | Default `network_plugin`: `kubenet` → `azure` |
| 3 | `645844d` | 15:30 | `modules/workload-identity/main.tf` | Uncommented `kubernetes_namespace` resource |
| 4 | `9d2a7de` | 17:15 | `_common/*.hcl`, `template/storage/terragrunt.hcl` | Storage module: dynamic skip via `skip_storage_module` flag, added `dependency "storage"` to all HCL configs |
| 5 | `0ce0b35` | 18:56 | `template/create_tf_backend.sh`, `template/global-values.yaml` | Configurable resource group name; `skip_storage_module` defaults to `false` |
| 6 | `d9d7586` | 19:11 | `template/install.sh` | Re-added `deploy_tf_module storage` to install flow |
