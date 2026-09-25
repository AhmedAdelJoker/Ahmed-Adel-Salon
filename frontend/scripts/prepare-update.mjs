import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function keyBuffer(value, name) {
  if (!value) {
    throw new Error(`${name} is required`);
  }
  if (value.includes("BEGIN")) {
    return Buffer.from(value, "utf8");
  }
  return Buffer.from(value, "base64");
}

const artifact = argument("--artifact");
const version = argument("--version");
const outputDir = argument("--output");
const notes = argument("--notes") || "";

if (!artifact || !version || !outputDir) {
  throw new Error("Usage: node scripts/prepare-update.mjs --artifact <zip> --version <semver> --output <dir>");
}
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error("Invalid release version");
}

const privateKeyValue = process.env.UPDATE_SIGNING_PRIVATE_KEY;
const privateKey = crypto.createPrivateKey(keyBuffer(privateKeyValue, "UPDATE_SIGNING_PRIVATE_KEY"));
if (privateKey.asymmetricKeyType !== "ed25519") {
  throw new Error("UPDATE_SIGNING_PRIVATE_KEY must be an Ed25519 private key");
}

const derivedPublicKey = crypto.createPublicKey(privateKey);
const publicKeyValue = process.env.UPDATE_SIGNING_PUBLIC_KEY;
const publicKey = publicKeyValue
  ? crypto.createPublicKey(keyBuffer(publicKeyValue, "UPDATE_SIGNING_PUBLIC_KEY"))
  : derivedPublicKey;
const derivedDer = derivedPublicKey.export({ type: "spki", format: "der" });
const suppliedDer = publicKey.export({ type: "spki", format: "der" });
if (!derivedDer.equals(suppliedDer)) {
  throw new Error("The configured update public key does not match the private key");
}

const artifactPath = path.resolve(artifact);
const artifactData = await fs.readFile(artifactPath);
const sha256 = crypto.createHash("sha256").update(artifactData).digest("hex");
const signature = crypto
  .sign(null, Buffer.from(`${version}:${sha256}`), privateKey)
  .toString("base64");

await fs.mkdir(outputDir, { recursive: true });
const updatePath = path.join(outputDir, `update-${version}.zip`);
await fs.copyFile(artifactPath, updatePath);
await fs.writeFile(
  path.join(outputDir, "version.json"),
  `${JSON.stringify({ version, sha256, signature, notes }, null, 2)}\n`,
  "utf8",
);
await fs.writeFile(
  path.join(outputDir, "update-public-key.pem"),
  publicKey.export({ type: "spki", format: "pem" }),
  "utf8",
);

console.log(`Prepared signed update ${version} at ${outputDir}`);
