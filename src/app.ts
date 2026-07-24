import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { scansRouter } from "./routes/scans.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.middleware";
import { openApiSpec } from "./openapi";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1); // ALB가 앞단 프록시 1홉이므로, X-Forwarded-For의 첫 번째 값을 실제 클라이언트 IP로 신뢰

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 30,
      standardHeaders: true,
      legacyHeaders: false,
      validate: false, // ALB가 X-Forwarded-For와 Forwarded 헤더를 함께 보내는 걸 이미 trust proxy로 의도적으로 처리 중 - 내부 휴리스틱 경고만 비활성화
    })
  );

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(
    "/api-docs",
    (_req: Request, res: Response, next: NextFunction) => {
      res.removeHeader("Content-Security-Policy");
      next();
    },
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec)
  );

  app.use("/api/v1", scansRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
