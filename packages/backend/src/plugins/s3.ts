import { publicPlugin } from "../lib/plugin";
import {
  S3Client,
  CreateBucketCommand,
  PutBucketCorsCommand,
  HeadBucketCommand
} from "@aws-sdk/client-s3";

declare module "fastify" {
  interface FastifyInstance {
    s3: S3Client;
  }
}

const s3Plugin = publicPlugin(async (fastify) => {
  const s3Client = new S3Client({
    endpoint: fastify.config.S3_ENDPOINT,
    forcePathStyle: fastify.config.S3_FORCE_PATH_STYLE,
    region: fastify.config.S3_REGION,
    credentials: {
      accessKeyId: fastify.config.S3_ACCESS_KEY,
      secretAccessKey: fastify.config.S3_SECRET_KEY
    }
  });

  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: fastify.config.S3_BUCKET }));
  } catch (error) {
    await s3Client.send(new CreateBucketCommand({ Bucket: fastify.config.S3_BUCKET }));
  }

  fastify.decorate("s3", s3Client);
});

export { s3Plugin };
