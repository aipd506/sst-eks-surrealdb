import { SSTConfig } from "sst";
import { EksStack } from "./src/EksStack";
import { Function, StackContext } from "sst/constructs";

export default {
  config(_input) {
    return {
      name: "sst-eks-surrealdb",
      region: process.env.AWS_REGION || "us-east-1",
    };
  },
  stacks(app) {
    // 1. Deploy EKS Infrastructure Stack for TiKV and SurrealDB
    app.stack(EksStack);

    // 2. Deploy Application Stack with Hono Microservice
    app.stack(function ApiStack({ stack }: StackContext) {
      const honoService = new Function(stack, "HonoService", {
        handler: "examples/hono-service/index.handler",
        timeout: "30 seconds",
        environment: {
          SURREALDB_URL: process.env.SURREALDB_URL || "ws://localhost:8000/rpc",
          SURREALDB_USER: process.env.SURREALDB_USER || "root",
          SURREALDB_PASS: process.env.SURREALDB_PASS || "root",
          SURREALDB_NS: process.env.SURREALDB_NS || "test",
          SURREALDB_DB: process.env.SURREALDB_DB || "test",
        },
      });

      stack.addOutputs({
        HonoFunctionArn: honoService.functionArn,
      });
    });
  },
} satisfies SSTConfig;
