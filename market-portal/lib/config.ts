/** 服务端读取的环境变量（.env.local） */
export function getMongoUri(): string {
  const u = process.env.MONGODB_URI;
  if (!u) throw new Error("缺少环境变量 MONGODB_URI");
  return u;
}

export function getMongoDbName(): string {
  return process.env.MONGODB_DB_NAME || "市场洞察库";
}

export function getMongoCollectionName(): string {
  return process.env.MONGODB_COLLECTION || "竞品产品";
}
