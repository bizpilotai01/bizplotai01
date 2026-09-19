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

Business:
Name: ${businessName}
Type: ${businessType}
Details: ${details || "Not provided"}

User request:
${command || "Create a professional website"}

Your job is to understand the user's request and return the COMPLETE website state.

IMPORTANT:
- The user may be creating a website for the first time.
- The user may also ask you to MODIFY an existing website.
- Always return the complete updated state.
- Preserve existing business information unless the user explicitly asks to change it.
- If the user asks for a design change, reflect that change in the design object.
- If the user asks for a new button, include it in buttons.
- If the user asks for services, update the services array.
- If the user asks for colors, update the design colors.
- Never return Markdown.
- Return ONLY valid JSON.

Return exactly:

{
  "headline": "website headline",
  "description": "professional website description",
  "services": [
    "service 1",
    "service 2",
    "service 3",
    "service 4"
  ],
  "cta": "call to action",
  "buttons": [
    {
      "label": "button text",
      "type": "whatsapp"
    }
  ],
  "design": {
    "style": "modern",
    "primaryColor": "#6366f1",
    "backgroundColor": "#ffffff",
    "textColor": "#111827",
    "heroBackground": "#111827"
  },
  "changes": [
    "clear description of what was created or changed"
  ]
}
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

      return res.status(500).json({
        error: "AI returned invalid JSON"
      });

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
