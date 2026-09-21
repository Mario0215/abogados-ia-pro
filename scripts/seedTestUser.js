const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: 'matrix@example.com' },
    update: {},
    create: {
      id: 'matrix-user',
      name: 'Matrix',
      email: 'matrix@example.com',
      passwordHash: 'x',
      role: 'ABOGADO',
      active: true
    }
  });
  console.log('ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
