module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      businessName,
      businessType,
      phone,
      details,
      command,
      existingState,
      model
    } = req.body || {};

    const apiKey = process.env.AI_API_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "AI_API_KEY missing" });
    }

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        error: "Supabase environment variables missing"
      });
    }

    const previousState = existingState
      ? JSON.stringify(existingState)
      : "No previous website state";

    const prompt = `
You are BizPilot AI, an AI website-building agent.

Business:
Name: ${businessName || ""}
Type: ${businessType || ""}
Phone: ${phone || ""}
Details: ${details || ""}

Previous website state:
${previousState}

User command:
${command || "Create the initial website"}

Create or update the website based on the user command.

Return ONLY valid JSON.

JSON format:
{
  "headline": "string",
  "description": "string",
  "services": [
    {
      "name": "string",
      "description": "string"
    }
  ],
  "cta": "string",
  "buttons": [
    {
      "label": "string",
      "type": "call"
    }
  ],
  "design": {
    "style": "premium",
    "primaryColor": "#000000",
    "backgroundColor": "#111111",
    "textColor": "#ffffff",
    "heroBackground": "#000000"
  },
  "changes": [
    "string"
  ]
}

Important:
- Keep previous information unless the user asks to change it.
- Apply the new user command.
- Return complete updated website state.
- Do not return markdown.
`;

    const aiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" +
        encodeURIComponent(apiKey),
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
          ],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json"
          }
        })
      }
    );

    const aiData = await aiResponse.json();

    if (!aiResponse.ok) {
      console.error("Gemini error:", aiData);

      return res.status(500).json({
        error:
          aiData?.error?.message ||
          "AI generation failed"
      });
    }

    const rawText =
      aiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return res.status(500).json({
        error: "AI returned empty response"
      });
    }

    let websiteState;

    try {
      websiteState = JSON.parse(rawText);
    } catch (error) {
      console.error("JSON parse error:", rawText);

      return res.status(500).json({
        error: "AI returned invalid JSON"
      });
    }

    // Save project to Supabase
    const searchUrl =
      supabaseUrl +
      "/rest/v1/projects?business_name=eq." +
      encodeURIComponent(businessName || "") +
      "&select=id";

    const supabaseHeaders = {
      apikey: supabaseKey,
      Authorization: "Bearer " + supabaseKey,
      "Content-Type": "application/json"
    };

    const existingResponse = await fetch(searchUrl, {
      method: "GET",
      headers: supabaseHeaders
    });

    const existingProjects = await existingResponse.json();

    if (!existingResponse.ok) {
      console.error("Supabase search error:", existingProjects);

      return res.status(500).json({
        error: "Supabase search failed",
        details: existingProjects
      });
    }

    const projectData = {
      business_name: businessName || "",
      business_type: businessType || "",
      details: details || "",
      website_state: websiteState
    };

    if (
      Array.isArray(existingProjects) &&
      existingProjects.length > 0
    ) {
      const projectId = existingProjects[0].id;

      const updateUrl =
        supabaseUrl +
        "/rest/v1/projects?id=eq." +
        encodeURIComponent(projectId);

      const updateResponse = await fetch(updateUrl, {
        method: "PATCH",
        headers: {
          ...supabaseHeaders,
          Prefer: "return=minimal"
        },
        body: JSON.stringify(projectData)
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.text();

        console.error(
          "Supabase update error:",
          errorData
        );

        return res.status(500).json({
          error: "Supabase update failed",
          details: errorData
        });
      }
    } else {
      const insertUrl =
        supabaseUrl + "/rest/v1/projects";

      const insertResponse = await fetch(insertUrl, {
        method: "POST",
        headers: {
          ...supabaseHeaders,
          Prefer: "return=minimal"
        },
        body: JSON.stringify(projectData)
      });

      if (!insertResponse.ok) {
        const errorData = await insertResponse.text();

        console.error(
          "Supabase insert error:",
          errorData
        );

        return res.status(500).json({
          error: "Supabase insert failed",
          details: errorData
        });
      }
    }

    return res.status(200).json({
      success: true,
      model: model || "gemini-3.6-flash",
      business: businessName,
      agent: websiteState,
      saved: true
    });
  } catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({
      error: "Server error",
      details: error.message
    });
  }
};
