import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as eks from "@pulumi/eks";
import * as kubernetes from "@pulumi/kubernetes";

export interface SurrealDbClusterConfig {
  vpcId: pulumi.Input<string>;
  publicSubnetIds: pulumi.Input<pulumi.Input<string>[]>;
  nodeSecurityGroupId?: pulumi.Input<string>;
}

export const setupSurrealdb = async (config: SurrealDbClusterConfig) => {
  const cluster = new eks.Cluster("SurrealDBCluster", {
    vpcId: config.vpcId,
    subnetIds: config.publicSubnetIds,
    instanceType: "t3.medium",
    desiredCapacity: 1,
    minSize: 1,
    maxSize: 2,
    storageClasses: "gp3",
    skipDefaultNodeGroup: false,
    clusterSecurityGroup: config.nodeSecurityGroupId,
  });

  const ebsCsiDriverAddon = new eks.Addon("aws-ebs-csi-driver", {
    cluster: cluster,
    addonName: "aws-ebs-csi-driver",
  });

  // Retrieve the instance role ARN created by the EKS cluster
  const instanceRoleArn = cluster.instanceRoles.apply((roles) => roles[0].arn);

  // Dedicated Managed Node Group for Placement Driver (PD)
  const pdNodeGroup = new eks.ManagedNodeGroup("pd-nodegroup", {
    cluster: cluster,
    nodeGroupName: "pd-nodes",
    instanceTypes: ["t4g.small"],
    amiType: "AL2023_ARM_64_STANDARD",
    scalingConfig: {
      desiredSize: 1,
      minSize: 1,
      maxSize: 3,
    },
    labels: { dedicated: "pd" },
    taints: [{ key: "dedicated", value: "pd", effect: "NO_SCHEDULE" }],
    subnetIds: config.publicSubnetIds,
    nodeRoleArn: instanceRoleArn,
  });

  // Dedicated Managed Node Group for TiDB
  const tidbNodeGroup = new eks.ManagedNodeGroup("tidb-nodegroup", {
    cluster: cluster,
    nodeGroupName: "tidb-nodes",
    instanceTypes: ["t4g.medium"],
    amiType: "AL2023_ARM_64_STANDARD",
    scalingConfig: {
      desiredSize: 1,
      minSize: 1,
      maxSize: 2,
    },
    labels: { dedicated: "tidb" },
    taints: [{ key: "dedicated", value: "tidb", effect: "NO_SCHEDULE" }],
    subnetIds: config.publicSubnetIds,
    nodeRoleArn: instanceRoleArn,
  });

  // Dedicated Managed Node Group for TiKV (Distributed Storage Engine)
  const tikvNodeGroup = new eks.ManagedNodeGroup("tikv-nodegroup", {
    cluster: cluster,
    nodeGroupName: "tikv-nodes",
    instanceTypes: ["m7g.medium"],
    amiType: "AL2023_ARM_64_STANDARD",
    scalingConfig: {
      desiredSize: 1,
      minSize: 1,
      maxSize: 3,
    },
    labels: { dedicated: "tikv" },
    taints: [{ key: "dedicated", value: "tikv", effect: "NO_SCHEDULE" }],
    subnetIds: config.publicSubnetIds,
    nodeRoleArn: instanceRoleArn,
  });

  const provider = new kubernetes.Provider("eks-provider", {
    kubeconfig: cluster.kubeconfig,
  });

  // 1. TiDB Operator CRDs
  const tidbCrds = new kubernetes.yaml.ConfigFile(
    "tidb-crds",
    {
      file: "https://raw.githubusercontent.com/pingcap/tidb-operator/v1.6.1/manifests/crd.yaml",
    },
    { provider }
  );

  const tidbOperatorNamespace = new kubernetes.core.v1.Namespace(
    "tidb-operator-ns",
    { metadata: { name: "tidb-operator" } },
    { provider }
  );

  // 2. TiDB Operator Helm Chart
  const tidbOperator = new kubernetes.helm.v3.Chart(
    "tidb-operator",
    {
      chart: "tidb-operator",
      version: "v1.6.1",
      fetchOpts: { repo: "https://charts.pingcap.org" },
      namespace: "tidb-operator",
    },
    { provider, dependsOn: [tidbCrds, tidbOperatorNamespace] }
  );

  const tidbClusterNamespace = new kubernetes.core.v1.Namespace(
    "tidb-cluster-ns",
    { metadata: { name: "tidb-cluster" } },
    { provider }
  );

  // 3. TiDB / TiKV Custom Cluster Definition
  const tidbCluster = new kubernetes.apiextensions.CustomResource(
    "tidb-cluster",
    {
      apiVersion: "pingcap.com/v1alpha1",
      kind: "TidbCluster",
      metadata: {
        name: "basic",
        namespace: "tidb-cluster",
      },
      spec: {
        version: "v8.5.0",
        timezone: "UTC",
        tlsCluster: { enabled: false },
        pd: {
          replicas: 1,
          requests: { storage: "1Gi" },
          nodeSelector: { dedicated: "pd" },
          tolerations: [
            { key: "dedicated", value: "pd", effect: "NoSchedule" },
          ],
        },
        tikv: {
          replicas: 1,
          requests: { storage: "10Gi" },
          nodeSelector: { dedicated: "tikv" },
          tolerations: [
            { key: "dedicated", value: "tikv", effect: "NoSchedule" },
          ],
        },
        tidb: {
          replicas: 1,
          service: { type: "ClusterIP" },
          nodeSelector: { dedicated: "tidb" },
          tolerations: [
            { key: "dedicated", value: "tidb", effect: "NoSchedule" },
          ],
        },
      },
    },
    {
      provider,
      dependsOn: [
        tidbOperator,
        tidbClusterNamespace,
        pdNodeGroup,
        tidbNodeGroup,
        tikvNodeGroup,
        ebsCsiDriverAddon,
      ],
    }
  );

  // 4. SurrealDB Helm Deployment with TiKV Backend
  const surrealdb = new kubernetes.helm.v3.Release(
    "surrealdb",
    {
      chart: "surrealdb",
      repositoryOpts: { repo: "https://surrealdb.github.io/helm-charts" },
      version: "0.3.7",
      namespace: "default",
      values: {
        image: {
          pullPolicy: "IfNotPresent",
          repository: "surrealdb/surrealdb",
          tag: "v2.2.2",
        },
        service: {
          type: "LoadBalancer",
        },
        surrealdb: {
          auth: false,
          path: "tikv://basic-pd.tidb-cluster:2379",
        },
      },
    },
    { provider, dependsOn: [tidbCluster] }
  );

  return {
    clusterName: cluster.eksCluster.name,
    kubeconfig: cluster.kubeconfig,
    surrealDbEndpoint: surrealdb.status,
  };
};
