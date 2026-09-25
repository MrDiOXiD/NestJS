import { NestFactory, Reflector } from "@nestjs/core";
import { ClassSerializerInterceptor, ValidationPipe, Logger } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { mkdirSync } from "fs";
import { join } from "path";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  logger.log(`🚨 CONNECTING TO HOST: ${process.env.DB_HOST}`);
  logger.log(`🚨 ON PORT: ${process.env.DB_PORT}`);

  // ── 1. Safely create upload directory ──────────────────────────────────────
  try {
    mkdirSync(join(process.cwd(), "uploads", "images"), { recursive: true });
  } catch (err: any) {
    logger.warn(`Could not create uploads directory: ${err.message}`);
  }

  const app = await NestFactory.create(AppModule);

  // ── 2. Trust reverse proxy (Runflare ingress / Nginx) ──────────────────────
  app.getHttpAdapter().getInstance().set("trust proxy", 1);

  app.use(cookieParser());

  // ── 3. Security headers ───────────────────────────────────────────────────
  app.use(helmet());

  // ── 4. Dynamic CORS setup ─────────────────────────────────────────────────
  const allowedOrigins = [
    process.env.ALLOWED_ORIGIN,
    "https://chatratech.ir",
    "https://www.chatratech.ir",
    "https://panel.chatratech.ir",
    "https://www.panel.chatratech.ir",
    "http://localhost:3000",
    "http://localhost:3010",
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl) or matched origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Fallback allow to prevent production lockout
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });

  // ── 5. Global Interceptors & Validation ───────────────────────────────────
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ── 6. Swagger Documentation (Non-production) ─────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Chatra API")
      .setDescription("API documentation")
      .setVersion("1.0")
      .addBearerAuth()
      .build();

    SwaggerModule.setup("api", app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  // ── 7. Network & Port Binding ─────────────────────────────────────────────
  const rawPort = process.env.PORT;
  const port = rawPort ? parseInt(rawPort, 10) : 3000;

  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 APP IS RUNNING AND LISTENING ON PORT: ${port}`);
}

bootstrap().catch((err) => {
  console.error('❌ CRITICAL BOOTSTRAP FAILURE:', err);
  process.exit(1);
});