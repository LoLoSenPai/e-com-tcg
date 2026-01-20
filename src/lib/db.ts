import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.warn(
    "MONGODB_URI missing: using local sample data for products and cart.",
  );
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;

if (uri) {
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
}

export async function getDb() {
  if (!clientPromise) {
    throw new Error("MongoDB client not initialized.");
  }
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB || "nebula_tcg");
}
