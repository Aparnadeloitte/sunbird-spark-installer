# sunbird-spark-installer

Minimum resources required to install and run Sunbird-ED on any cloud provider
- **vCPUs**: 48  
- **RAM**: 192 GB

## Installing Sunbird on Any Cloud Provider

### Pre-requisites

1. **Domain Name**
2. **SSL Certificate**: The FullChain, consisting of the private key and Certificate+CA_Bundle, is mandatory for installation.
3. **Google OAuth Credentials**: [Create credentials](https://developers.google.com/workspace/guides/create-credentials#oauth-client-id)
4. **Google V3 ReCaptcha Credentials**: [Create credentials](https://www.google.com/recaptcha/admin)
5. **Email Service Provider**
6. **MSG91 SMS Service Provider API Token** (Optional): Required for sending OTPs to registered email addresses during user registration or password reset.
7. **YouTube API Token** (Optional): Necessary for uploading video content directly via YouTube URL.

### Required CLI Tools
1. [jq](https://jqlang.github.io/jq/download/)
2. [yq](https://github.com/mikefarah/yq#install) (for YAML processing)
3. [rclone](https://rclone.org/)
4. [Terraform](https://developer.hashicorp.com/terraform/tutorials/aws-get-started/install-cli)
5. [Terragrunt](https://terragrunt.gruntwork.io/docs/getting-started/install/)
6. Linux / MacOS / GitBash (Windows)
7. Python 3 
8. PyJWT Python Package (install via pip)
9. [kubectl](https://kubernetes.io/docs/tasks/tools/)
10. [helm](https://helm.sh/docs/intro/quickstart/#install-helm)
11. [Postman CLI](https://learning.postman.com/docs/getting-started/installation/installation-and-updates/)
12. For cloud-specific tools, follow the instructions in the respective README file based on your provider.  
    Example for Azure: [terraform/azure/README.md](terraform/azure/README.md)

### Notes
- Existing files in the following locations will be backed up with a `.bak` extension, and the files will be overwritten:
    - `~/.config/rclone/rclone.conf`
    - `~/.kube/config`
- In the instructions below, `demo` is used as the environment name. You can replace it with your desired environment name, such as `dev`, `stage`, etc.

### Steps to Clone and Prepare

1. Clone the repository:a
     ```bash
     git clone https://github.com/project-sunbird/sunbird-ed-installer.git
     ```
2. Copy the template directory:
     ```bash
     cd terraform/<cloud-provider>   # Replace <cloud-provider> with your cloud provider (e.g., azure, aws, gcp)
     cp -r template demo
     cd demo
     ```
3. Fill in the variables in `demo/global-values.yaml`.
   take reference from  [terraform/azure/README.md]

4. Controlling DIAL Services and Flink Jobs

     If you need DIAL-related services and Flink jobs, you can enable them using the
     `deploy_dial_services` flag.

     - Default: `false` (DIAL services are not deployed)

     - To enable: set it to `true` in your `global-values.yaml` file. For example:

         ```yaml
         deploy_dial_services: true
         ```

5. Enabling Asset Enrichment

     If you want to enable asset enrichment, you can control it using the
     `enable_asset_enrichment` flag.

     - Default: `false` (Asset enrichment is disabled)

     - To enable: set it to `true` in your `global-values.yaml` file. For example:

         ```yaml
         enable_asset_enrichment: true
         ```

6. Log in to your cloud provider:
    ```bash
    # If  cloud provider is Azure
    az login --tenant AZURE_TENANT_ID

    # If cloud provider is AWS
    aws configure

    # If cloud provider is GCP
    gcloud auth login
    ```
6. Run the installation script:
     ```bash
     time ./install.sh
     ```

## Default Users in the Instance

This installation setup creates the following default users with different roles. You can update the passwords using the "Forgot Password" option or create new users using APIs.

| Role              | Email/User Name           | Password         |
|-------------------|---------------------------|------------------|
| Admin             | admin@yopmail.com         | Admin@123        |
| Content Creator   | contentcreator@yopmail.com| Creator@123      |
| Content Reviewer  | contentreviewer@yopmail.com | Reviewer@123   |
| Book Creator      | bookcreator@yopmail.com   | Bookcreator@123  |
| Book Reviewer     | bookreviewer@yopmail.com  | BookReviewer@123 |
| Public User 1     | user1@yopmail.com         | User1@123        |
| Public User 2     | user2@yopmail.com         | User2@123        |


##  Destorying the sunbird instance
```bash
cd terraform/<cloud-provider>/<env>
time ./install.sh destroy_tf_resources
```

## Note:

## SSL Certificate Setup and Renewal (Let’s Encrypt Integration)

If you are using Let’s Encrypt for SSL certificate management, follow the steps below to ensure proper setup and renewal handling.

---

### 1. Enable Let’s Encrypt in Nginx

In your `global-values.yaml`, set the following flag:

```yaml
lets_encrypt_ssl: true
```

This enables automatic SSL certificate issuance and renewal via a Kubernetes Certbot CronJob.

---

### 2. Automatic Certificate Renewal

When `lets_encrypt_ssl` is enabled:

- The Certbot CronJob automatically renews your SSL certificates approximately every **85 days**.
- After renewal, it updates the SSL certificate and private key in the Kubernetes ConfigMap named `nginx-public-ingress`.

---

### 3. Update Global Values After Renewal

Once the renewal completes:

1. Fetch the renewed keys from the ConfigMap.
2. Update your `terraform/<cloud-provider>/<env>/global-values.yaml` file with the new values:

```yaml
proxy_private_key: |
  <paste the renewed private key from ConfigMap>

proxy_certificate: |
  <paste the renewed certificate from ConfigMap>
```

These values are essential because **edbb bundle  fetches SSL certificates from the global level** defined in above file.

---

### 4. If Not Using Let’s Encrypt

If you are not using Let’s Encrypt:
x
- Keep `lets_encrypt_ssl: false`.
- Manually provide your SSL certificate and private key under the same fields in `global-values.yaml`.

---
### Additional Notes
- The CronJob handles only Let’s Encrypt–issued certificates.
- The default renewal schedule is every **85 days**.
- Always ensure your domain DNS records are properly configured and reachable before renewal.

# Grafana Alloy Helm Chart

```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
helm search repo grafana/alloy
helm pull grafana/alloy
```

This will download the Helm chart as a `.tgz` file.

## Installation Steps

1. Extract the downloaded `.tgz` file.
2. Replace the extracted folder in the following directory:

```text
sunbird-ed-installer/helmcharts/monitoring/charts/alloy
```

3. Update the image version in the following file to match the latest version available in the Grafana Alloy Helm chart:

```text
sunbird-ed-installer/helmcharts/images.yaml
```
# JanusGraph Helm Chart

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
helm search repo bitnami/janusgraph
helm pull bitnami/janusgraph
```

## Installation Steps

1. Extract the downloaded `.tgz` file.
2. Replace the extracted folder in the following directory:

```text
sunbird-ed-installer/helmcharts/edbb/charts/janusgraph
```

# JanusGraph Data Migration from Neo4j

## 1. Exporting Data from Neo4j
SSH into your Neo4j instance and export the Node and Relationship data to CSV format using `cypher-shell`:

**Export Nodes:**
```bash
bin/cypher-shell -u neo4j \
"MATCH (n)
RETURN id(n) AS node_id, labels(n) AS labels, properties(n) AS props" \
--format plain > /var/lib/neo4j/import/nodes.csv
```

**Export Relationships:**
```bash
bin/cypher-shell -u neo4j \
"MATCH (a)-[r]->(b)
RETURN id(a) AS from_id, type(r) AS rel_type, id(b) AS to_id, properties(r) AS props" \
--format plain > /var/lib/neo4j/import/relationships.csv
```

## 2. Preparing JanusGraph for Migration

### Download Migration Scripts
Download the required migration and initialization scripts from the official repository:
- [JanusGraph Migration Scripts Repository](https://github.com/Sanketika-Bengaluru/knowledge-platform-26/tree/develop/master-data/janusgraph)

Download `schema_init.groovy`, `import_data_final.groovy`, and `verify_migration.groovy` to your local machine.

### Copy Scripts to Pod
Once downloaded, copy the scripts to the JanusGraph pod:

```bash
# Set pod name
export JG_POD=$(kubectl get pods -n sunbird -l app.kubernetes.io/name=janusgraph -o jsonpath='{.items[0].metadata.name}')

# Copy Scripts
kubectl cp schema_init.groovy sunbird/$JG_POD:/tmp/schema_init.groovy
kubectl cp import_data_final.groovy sunbird/$JG_POD:/tmp/import_data_final.groovy
kubectl cp verify_migration.groovy sunbird/$JG_POD:/tmp/verify_migration.groovy

# Copy Configuration (Optional)
kubectl cp janusgraph-cql.properties sunbird/$JG_POD:/tmp/janusgraph-cql.properties
```

## 3. Importing Data
Create the data directory in the pod and copy the exported CSV files:

```bash
# Create directory
kubectl exec -n sunbird $JG_POD -- mkdir -p /data

# Copy CSVs
kubectl cp /path/to/nodes.csv sunbird/$JG_POD:/data/nodes.csv
kubectl cp /path/to/relationships.csv sunbird/$JG_POD:/data/relationships.csv
```

# JanusGraph CDC Configuration

JanusGraph CDC (Change Data Capture) is used to track changes in the graph and push them to external systems (e.g., Kafka or local logs).

## 1. Prepare CDC Extension Jar
Place the `janusgraph-cdc-extension-1.0.0.jar` in the following directory:
```text
sunbird-ed-installer/helmcharts/edbb/charts/janusgraph/config/
```

## 2. Build and Push Custom Image
Build the custom JanusGraph image using the provided `Dockerfile` in `sunbird-ed-installer/helmcharts/edbb/charts/janusgraph/`. This image correctly bundles the CDC extension jar into the JanusGraph library directory.

## 3. Update Image Version
Update the JanusGraph image reference in `sunbird-ed-installer/helmcharts/images.yaml` to point to your custom image.

## 4. Enable CDC in Configuration
Add the following configuration to your `sunbird-ed-installer/helmcharts/edbb/charts/janusgraph/config/gremlin-server.yaml` to enable the transaction log and CDC processor:

```yaml
tx.log-tx: true
log.learning_graph_events.backend: default
log.learning_graph_events.key-consistent: true
log.learning_graph_events.read-interval: 500
graph.txn.log_processor.enable: true
graph.txn.log_processor.sinks: LOG
graph.txn.log_processor.converter: SUNBIRD_LEGACY
```

## 5. Verification
Check the JanusGraph pod logs for successful initialization:
- `Executed once at startup of Gremlin Server.`
- `Initializing GraphLogProcessor...`

Mutation events will be captured and logged to:
`/opt/bitnami/janusgraph/logs/cdc-events.log`
