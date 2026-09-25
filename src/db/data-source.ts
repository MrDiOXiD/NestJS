import 'dotenv/config';
import { join } from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',

  host: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT),

  username: process.env.DB_USERNAME!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_NAME!,

  entities: [join(__dirname, '/../**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, '/migrations/*{.ts,.js}')],

  synchronize: false, // never use TRUE in production! (use migrations instead)

  ssl: false,
};


if (!process.env.DB_HOST) {
  throw new Error('DB_HOST is missing in environment');
}

if (!process.env.DB_PASSWORD) {
  throw new Error('DB_PASSWORD is missing in environment');
}
console.log('=== DATABASE CONNECTION TEST ===');
console.log('HOST:', process.env.DB_HOST);
console.log('PORT:', process.env.DB_PORT);
console.log('================================');
const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;