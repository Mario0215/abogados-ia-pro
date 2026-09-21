import { PrismaClient } from '@prisma/client';

// Fallback para nombres alternativos de variables de entorno
if (!process.env.DATABASE_URL && process.env.URL_DE_LA_BASE_DE_DATOS) {
  process.env.DATABASE_URL = process.env.URL_DE_LA_BASE_DE_DATOS;
}

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn']
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
