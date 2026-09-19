module.exports = async function handler(req, res) {

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
    model,
    existingState
  } = req.body;

  if (!businessName || !businessType) {
    return res.status(400).json({
      error: "Business name and type are required"
    });
  }

  const apiKey = process.env.AI_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "AI_API_KEY is not configured"
    });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: "Supabase environment variables are not configured"
    });
  }

  const previousState =
    existingState && typeof existingState === "object"
      ? JSON.stringify(existingState)
      : "No previous website state exists.";

  const prompt = `
You are BizPilot AI, an AI website-building agent.

Business:
Name: ${businessName}
Type: ${businessType}
Details: ${details || "Not provided"}

Previous website state:
${previousState}

User request:
${command || "Create a professional website"}

Your job is to understand the user's request and return the COMPLETE UPDATED website state.

IMPORTANT:
- If this is a new website, create the complete website state.
- If a previous website state exists, MODIFY that state according to the user's request.
- Preserve existing information unless the user asks to change it.
- Never remove existing services unless the user asks.
- If the user asks to add a service, keep the existing services and add the new one.
- If the user asks to change colors, update the design colors.
- If the user asks to add a button, include it.
- If the user asks to change the headline, change only the headline unless necessary.
- Always return the COMPLETE website state.
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

    /*
      SAVE WEBSITE STATE TO SUPABASE
    */

    const projectData = {
      business_name: businessName,
      business_type: businessType,
      details: details || "",
      website_state: agentResult
    };

    const existingResponse = await fetch(
      `${supabaseUrl}/rest/v1/projects?business_name=eq.${encodeURIComponent(businessName)}&select=id`,
      {
        method: "GET",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`
        }
      }
    );

    const existingProjects = await existingResponse.json();

    let saveResponse;

    if (Array.isArray(existingProjects) && existingProjects.length > 0) {

      const projectId = existingProjects[0].id;

      saveResponse = await fetch(
        `${supabaseUrl}/rest/v1/projects?id=eq.${projectId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}",
            "Prefer": "return=minimal"
          },
          body: JSON.stringify(projectData)
        }
      );

    } else {

      saveResponse = await fetch(
        `${supabaseUrl}/rest/v1/projects`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Prefer": "return=minimal"
          },
          body: JSON.stringify(projectData)
        }
      );

    }

    if (!saveResponse.ok) {

      const saveError = await saveResponse.text();

      console.log("Supabase save error:", saveError);

      return res.status(500).json({
        error: "Website generated, but Supabase save failed",
        details: saveError
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

      agent: agentResult,

      saved: true

    });

  } catch (error) {

    return res.status(500).json({
      error: error.message || "Server error"
    });

  }

}
