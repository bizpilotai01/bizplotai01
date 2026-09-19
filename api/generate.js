export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const {
    businessName,
    businessType,
    details,
    command,
    model
  } = req.body;

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
You are BizPilot AI, an AI website-building agent.

Business Name:
${businessName}

Business Type:
${businessType}

Business Details:
${details || "Not provided"}

User Command:
${command || "Create a professional website"}

Selected Model:
${model || "gemini"}

Your job is to understand the user's request and generate content/instructions for a professional business website.

Return ONLY valid JSON.

Use exactly this structure:

{
  "headline": "short website headline",
  "description": "professional business description",
  "services": [
    "service 1",
    "service 2",
    "service 3",
    "service 4"
  ],
  "cta": "short call to action",
  "design": {
    "style": "modern",
    "primaryColor": "#6366f1",
    "backgroundColor": "#ffffff"
  },
  "changes": [
    "what the AI agent created",
    "what the AI agent changed"
  ]
}

Do not use Markdown.
Do not put JSON inside a code block.
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

    let agentResult;

    try {

      const cleanText = aiText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      agentResult = JSON.parse(cleanText);

    } catch (error) {

      agentResult = {
        headline: businessName,

        description:
          aiText || "Professional business website",

        services: [],

        cta: "Contact us today",

        design: {
          style: "modern",
          primaryColor: "#6366f1",
          backgroundColor: "#ffffff"
        },

        changes: [
          "AI generated website content"
        ]
      };
    }

    return res.status(200).json({

      success: true,

      model: model || "gemini",

      business: {
        name: businessName,
        type: businessType,
        details: details || ""
      },

      agent: agentResult

    });

  } catch (error) {

    return res.status(500).json({
      error: error.message || "Server error"
    });

  }

}
