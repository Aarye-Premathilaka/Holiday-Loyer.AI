(() => {
  "use strict";

  const TECHNICAL_ERROR_PATTERN = /additionalProperties|response_schema|Invalid JSON payload|generation_config|responseSchema|no longer available|newer model|model.*not.*available|quota|billing|rate.?limit|RESOURCE_EXHAUSTED|429|exceeded your current quota/i;

  function formValue(name) {
    const value = document.getElementById("caseForm")?.elements[name]?.value;
    return typeof value === "string" ? value.trim() : "";
  }

  function selectedCaseType() {
    return document.querySelector('input[name="caseType"]:checked')?.value || "flight";
  }

  function declaredEvidence() {
    return [...document.querySelectorAll('input[name="evidence"]:checked')].map((item) => item.value);
  }

  function incidentLabel() {
    const labels = {
      delay: "arrival delay",
      cancellation: "flight cancellation",
      denied: "denied boarding",
      connection: "missed connection",
      delayed: "delayed baggage",
      lost: "missing baggage",
      damaged: "damaged baggage"
    };
    return labels[formValue(selectedCaseType() === "baggage" ? "baggageIncident" : "flightIncident")] || "travel disruption";
  }

  function requestedText() {
    const labels = {
      compensation: "payment of any compensation that is legally due",
      refund: "a refund of the affected travel service",
      expenses: "reimbursement of documented necessary expenses",
      "compensation-expenses": "any compensation due together with reimbursement of documented necessary expenses",
      "written-response": "a clear written explanation and an appropriate resolution"
    };
    return labels[formValue("requestedOutcome")] || "an appropriate written resolution";
  }

  function buildOfflinePayload() {
    const type = selectedCaseType();
    const airline = formValue("airline") || "the operating airline";
    const flight = formValue("flightNumber").toUpperCase() || "the stated flight";
    const date = formValue("flightDate") || "the stated travel date";
    const route = `${formValue("departureAirport") || "the stated departure"} to ${formValue("arrivalAirport") || "the stated destination"}`;
    const incident = incidentLabel();
    const statement = formValue("caseSummary") || `The claimant reports a ${incident} affecting ${flight}.`;
    const evidence = declaredEvidence();

    const rules = type === "baggage"
      ? [
          {
            rule: "Montreal Convention 1999",
            article: "Articles 17, 22 and 31",
            explanation: "May govern carrier liability, limits and written complaint requirements for checked baggage. The exact time limits and entitlement depend on the facts and evidence.",
            source_organisation: "ICAO / applicable national law"
          }
        ]
      : [
          {
            rule: "Regulation (EC) No 261/2004",
            article: "Articles 5–9",
            explanation: "May provide rights concerning cancellation, delay, compensation, reimbursement or re-routing, and care when the route and operating carrier fall within scope.",
            source_organisation: "European Union"
          }
        ];

    const evidenceNames = {
      booking: "booking confirmation",
      boarding: "boarding pass",
      messages: "airline messages",
      receipts: "receipts",
      photos: "photos",
      pir: "baggage incident report"
    };
    const availableEvidence = evidence.map((key) => evidenceNames[key]).filter(Boolean);
    const missing = [];
    if (!evidence.includes("booking")) missing.push("Booking confirmation or e-ticket");
    if (type === "flight" && !evidence.includes("messages")) missing.push("Airline notification or explanation of the disruption");
    if (type === "baggage" && !evidence.includes("pir")) missing.push("Property Irregularity Report or baggage incident reference");
    if (formValue("requestedOutcome").includes("expenses") && !evidence.includes("receipts")) missing.push("Receipts for claimed expenses");

    const body = `Dear Claims Department,\n\nI write on behalf of ${formValue("claimantName") || "the claimant"} concerning ${incident} affecting ${flight} on ${date}, on the route ${route}.\n\nThe claimant's account is as follows:\n- ${statement}\n- Booking reference: ${formValue("bookingReference") || "not supplied"}\n- Evidence currently declared: ${availableEvidence.length ? availableEvidence.join(", ") : "none listed"}\n\nThe claimant requests ${requestedText()}. Please investigate the disruption, preserve the relevant operational records, and provide a reasoned written response together with any payment, reimbursement, re-routing or other remedy that is legally due.\n\nThis draft has been prepared from the information entered by the claimant. No independent live verification was completed, so every factual statement and legal reference must be checked before the document is sent.\n\nYours faithfully,\n\nBruce Rogers\nAI Claims Assistant\nHolidayLawyer.ai`;

    return {
      ok: true,
      assistant: "Bruce Rogers",
      generatedAt: new Date().toISOString(),
      offlineFallback: true,
      analysis: {
        case_summary: `${airline}: ${incident} concerning ${flight}, ${route}. ${statement}`,
        confidence: "low",
        verification_points: [
          {
            field: "Airline",
            value: airline,
            status: "user_provided_only",
            evidence: "Taken from the claimant's form; not independently verified in offline mode."
          },
          {
            field: "Flight and route",
            value: `${flight} · ${route}`,
            status: "user_provided_only",
            evidence: "Taken from the claimant's form; not independently verified in offline mode."
          },
          {
            field: "Travel date",
            value: date,
            status: "user_provided_only",
            evidence: "Taken from the claimant's form; not independently verified in offline mode."
          }
        ],
        applicable_rules: rules,
        possible_entitlement: `The claimant may request ${requestedText()}, subject to route coverage, the cause of the disruption, applicable time limits and supporting evidence.`,
        contradictions: [],
        missing_evidence: missing,
        next_steps: [
          "Review and correct every factual statement before sending.",
          "Attach the booking confirmation and all relevant airline correspondence.",
          "Check the applicable official passenger-rights source for the route and disruption."
        ],
        email: {
          subject: `Formal claim concerning ${flight} — ${incident}`,
          body
        },
        disclaimer: "Offline fallback draft only. No live web, flight-data or document-authenticity verification was completed. Bruce Rogers is software, not a human or licensed lawyer."
      },
      sources: type === "baggage"
        ? [{ title: "ICAO — Montreal Convention", url: "https://www.icao.int/secretariat/legal/List%20of%20Parties/Mtl99_EN.pdf" }]
        : [
            { title: "EU air passenger rights", url: "https://europa.eu/youreurope/citizens/travel/passenger-rights/air/index_en.htm" },
            { title: "Swiss FOCA air passenger rights", url: "https://www.bazl.admin.ch/en/airpassengerrights" }
          ]
    };
  }

  function buildOfflineDocument() {
    try {
      const payload = buildOfflinePayload();
      if (typeof state !== "undefined") {
        state.aiResponse = payload;
        if (!state.reference && typeof createReference === "function") state.reference = createReference();
      }

      const claimLetter = document.getElementById("claimLetter");
      const letterCard = document.getElementById("letterCard");
      if (!claimLetter || !letterCard) return false;

      claimLetter.innerHTML = '<div class="offline-formal-trigger" aria-hidden="true"></div>';
      letterCard.classList.remove("hidden");
      document.querySelector("#letterCard h2")?.replaceChildren(document.createTextNode("Formal claim document"));

      setTimeout(() => {
        if (!claimLetter.querySelector(".formal-legal-document") && typeof buildLetter === "function") {
          claimLetter.innerHTML = buildLetter();
        }
      }, 150);

      return true;
    } catch (error) {
      console.error("Offline document fallback failed", error);
      return false;
    }
  }

  function showCaseView() {
    try {
      if (typeof showView === "function") showView("case");
      else {
        document.querySelectorAll(".app-view").forEach((view) => view.classList.remove("active"));
        document.querySelector('[data-view="case"]')?.classList.add("active");
      }
    } catch {
      // Keep the current view if navigation is unavailable.
    }
  }

  function replaceTechnicalError() {
    const panel = document.getElementById("aiResearchPanel");
    const errorCard = panel?.querySelector(".ai-error-card");
    if (!panel || !errorCard || errorCard.dataset.resilientHandled === "yes") return;

    const rawText = errorCard.textContent || "";
    if (!TECHNICAL_ERROR_PATTERN.test(rawText)) return;
    errorCard.dataset.resilientHandled = "yes";

    const created = buildOfflineDocument();
    panel.classList.remove("hidden");
    panel.innerHTML = `
      <div class="ai-loading-card">
        <div class="ai-bruce-identity" style="margin-bottom:14px">
          <span class="ai-bruce-mark">BR</span>
          <div><strong style="color:#17233a">Bruce Rogers</strong><span style="color:#718096">AI Claims Assistant</span></div>
        </div>
        <h3>${created ? "Your formal document is ready" : "Live research is temporarily unavailable"}</h3>
        <p>${created
          ? "The live AI allowance is temporarily unavailable, so a clearly labelled offline formal draft was created instead. No technical error will appear in the document."
          : "The live research service has not updated yet. Please retry after the Cloudflare Worker shows the final version."}</p>
        <div class="ai-meta-note">Offline mode does not independently verify the flight, airline, evidence or applicable law. Review the document before sending.</div>
        <div class="ai-action-row">
          ${created ? '<button type="button" class="primary-button" id="openOfflineFormalDocument">Open formal document</button>' : ""}
          <button type="button" class="secondary-button" id="retryLiveResearch">Try live research again</button>
        </div>
      </div>
    `;

    document.getElementById("openOfflineFormalDocument")?.addEventListener("click", showCaseView);
    document.getElementById("retryLiveResearch")?.addEventListener("click", () => {
      document.getElementById("buildLetterButton")?.click();
    });
  }

  const observer = new MutationObserver(replaceTechnicalError);
  observer.observe(document.body, { childList: true, subtree: true });
  replaceTechnicalError();
})();
