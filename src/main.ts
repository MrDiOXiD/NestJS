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

  try {
    mkdirSync(join(process.cwd(), "uploads", "images"), { recursive: true });
  } catch (err: any) {
    logger.warn(`Could not create uploads directory: ${err.message}`);
  }

  const app = await NestFactory.create(AppModule);

  app.getHttpAdapter().getInstance().set("trust proxy", 1);
  app.use(cookieParser());
  app.use(helmet());

  const allowedOrigins = [
    process.env.ALLOWED_ORIGIN,
    "https://chatratech.ir",
    "https://www.chatratech.ir",
    "http://localhost:3000",
    "http://localhost:3010",
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });

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

  if (process.env.NODE_ENV !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Chatra API")
      .setDescription("API documentation")
      .setVersion("1.0")
      .addBearerAuth()
      .build();

    SwaggerModule.setup("api", app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  const rawPort = process.env.PORT;
  const port = rawPort ? parseInt(rawPort, 10) : 3000;

  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 APP IS RUNNING AND LISTENING ON PORT: ${port}`);
}

bootstrap().catch((err) => {
  console.error('❌ CRITICAL BOOTSTRAP FAILURE:', err);
  process.exit(1);
});