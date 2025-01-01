import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const channelStatus = [
    { id: 0, name: "registered", description: "just registered" },
    { id: 1, name: "operating", description: "operating" },
    { id: 2, name: "retired", description: "retired" },
  ];
  await Promise.all(
    channelStatus.map(async (seed) => {
      await prisma.channelStatus.upsert({
        where: { id: seed.id },
        update: {},
        create: { ...seed },
      });
    }),
  );
}
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
