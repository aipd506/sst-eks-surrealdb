# Deployment Guide: SurrealDB on TiKV with SST & Pulumi

## Prerequisites

- **AWS Account** with Administrator / EKS & VPC deployment permissions
- **AWS CLI** configured (`aws sts get-caller-identity`)
- **Node.js 18+** & **pnpm** installed (`corepack enable pnpm`)
- **Pulumi CLI** installed (`curl -fsSL https://get.pulumi.com | sh`)
- **kubectl** & **Helm 3** installed

## Step 1: Environment Configuration

Create a `.env` file in the project root:

```bash
AWS_REGION=us-east-1
SURREALDB_URL=ws://localhost:8000/rpc
SURREALDB_USER=root
SURREALDB_PASS=root
SURREALDB_NS=production
SURREALDB_DB=production
```

## Step 2: Install Dependencies

```bash
pnpm install
```

## Step 3: Deploy EKS & TiKV Cluster

To provision the VPC, EKS cluster, TiDB Operator, and SurrealDB:

```bash
# Preview infrastructure changes
pnpm run build

# Deploy via SST / Pulumi
npx sst deploy --stage prod
```

## Step 4: Verify Cluster Connectivity

Fetch `kubeconfig` and verify cluster status:

```bash
aws eks update-kubeconfig --region us-east-1 --name SurrealDBCluster-prod
kubectl get pods -n tidb-cluster
kubectl get pods -l app.kubernetes.io/name=surrealdb
```

## Step 5: Test the Hono Example Service

Navigate to `examples/hono-service`:

```bash
cd examples/hono-service
pnpm install
pnpm run dev
```

Run test suite:
```bash
pnpm run test
```

## Teardown / Resource Cleanup

To avoid AWS charges after testing:

```bash
npx sst remove --stage prod
```
