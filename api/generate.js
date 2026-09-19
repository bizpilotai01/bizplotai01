export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { businessName, businessType, details } = req.body;

  if (!businessName || !businessType) {
    return res.status(400).json({
      error: "Business name and type are required"
    });
  }

  return res.status(200).json({
    success: true,
    message: "AI generation API is ready!",
    business: {
      name: businessName,
      type: businessType,
      details: details || ""
    }
  });
}
