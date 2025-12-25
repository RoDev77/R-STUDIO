// api2/copyright.js
export default function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  res.status(200).json({
    success: true,
    text: "© R STUDIO",
    owner: "R STUDIO",
    website: "https://rstudiolab.online",
    updatedAt: new Date().toISOString(),
  });
}
