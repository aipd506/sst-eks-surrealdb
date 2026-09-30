# Infrastructure Architecture

This repository provisions a production-grade distributed **SurrealDB** cluster backed by **TiKV** on **Amazon EKS** using SST and Pulumi.

## System Architecture Diagram

```mermaid
flowchart TD
    subgraph AWS["Amazon Web Services (VPC)"]
        subgraph EKS["Amazon EKS Cluster (Kubernetes v1.27)"]
            subgraph PD_NG["PD Managed Node Group (ARM64 t4g.small)"]
                PD["Placement Driver (PD)<br/>basic-pd.tidb-cluster:2379"]
            end
            
            subgraph TIKV_NG["TiKV Managed Node Group (ARM64 m7g.medium)"]
                TIKV["TiKV Storage Pods<br/>Distributed Key-Value Engine"]
            end

            subgraph TIDB_NG["TiDB Node Group (ARM64 t4g.medium)"]
                TIDB["TiDB SQL Layer<br/>(ClusterIP Service)"]
            end

            subgraph SURREAL_PODS["SurrealDB Service"]
                SDB["SurrealDB Engine v2.2.2<br/>tikv://basic-pd.tidb-cluster:2379"]
            end
            
            OPERATOR["TiDB Operator v1.6.1<br/>Controller & Auto-Failover"]
            CSI["AWS EBS CSI Driver<br/>Dynamic gp3 Volume Provisioner"]
        end

        subgraph SST_APPS["Serverless / Microservice Layer"]
            HONO["Hono Microservice<br/>(SST Function / Lambda)"]
        end
    end

    CLIENT["Client / Web App"] -->|HTTP/REST| HONO
    HONO -->|WebSocket / RPC| SDB
    SDB -->|Native TiKV Protocol| PD
    SDB -->|Storage Replication| TIKV
    OPERATOR -->|Manages| PD
    OPERATOR -->|Manages| TIKV
    OPERATOR -->|Manages| TIDB
```

## Key Infrastructure Components

1. **Storage Subsystem (TiKV & PD):**
   - **PD (Placement Driver):** Manages cluster metadata and shard allocation (table regions).
   - **TiKV:** Multi-Raft distributed transactional key-value store providing ACID semantics.
   - **EBS CSI Driver:** Automates dynamic attachment of AWS `gp3` storage volumes per storage node.

2. **Database Engine (SurrealDB):**
   - Configured in distributed storage mode via `tikv://basic-pd.tidb-cluster:2379`.
   - Decoupled compute from storage allows independent scaling of query handlers vs storage shards.

3. **Application API (Hono Service):**
   - Low-latency microservice using Hono and `@surrealdb/node`.
   - Exposes `/health`, `POST /users`, and `GET /users` endpoints.
