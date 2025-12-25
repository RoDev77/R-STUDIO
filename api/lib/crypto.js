import crypto from "crypto";

export function sign(payload) {
  return crypto
    .createHmac("sha256", process.env.LICENSE_SECRET)
    .update(JSON.stringify(payload))
    .digest("hex");
}
