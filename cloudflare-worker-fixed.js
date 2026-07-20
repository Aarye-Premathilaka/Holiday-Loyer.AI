const ALLOWED_ORIGINS = [
  "https://aarye-premathilaka.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  return {
    "Access-Control-Allow-Origin":
      origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=UTF-8",
    "X-Content-Type-Options": "nosniff",
  };
}

function jsonResponse(request, data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: corsHeaders(request),
  });
}

function extractSources(candidate) {
  const chunks = candidate?.groundingMetadata?.groundingChunks || [];
  const unique = new Map();
  for (const chunk of chunks) {
    const title = chunk?.web?.title;
    const url = chunk?.web?.uri;
    if (url && !unique.has(url)) unique.set(url, { title: title || "Web source", url });
  }
  return [...unique.values()];
}

function parseModelJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const cleaned = String(text)
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    return JSON.parse(cleaned);
  }
}

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    case_summary: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    verification_points: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          field: { type: "string" },
          value: { type: "string" },
          status: {
            type: "string",
            enum: [
              "verified_by_public_source",
              "supported_by_user_document",
              "user_provided_only",
              "conflicting",
              "unable_to_verify",
            ],
          },
          evidence: { type: "string" },
        },
        required: ["field", "value", "status", "evidence"],
      },
    },
    applicable_rules: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          rule: { type: "string" },
          article: { type: "string" },
          explanation: { type: "string" },
          source_organisation: { type: "string" },
        },
        required: ["rule", "article", "explanation", "source_organisation"],
      },
    },
    possible_entitlement: { type: "string" },
    contradictions: { type: "array", items: { type: "string" } },
    missing_evidence: { type: "array", items: { type: "string" } },
    next_steps: { type: "array", items: { type: "string" } },
    email: {
      type: "object",
      additionalProperties: false,
      properties: {
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["subject", "body"],
    },
    disclaimer: { type: "string" },
  },
  required: [
    "case_summary",
    "confidence",
    "verification_points",
    "applicable_rules",
    "possible_entitlement",
    "contradictions",
    "missing_evidence",
    "next_steps",
    "email",
    "disclaimer",
  ],
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const origin = request.headers.get("Origin");
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return jsonResponse(request, { error: "This website is not allowed to use the API." }, 403);
    }

    if (request.method === "GET") {
      return jsonResponse(request, {
        ok: true,
        service: "HolidayLawyer.ai API",
        assistant: "Bruce Rogers",
        model: "gemini-2.5-flash-lite",
        version: "2026-07-20-fixed",
        message: "The secure AI backend is running.",
      });
    }

    if (request.method !== "POST") {
      return jsonResponse(request, { error: "Method not allowed." }, 405);
    }

    if (!env.GEMINI_API_KEY) {
      return jsonResponse(request, { error: "GEMINI_API_KEY is not configured." }, 500);
    }

    try {
      const submittedCase = await request.json();
      if (!submittedCase || typeof submittedCase !== "object") {
        return jsonResponse(request, { error: "Valid case information is required." }, 400);
      }

      const prompt = `
You are Bruce Rogers, the AI Claims Assistant for HolidayLawyer.ai.
You are software, not a human or licensed lawyer.

Research and organise factual passenger-rights information for the submitted case.
Use Google Search to investigate the airline, flight number, route, official passenger-rights rules, and official airline claim procedures when relevant.

Prioritise official sources:
- europa.eu
- eur-lex.europa.eu
- bazl.admin.ch
- official national aviation authorities
- official courts
- official airports
- the operating airline's official website

Rules:
- Treat all user-entered facts as unverified unless supported by a public source.
- Public flight data cannot prove passenger identity, booking ownership, cabin class, ticket price, or whether the claimant boarded.
- Never invent facts, legal provisions, flight times, delay reasons, or compensation.
- Distinguish the marketing airline from the operating airline.
- Clearly identify conflicts, missing evidence, and facts that cannot be verified.
- Do not guarantee compensation.
- Use only laws relevant to the submitted route and disruption.

Write a professional claim email using only supported facts.
End the email exactly with:

Yours faithfully,

Bruce Rogers
AI Claims Assistant
HolidayLawyer.ai

Prepared on behalf of:
[Claimant name, or "the claimant" when unavailable]

Reviewed and approved by the claimant

SUBMITTED CASE:
${JSON.stringify(submittedCase, null, 2)}
`;

      const endpoint =
        "https://generativelanguage.googleapis.com/v1beta/models/" +
        "gemini-2.5-flash-lite:generateContent";

      const geminiResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          tools: [
            {
              googleSearch: {},
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 7000,
            responseMimeType: "application/json",
            responseSchema,
          },
        }),
      });

      const geminiData = await geminiResponse.json();

      if (!geminiResponse.ok) {
        return jsonResponse(
          request,
          {
            error: "Gemini could not process the case.",
            details:
              geminiData?.error?.message ||
              "Check the API key, model access, request format, and quota.",
          },
          geminiResponse.status,
        );
      }

      const candidate = geminiData?.candidates?.[0];
      const modelText = candidate?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim();

      if (!modelText) {
        return jsonResponse(
          request,
          {
            error: "Gemini returned no usable answer.",
            finishReason: candidate?.finishReason || "unknown",
          },
          502,
        );
      }

      const analysis = parseModelJson(modelText);
      return jsonResponse(request, {
        ok: true,
        assistant: "Bruce Rogers",
        generatedAt: new Date().toISOString(),
        analysis,
        sources: extractSources(candidate),
        searchQueries: candidate?.groundingMetadata?.webSearchQueries || [],
        usage: geminiData?.usageMetadata || null,
      });
    } catch (error) {
      return jsonResponse(
        request,
        {
          error: "The request could not be completed.",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  },
};
