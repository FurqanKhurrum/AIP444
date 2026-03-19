import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "..", "..", ".env");
dotenv.config({ path: envPath });
export async function processImage(imagePath: string): Promise<string> {
  const absolutePath = path.resolve(imagePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Image not found: ${absolutePath}`);
  }

  const originalSize = fs.statSync(absolutePath).size;

  const buffer = await sharp(absolutePath)
    .resize(1024, 1024, { fit: "inside" })
    .jpeg({ quality: 85 })
    .toBuffer();

  const processedSize = buffer.length;
  const base64 = buffer.toString("base64");
  const base64Size = Buffer.byteLength(base64, "utf8");

  // Log size stats to stderr so they don't pollute stdout output
  console.error(`[Image Stats]`);
  console.error(`  Original:   ${(originalSize / 1024).toFixed(1)} KB`);
  console.error(`  Processed:  ${(processedSize / 1024).toFixed(1)} KB`);
  console.error(`  Base64:     ${(base64Size / 1024).toFixed(1)} KB`);

  return base64;
}