import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  groqApiKey: requireEnv("GROQ_API_KEY"),
  groqModel: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
  maxFileSizeBytes: Number(process.env.MAX_FILE_SIZE_BYTES ?? 20 * 1024 * 1024),
  scanTtlMs: Number(process.env.SCAN_TTL_MS ?? 24 * 60 * 60 * 1000),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  dbHost: requireEnv("DB_HOST"),
  dbPort: Number(process.env.DB_PORT ?? 3306),
  dbUser: process.env.DB_USER ?? "root",
  dbPassword: requireEnv("DB_PASSWORD"),
  dbName: process.env.DB_NAME ?? "maskit",
};
