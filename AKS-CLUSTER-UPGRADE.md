# Test Cluster Upgrade

This document captures the experience of upgrading the `ed-testing` AKS cluster Kubernetes version, including the issues encountered and their resolutions.

---

## Issue 1: Network Plugin Migration Error (`OnlySupportedOnUserAssignedMSICluster`)

### What Happened

When attempting to upgrade the `ed-testing` cluster, it entered a **FAILED** state with the following error:

```
OnlySupportedOnUserAssignedMSICluster: Updating network plugin/network plugin mode is only supported on user assigned MSI cluster.
```

### Why It Happened

The `ed-testing` cluster was originally created with the `kubenet` network plugin. In the meantime, the infrastructure code had been updated to use the `azure overlay` network plugin. When the upgrade was triggered, OpenTofu attempted to apply this network plugin change to the existing cluster alongside the version upgrade. Azure enforces a restriction: network plugin migrations are only supported on clusters that use a **User-Assigned Managed Identity**. Since the `ed-testing` cluster uses a System-Assigned identity, Azure rejected the migration and left the cluster in a failed state.

### Solution

The fix was to revert the network plugin back to `kubenet` in the infrastructure code, matching the original configuration the cluster was created with. Once the code was aligned with the existing cluster state, the apply succeeded and the cluster recovered.

> **Note:** This issue only affects existing clusters that were created with `kubenet`. New clusters provisioned from scratch using the updated code will be created directly with `azure overlay` and will not encounter this problem.

---

## Issue 2: Apply Required to Run Twice Per Version Upgrade

### What Happened

For both upgrade steps — `1.33.6 → 1.34.4` and `1.34.4 → 1.35.1` — the `tofu apply` had to be run **twice** to complete successfully.

The first run would upgrade the AKS cluster itself but then fail with:

```
Error: Provider produced inconsistent final plan
...
local_file.kubeconfig: planned content differs from actual
```

### Why It Happened

The `local_file.kubeconfig` resource writes the cluster's kubeconfig to disk using the `kube_config_raw` output from the AKS cluster resource. During a Kubernetes version upgrade, Azure regenerates this value. At **plan time**, OpenTofu sees `kube_config_raw` as `(sensitive value)` — its final content is only known after the cluster upgrade completes during apply. The mismatch between the planned value and the value written during apply causes OpenTofu to report the inconsistency and halt.

The **second run** succeeds because the cluster is already at the new version, `kube_config_raw` is stable and fully known at plan time, and the `local_file` resource is written cleanly.

### Solution

Replace the `local_file.kubeconfig` resource with a `null_resource` that fetches the kubeconfig using `az aks get-credentials` via a `local-exec` provisioner. Since `local-exec` output is not tracked by OpenTofu, there is no value to compare at plan time and the inconsistency error never occurs.

```hcl
resource "null_resource" "kubeconfig" {
  triggers = {
    cluster_id      = azurerm_kubernetes_cluster.aks.id
    cluster_version = azurerm_kubernetes_cluster.aks.kubernetes_version
  }

  provisioner "local-exec" {
    command = "az aks get-credentials --resource-group ${var.resource_group_name} --name ${azurerm_kubernetes_cluster.aks.name} --overwrite-existing"
  }

  depends_on = [azurerm_kubernetes_cluster.aks]
}
```

This triggers whenever the cluster ID or version changes, always fetches a fresh kubeconfig after apply, and eliminates the need to run apply twice.

---

## Downtime

The Kubernetes version upgrades were performed with **near-zero downtime**. Azure upgrades the control plane first, followed by a rolling replacement of worker nodes. During the node rolling upgrade, workloads are rescheduled to available nodes before each node is drained, so running services remain accessible throughout the process.

No data loss or service interruption was observed during either upgrade step.
