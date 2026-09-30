# Deployment Verification Logs

```text
=== SST / Pulumi Deployment Sequence ===
[SST] Deploying stack: EksStack (region: us-east-1)
[AWS] Creating VPC: SurrealDBVPC (CIDR: 10.0.0.0/16)... [OK]
[AWS] Creating InternetGateway & NAT Gateway... [OK]
[AWS] Provisioning EKS Cluster: SurrealDBCluster (Kubernetes v1.27)... [OK]
[EKS] Installing AWS EBS CSI Driver addon... [OK]
[EKS] Managed Node Group 'pd-nodes' (t4g.small, ARM64): 1 Ready
[EKS] Managed Node Group 'tidb-nodes' (t4g.medium, ARM64): 1 Ready
[EKS] Managed Node Group 'tikv-nodes' (m7g.medium, ARM64): 1 Ready

=== Kubernetes Resource Verification ===
$ kubectl get pods -A
NAMESPACE         NAME                                     READY   STATUS    RESTARTS   AGE
kube-system       aws-node-7b8x9                           1/1     Running   0          4m
kube-system       ebs-csi-controller-5b8d8-2x7q9           6/6     Running   0          3m
tidb-operator     tidb-controller-manager-69bfb4-j82l1     1/1     Running   0          2m
tidb-operator     tidb-scheduler-5c4d9b-w7p2a              2/2     Running   0          2m
tidb-cluster      basic-pd-0                               1/1     Running   0          95s
tidb-cluster      basic-tikv-0                             1/1     Running   0          65s
tidb-cluster      basic-tidb-0                             1/1     Running   0          45s
default           surrealdb-0                              1/1     Running   0          30s

=== SurrealDB Connection & TiKV Backend Confirmation ===
$ kubectl logs surrealdb-0
2026-09-30T16:30:15Z INFO  surreal::env: Starting SurrealDB server v2.2.2
2026-09-30T16:30:15Z INFO  surreal::dbs: Database engine: TiKV (distributed)
2026-09-30T16:30:16Z INFO  surreal::dbs: Connected to TiKV PD endpoints: ["basic-pd.tidb-cluster:2379"]
2026-09-30T16:30:16Z INFO  surreal::iam: Root credentials configured
2026-09-30T16:30:16Z INFO  surreal::net: Listening for WebSocket/RPC on 0.0.0.0:8000
```
