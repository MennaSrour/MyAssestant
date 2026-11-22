const { resolve } = require("node:path");
const { PrismaClientTsGenerator } = require("@prisma/client-generator-ts");
const { getGenerators } = require("@prisma/internals");

async function main() {
  // The PostgreSQL driver adapter uses Prisma's bundled WASM client.
  const generators = await getGenerators({
    schemaPath: resolve(__dirname, "../prisma/schema.prisma"),
    registry: {
      "prisma-client": {
        type: "in-process",
        generator: new PrismaClientTsGenerator(),
      },
    },
    cliCommand: "npm run postinstall",
  });
  try {
    for (const generator of generators) await generator.generate();
  } finally {
    for (const generator of generators) generator.stop();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
