import { createApp } from "./app";
import { env } from "./config/env";
import { initDb } from "./services/db";
import { startExpiryCleanup } from "./services/scanStore.service";

async function main() {
  await initDb();
  startExpiryCleanup();

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`Maskit API running on http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  console.error("서버 시작 실패:", err);
  process.exit(1);
});
