import { MongoClient } from "mongodb";
import { getMongoUri } from "./config";

const globalForMongo = globalThis as unknown as { _mongoClient: MongoClient | undefined };

export async function getMongoClient(): Promise<MongoClient> {
  if (globalForMongo._mongoClient) {
    return globalForMongo._mongoClient;
  }
  const client = new MongoClient(getMongoUri(), { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  if (process.env.NODE_ENV === "development") {
    globalForMongo._mongoClient = client;
  }
  return client;
}
