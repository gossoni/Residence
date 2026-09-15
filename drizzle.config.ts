// import "dotenv/config";
// import { defineConfig } from "drizzle-kit";

// const databaseUrl = process.env.DATABASE_URL;

// if (!databaseUrl) {
//   throw new Error(
//     "DATABASE_URL is required (vérifiez votre fichier .env à la racine du // // projet).",
//   );
// }

// export default defineConfig({
//   dialect: "postgresql",
//   schema: "./src/db/schema.ts",
//   dbCredentials: {
//     url: databaseUrl,
//   },
// });

import "dotenv/config";

export default {
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
};
