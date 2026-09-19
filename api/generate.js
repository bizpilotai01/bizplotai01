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

  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "AI_API_KEY is not configured"
    });
  }

  const prompt = `
Create professional website content for this local business.

Business Name: ${businessName}
Business Type: ${businessType}
Business Details: ${details || "Not provided"}

Create:
1. A catchy headline
2. A short professional description
3. A list of services
4. A strong call-to-action

Keep the content concise and suitable for a modern business website.
`;

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" + apiKey,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Gemini API request failed"
      });
    }

    const aiText =
      data.candidates?.[0]?.content?.parts
        ?.map(part => part.text)
        .join("") || "";

    return res.status(200).json({
      success: true,
      business: {
        name: businessName,
        type: businessType,
        details: details || ""
      },
      ai: aiText
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
}
