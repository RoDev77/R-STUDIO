export default function handler(req, res) {
  // OPTIONAL: anti cache
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  // Bisa kamu ubah kapan saja tanpa update game
  const copyrightText = "© rstudiolab.online";

  res.status(200).json({
    success: true,
    text: copyrightText,
    timestamp: Date.now()
  });
}
