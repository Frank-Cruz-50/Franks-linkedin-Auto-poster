// Creates .env from .env.example on first install so `npm run seed` works out of the box.
import { existsSync, copyFileSync } from "node:fs";
if (!existsSync(".env") && existsSync(".env.example")) {
  copyFileSync(".env.example", ".env");
  console.log("Created .env from .env.example. Add your Typefully and Unsplash keys there.");
}
