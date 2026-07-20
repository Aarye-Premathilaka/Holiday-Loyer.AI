const ALLOWED_ORIGINS = [
  "https://aarye-premathilaka.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

const MODEL = "gemini-3.1-flash-lite";
const VERSION = "2026-07-20-gemini-3.1";

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
    const url = chunk?.web?.uri;
    if (!url || unique.has(url)) continue;
    unique.set(url, {
      title: chunk?.web?.title || "Official web source",
      url,
    });
  }

  return Array.from(unique.values());
}

function removeCodeFence(text) {
  return String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function findJsonObject(text) {
  const cleaned = removeCodeFence(text);

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }
    throw new Error("Gemini did not return valid JSON.");
  }
}

function asString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function normalizeVerificationPoints(value) {
  if (!Array.isArray(value)) return [];
  const allowed = new Set([
    "verified_by_public_source",
    "supported_by_user_document",
    "user_provided_only",
    "conflicting",
    "unable_to_verify",
  ]);

  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      field: asString(item.field, "Case fact"),
      value: asString(item.value, "Not available"),
      status: allowed.has(item.status) ? item.status : "unable_to_verify",
      evidence: asString(item.evidence, "No supporting explanation was returned."),
    }))
    .slice(0, 20);
}

function normalizeRules(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      rule: asString(item.rule, "Passenger-rights rule"),
      article: asString(item.article),
      explanation: asString(item.explanation),
      source_organisation: asString(item.source_organisation, "Official source"),
    }))
    .slice(0, 15);
}

function normalizeAnalysis(raw) {
  const analysis = raw && typeof raw === "object" ? raw : {};
  const confidence = ["low", "medium", "high"].includes(analysis.confidence)
    ? analysis.confidence
    : "medium";

  const email = analysis.email && typeof analysis.email === "object"
    ? analysis.email
    : {};

  return {
    case_summary: asString(
      analysis.case_summary,
      "The case was reviewed using the information provided and available public sources."
    ),
    confidence,
    verification_points: normalizeVerificationPoints(analysis.verification_points),
    applicable_rules: normalizeRules(analysis.applicable_rules),
    possible_entitlement: asString(
      analysis.possible_entitlement,
      "The available evidence is not sufficient to confirm an entitlement."
    ),
    contradictions: asStringArray(analysis.contradictions),
    missing_evidence: asStringArray(analysis.missing_evidence),
    next_steps: asStringArray(analysis.next_steps),
    email: {
      subject: asString(email.subject, "Passenger-rights claim"),
      body: asString(
        email.body,
        "Dear Claims Department,\n\nPlease review the attached passenger-rights claim and supporting information.\n\nYours faithfully,\n\nBruce Rogers\nAI Claims Assistant\nHolidayLawyer.ai"
      ),
    },
    disclaimer: asString(
      analysis.disclaimer,
      "General information only. Bruce Rogers is software, not a human or licensed lawyer. The claimant must review and approve every statement before use."
    ),
  };
}

function buildPrompt(submittedCase) {
  return `
You are Bruce Rogers, the AI Claims Assistant for HolidayLawyer.ai.
You are software, not a human lawyer, and must never claim to be licensed.

Research the submitted flight or baggage case using Google Search. Prefer official sources:
- europa.eu
- eur-lex.europa.eu
- bazl.admin.ch
- official aviation authorities
- official courts
- official airports
- the operating airline's official website

Rules:
- Treat every user-entered statement as unverified unless supported by a public source.
- Public flight information can support the airline, route, scheduled times, or public status, but cannot prove passenger identity, booking ownership, cabin class, ticket price, or document authenticity.
- Never invent facts, compensation, delay reasons, passenger data, laws, or judgments.
- Distinguish the operating airline from the marketing airline.
- Use cautious wording and do not guarantee compensation.
- Include only laws that are relevant to this route and disruption.
- Prepare a professional claim email using supported facts only.
- End the email with this exact closing:

Yours faithfully,

Bruce Rogers
AI Claims Assistant
HolidayLawyer.ai

Prepared on behalf of:
[claimant name or "the claimant"]

Reviewed and approved by the claimant

Return ONLY one valid JSON object. Do not use markdown or code fences.
Use exactly these top-level keys and value types:
{
  "case_summary": "string",
  "confidence": "low | medium | high",
  "verification_points": [
    {
      "field": "string",
      "value": "string",
      "status": "verified_by_public_source | supported_by_user_document | user_provided_only | conflicting | unable_to_verify",
      "evidence": "string"
    }
  ],
  "applicable_rules": [
    {
      "rule": "string",
      "article": "string",
      "explanation": "string",
      "source_organisation": "string"
    }
  ],
  "possible_entitlement": "string",
  "contradictions": ["string"],
  "missing_evidence": ["string"],
  "next_steps": ["string"],
  "email": {
    "subject": "string",
    "body": "string"
  },
  "disclaimer": "string"
}

SUBMITTED CASE:
${JSON.stringify(submittedCase, null, 2)}
`;
}

async function callGemini(env, submittedCase) {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: buildPrompt(submittedCase) }],
        },
      ],
      tools: [{ googleSearch: {} }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 7000,
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  return { response, data };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    const origin = request.headers.get("Origin");
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return jsonResponse(
        request,
        { error: "This website is not allowed to use the API." },
        403
      );
    }

    if (request.method === "GET") {
      return jsonResponse(request, {
        ok: true,
        service: "HolidayLawyer.ai API",
        assistant: "Bruce Rogers",
        model: MODEL,
        version: VERSION,
        message: "The secure AI backend is running.",
      });
    }

    if (request.method !== "POST") {
      return jsonResponse(request, { error: "Method not allowed." }, 405);
    }

    if (!env.GEMINI_API_KEY) {
      return jsonResponse(
        request,
        { error: "GEMINI_API_KEY is not configured." },
        500
      );
    }

    try {
      const contentLength = Number(request.headers.get("Content-Length") || "0");
      if (contentLength > 150000) {
        return jsonResponse(
          request,
          { error: "The submitted information is too large." },
          413
        );
      }

      const submittedCase = await request.json();
      if (!submittedCase || typeof submittedCase !== "object") {
        return jsonResponse(
          request,
          { error: "Valid case information is required." },
          400
        );
      }

      const { response, data } = await callGemini(env, submittedCase);

      if (!response.ok) {
        return jsonResponse(
          request,
          {
            error: "Gemini could not process the case.",
            details:
              data?.error?.message ||
              "Check the API key, model access, quota, or request format.",
          },
          response.status
        );
      }

      const candidate = data?.candidates?.[0];
      const modelText = candidate?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim();

      if (!modelText) {
        return jsonResponse(
          request,
          {
            error: "Gemini returned no usable answer.",
            details: `Finish reason: ${candidate?.finishReason || "unknown"}`,
          },
          502
        );
      }

      let parsed;
      try {
        parsed = findJsonObject(modelText);
      } catch (error) {
        return jsonResponse(
          request,
          {
            error: "Gemini returned an answer that could not be read.",
            details: error instanceof Error ? error.message : "Invalid JSON response.",
          },
          502
        );
      }

      return jsonResponse(request, {
        ok: true,
        assistant: "Bruce Rogers",
        generatedAt: new Date().toISOString(),
        analysis: normalizeAnalysis(parsed),
        sources: extractSources(candidate),
        searchQueries: candidate?.groundingMetadata?.webSearchQueries || [],
        usage: data?.usageMetadata || null,
      });
    } catch (error) {
      return jsonResponse(
        request,
        {
          error: "The request could not be completed.",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  },
};
