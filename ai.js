(() => {
  "use strict";

  const API_URL = "https://holidaylawyer-api.aarye-premathilaka.workers.dev";
  const statusLabels = {
    verified_by_public_source: ["Verified", "verified"],
    supported_by_user_document: ["Document", "document"],
    user_provided_only: ["User only", "user-only"],
    conflicting: ["Conflict", "conflict"],
    unable_to_verify: ["Unverified", "unknown"]
  };

  let latestAiResponse = null;

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .ai-panel{margin:18px 0 4px;padding:18px;border:1px solid #dbe6f2;border-radius:18px;background:linear-gradient(180deg,#f8fbff,#fff)}
      .ai-panel.hidden{display:none}.ai-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
      .ai-head h3{margin:2px 0 0;font-size:1.05rem}.ai-head p{margin:4px 0 0;color:var(--muted,#687386);font-size:.9rem}
      .ai-live{display:inline-flex;align-items:center;gap:7px;font-size:.78rem;font-weight:700;color:#1f5f9e;background:#eaf4ff;padding:6px 9px;border-radius:999px;white-space:nowrap}
      .ai-live::before{content:"";width:7px;height:7px;border-radius:50%;background:#2c7be5;box-shadow:0 0 0 4px rgba(44,123,229,.12)}
      .ai-loading{display:grid;gap:9px;color:#536174}.ai-loading span{display:flex;align-items:center;gap:9px}.ai-loading span::before{content:"";width:14px;height:14px;border:2px solid #bad0e8;border-top-color:#2c7be5;border-radius:50%;animation:aiSpin 1s linear infinite}
      @keyframes aiSpin{to{transform:rotate(360deg)}}
      .ai-summary{margin:0 0 14px;line-height:1.55}.ai-section{margin-top:16px}.ai-section h4{margin:0 0 9px;font-size:.92rem}.ai-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}
      .ai-point{padding:11px 12px;border:1px solid #e3e9f0;border-radius:13px;background:#fff}.ai-point-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px}.ai-point strong{font-size:.9rem}.ai-point p{margin:3px 0;color:#5f6b7a;font-size:.84rem;line-height:1.45}
      .ai-badge{display:inline-flex;padding:4px 7px;border-radius:999px;font-size:.69rem;font-weight:800;letter-spacing:.01em}.ai-badge.verified{background:#e7f7ee;color:#176b3a}.ai-badge.document{background:#eef1ff;color:#3b4ea3}.ai-badge.user-only{background:#fff5db;color:#815d00}.ai-badge.conflict{background:#ffe9e8;color:#9d2c28}.ai-badge.unknown{background:#eef1f4;color:#59636e}
      .ai-rule{padding:11px 12px;border-left:3px solid #2c7be5;background:#f6f9fc;border-radius:0 12px 12px 0}.ai-rule strong{display:block}.ai-rule small{color:#657183}.ai-rule p{margin:5px 0 0;line-height:1.45;font-size:.86rem}
      .ai-simple-list{margin:0;padding-left:20px}.ai-simple-list li{margin:6px 0;line-height:1.45}.ai-sources a{display:block;padding:9px 10px;margin:7px 0;border:1px solid #e0e7ef;border-radius:10px;background:#fff;text-decoration:none;color:#1f5f9e;font-size:.86rem;overflow-wrap:anywhere}.ai-sources a:hover{text-decoration:underline}
      .ai-warning{padding:11px 12px;border-radius:12px;background:#fff6e1;color:#704f00;font-size:.86rem;line-height:1.45}.ai-error{padding:12px;border-radius:12px;background:#fff0ef;color:#8f2925;line-height:1.5}.ai-error-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px}
      .ai-meta{margin-top:14px;padding-top:11px;border-top:1px solid #e3e9f0;color:#748091;font-size:.76rem}.ai-letter-subject{padding:12px;border-radius:12px;background:#f2f6fb;margin-bottom:18px}.ai-letter-body{white-space:pre-wrap;line-height:1.65}.ai-letter-sources{margin-top:20px;padding-top:14px;border-top:1px solid #dfe5ec}.ai-letter-sources a{overflow-wrap:anywhere}
      @media(max-width:560px){.ai-head{flex-direction:column}.ai-live{align-self:flex-start}.ai-point-top{align-items:flex-start;flex-direction:column}.ai-panel{padding:15px}}
    `;
    document.head.appendChild(style);
  }

  function getFormValue(name) {
    return document.getElementById("caseForm")?.elements[name]?.value?.trim?.() || "";
  }

  function selectedCaseType() {
    return document.querySelector('input[name="caseType"]:checked')?.value || "";
  }

  function selectedEvidence() {
    return [...document.querySelectorAll('input[name="evidence"]:checked')].map((item) => item.value);
  }

  function buildPayload() {
    return {
      caseType: selectedCaseType(),
      claimant: {
        name: getFormValue("claimantName"),
        email: getFormValue("claimantEmail")
      },
      booking: {
        reference: getFormValue("bookingReference"),
        declaredEvidence: selectedEvidence()
      },
      flight: {
        airlineEnteredByUser: getFormValue("airline"),
        flightNumberEnteredByUser: getFormValue("flightNumber").toUpperCase(),
        dateEnteredByUser: getFormValue("flightDate"),
        departureEnteredByUser: getFormValue("departureAirport"),
        arrivalEnteredByUser: getFormValue("arrivalAirport"),
        routeCoverageAnswers: {
          departureArea: getFormValue("departureArea"),
          arrivalArea: getFormValue("arrivalArea"),
          carrierArea: getFormValue("carrierArea")
        }
      },
      incident: {
        flightIncident: getFormValue("flightIncident"),
        reportedArrivalDelay: getFormValue("arrivalDelay"),
        reportedDistance: getFormValue("distance"),
        reportedCause: getFormValue("cause"),
        baggageIncident: getFormValue("baggageIncident"),
        baggageReport: getFormValue("pir"),
        reportedExpenses: getFormValue("expenses")
      },
      userStatement: getFormValue("caseSummary"),
      requestedOutcome: getFormValue("requestedOutcome"),
      verificationInstruction: "Treat all entered facts as unverified user statements unless supported by a public source. Clearly report conflicts and missing evidence."
    };
  }

  function ensurePanel() {
    let panel = document.getElementById("aiResearchPanel");
    if (panel) return panel;
    panel = document.createElement("section");
    panel.id = "aiResearchPanel";
    panel.className = "ai-panel hidden";
    const resultActions = document.querySelector("#resultCard .result-actions");
    resultActions?.parentNode?.insertBefore(panel, resultActions);
    return panel;
  }

  function setLoading() {
    const panel = ensurePanel();
    panel.classList.remove("hidden");
    panel.innerHTML = `
      <div class="ai-head"><div><span class="quiet-label">Live AI research</span><h3>Bruce is checking the case</h3><p>This can take around 10–30 seconds.</p></div><span class="ai-live">Gemini + web search</span></div>
      <div class="ai-loading"><span>Checking the flight and airline details</span><span>Finding relevant official rules</span><span>Building an evidence-based claim</span></div>
    `;
  }

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function listHtml(items, emptyText) {
    if (!Array.isArray(items) || items.length === 0) return `<p class="ai-warning">${escapeHtml(emptyText)}</p>`;
    return `<ul class="ai-simple-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function renderAiResult(payload) {
    const panel = ensurePanel();
    const analysis = payload.analysis || {};
    const points = Array.isArray(analysis.verification_points) ? analysis.verification_points : [];
    const rules = Array.isArray(analysis.applicable_rules) ? analysis.applicable_rules : [];
    const sources = Array.isArray(payload.sources) ? payload.sources : [];

    const pointsHtml = points.map((point) => {
      const [label, className] = statusLabels[point.status] || ["Review", "unknown"];
      return `<li class="ai-point"><div class="ai-point-top"><strong>${escapeHtml(point.field)}: ${escapeHtml(point.value)}</strong><span class="ai-badge ${className}">${label}</span></div><p>${escapeHtml(point.evidence)}</p></li>`;
    }).join("");

    const rulesHtml = rules.map((rule) => `<div class="ai-rule"><strong>${escapeHtml(rule.rule)}${rule.article ? ` · ${escapeHtml(rule.article)}` : ""}</strong><small>${escapeHtml(rule.source_organisation)}</small><p>${escapeHtml(rule.explanation)}</p></div>`).join("");

    const sourcesHtml = sources.map((source) => {
      const url = safeUrl(source.url);
      return url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title || "Official web source")} ↗</a>` : "";
    }).join("");

    panel.classList.remove("hidden");
    panel.innerHTML = `
      <div class="ai-head"><div><span class="quiet-label">Evidence-based assessment</span><h3>${escapeHtml(analysis.confidence || "review")} confidence</h3><p>Generated by Bruce Rogers using the secure AI backend.</p></div><span class="ai-live">Research complete</span></div>
      <p class="ai-summary">${escapeHtml(analysis.case_summary || "The case was analysed, but no summary was returned.")}</p>
      <div class="ai-section"><h4>Verification points</h4><ul class="ai-list">${pointsHtml || `<li class="ai-warning">No verification points were returned.</li>`}</ul></div>
      <div class="ai-section"><h4>Possible entitlement</h4><p class="ai-warning">${escapeHtml(analysis.possible_entitlement || "Unable to determine from the available evidence.")}</p></div>
      <div class="ai-section"><h4>Applicable rules</h4><div class="ai-list">${rulesHtml || `<p class="ai-warning">No specific rule was safely identified.</p>`}</div></div>
      <div class="ai-section"><h4>Conflicts</h4>${listHtml(analysis.contradictions, "No conflicts were identified, but this is not document-authenticity verification.")}</div>
      <div class="ai-section"><h4>Missing evidence</h4>${listHtml(analysis.missing_evidence, "No additional evidence was listed.")}</div>
      <div class="ai-section"><h4>Recommended next steps</h4>${listHtml(analysis.next_steps, "Review every statement before using the claim.")}</div>
      <div class="ai-section ai-sources"><h4>Web sources</h4>${sourcesHtml || `<p class="ai-warning">The search returned no clickable source links. Do not treat the legal assessment as independently sourced until the official pages are checked.</p>`}</div>
      <div class="ai-meta">${escapeHtml(analysis.disclaimer || "General information only. Bruce Rogers is software, not a human or licensed lawyer.")}</div>
    `;
  }

  function renderError(error) {
    const panel = ensurePanel();
    panel.classList.remove("hidden");
    panel.innerHTML = `
      <div class="ai-head"><div><span class="quiet-label">AI connection</span><h3>The live research could not finish</h3></div></div>
      <div class="ai-error">${escapeHtml(error.message || "Unknown connection error.")}<div class="ai-error-actions"><button type="button" class="secondary-button" id="basicLetterFallback">Use basic offline letter</button></div></div>
    `;
    document.getElementById("basicLetterFallback")?.addEventListener("click", buildBasicLetter);
  }

  function renderAiLetter(payload) {
    const analysis = payload.analysis || {};
    const email = analysis.email || {};
    const sources = Array.isArray(payload.sources) ? payload.sources : [];
    const body = String(email.body || "").trim();

    let reference = "";
    try {
      if (!state.reference) state.reference = createReference();
      reference = state.reference;
    } catch {
      reference = `HL-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`;
    }

    const sourceLinks = sources.map((source) => {
      const url = safeUrl(source.url);
      return url ? `<li><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title || "Web source")}</a></li>` : "";
    }).join("");

    const claimLetter = document.getElementById("claimLetter");
    claimLetter.innerHTML = `
      <div class="letter-head"><div><strong>HolidayLawyer.ai</strong><br><span>Researched and prepared with Bruce Rogers · AI Claims Assistant</span></div><strong>BR</strong></div>
      <p><strong>Case reference:</strong> ${escapeHtml(reference)}</p>
      <div class="ai-letter-subject"><strong>Subject:</strong> ${escapeHtml(email.subject || "Passenger rights claim")}</div>
      <div class="ai-letter-body">${escapeHtml(body || "The AI did not return an email draft. Please use the assessment above.")}</div>
      ${sourceLinks ? `<div class="ai-letter-sources"><strong>Research sources used by the assistant</strong><ul>${sourceLinks}</ul></div>` : ""}
      <p class="letter-note">Bruce Rogers is software, not a human or licensed lawyer. Public flight information cannot prove passenger identity, booking ownership, cabin class or document authenticity. The claimant must verify and approve every statement before sending.</p>
    `;

    document.getElementById("letterCard")?.classList.remove("hidden");
    try {
      updateHomeAndCase();
      showView("case");
    } catch {
      document.querySelector('[data-view="check"]')?.classList.remove("active");
      document.querySelector('[data-view="case"]')?.classList.add("active");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function buildBasicLetter() {
    try {
      if (!state.reference) state.reference = createReference();
      document.getElementById("claimLetter").innerHTML = buildLetter();
      document.getElementById("letterCard").classList.remove("hidden");
      updateHomeAndCase();
      showView("case");
      showToast("Basic letter created without live research.");
    } catch {
      showToast("The basic letter could not be created.");
    }
  }

  async function runAiResearch(button) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = "Bruce is researching…";
    setLoading();

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload())
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.details || data.error || `The AI service returned error ${response.status}.`);
      }
      latestAiResponse = data;
      try { state.aiResponse = data; } catch { /* app state remains optional */ }
      renderAiResult(data);
      renderAiLetter(data);
      showToast("Live research complete. Review the evidence and letter.");
    } catch (error) {
      renderError(error);
      showToast("AI research failed. You can retry or use the basic letter.");
    } finally {
      button.disabled = false;
      button.textContent = latestAiResponse ? "Research again" : "Try AI research again";
    }
  }

  function init() {
    injectStyles();
    ensurePanel();
    const button = document.getElementById("buildLetterButton");
    if (!button) return;
    button.textContent = "Research & build with AI";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      runAiResearch(button);
    }, true);

    const resultCard = document.getElementById("resultCard");
    const observer = new MutationObserver(() => {
      if (!resultCard.classList.contains("hidden") && !latestAiResponse) {
        button.textContent = "Research & build with AI";
      }
    });
    observer.observe(resultCard, { attributes: true, attributeFilter: ["class"] });
  }

  init();
})();
