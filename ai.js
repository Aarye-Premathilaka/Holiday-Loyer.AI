(() => {
  "use strict";

  const API_URL = "https://holidaylawyer-api.aarye-premathilaka.workers.dev";
  const ASSET_VERSION = "20260719-2";

  const statusConfig = {
    verified_by_public_source: { label: "Verified", className: "verified", icon: "✓" },
    supported_by_user_document: { label: "In document", className: "document", icon: "▤" },
    user_provided_only: { label: "User statement", className: "user-only", icon: "i" },
    conflicting: { label: "Conflict", className: "conflict", icon: "!" },
    unable_to_verify: { label: "Unverified", className: "unknown", icon: "?" }
  };

  let latestAiResponse = null;

  function escape(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function ensureStylesheet() {
    if (document.querySelector('link[data-holidaylawyer-ai-styles]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `./ai-styles.css?v=${ASSET_VERSION}`;
    link.dataset.holidaylawyerAiStyles = "true";
    document.head.appendChild(link);
  }

  function getFormValue(name) {
    const value = document.getElementById("caseForm")?.elements[name]?.value;
    return typeof value === "string" ? value.trim() : "";
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

    const resultCard = document.getElementById("resultCard");
    const actions = resultCard?.querySelector(".result-actions");
    if (resultCard && actions) resultCard.insertBefore(panel, actions);
    return panel;
  }

  function displayDate(value) {
    if (!value) return "Not supplied";
    try {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }).format(new Date(`${value}T12:00:00`));
    } catch {
      return value;
    }
  }

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function sourceDomain(value) {
    try {
      return new URL(value).hostname.replace(/^www\./, "");
    } catch {
      return "Official web source";
    }
  }

  function setLoading() {
    const panel = ensurePanel();
    panel.classList.remove("hidden");
    panel.innerHTML = `
      <div class="ai-loading-card">
        <div class="ai-bruce-identity" style="margin-bottom:16px">
          <span class="ai-bruce-mark">BR</span>
          <div><strong style="color:#17233a">Bruce Rogers</strong><span style="color:#718096">AI Claims Assistant</span></div>
        </div>
        <h3>Researching this case</h3>
        <p>Bruce is comparing the entered details with public information and official passenger-rights sources.</p>
        <div class="ai-loading-steps">
          <div class="ai-loading-row"><span class="ai-spinner"></span><span>Checking the flight, route and airline</span></div>
          <div class="ai-loading-row"><span class="ai-spinner"></span><span>Finding the relevant official rules</span></div>
          <div class="ai-loading-row"><span class="ai-spinner"></span><span>Preparing the evidence review and claim email</span></div>
        </div>
      </div>
    `;
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function listMarkup(items, emptyText) {
    if (!Array.isArray(items) || items.length === 0) {
      return `<p class="ai-empty">${escape(emptyText)}</p>`;
    }
    return `<ul class="ai-clean-list">${items.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>`;
  }

  function renderVerification(points) {
    if (!Array.isArray(points) || points.length === 0) {
      return `<p class="ai-empty">No verification points were returned.</p>`;
    }

    return `<ul class="ai-verification-list">${points.map((point) => {
      const config = statusConfig[point.status] || statusConfig.unable_to_verify;
      return `
        <li class="ai-point ${config.className}">
          <span class="ai-point-icon" aria-hidden="true">${config.icon}</span>
          <div class="ai-point-content">
            <div class="ai-point-top">
              <div class="ai-point-title">
                <strong>${escape(point.field || "Case fact")}</strong>
                <span>${escape(point.value || "Not available")}</span>
              </div>
              <span class="ai-badge ${config.className}">${config.label}</span>
            </div>
            <p>${escape(point.evidence || "No supporting explanation was returned.")}</p>
          </div>
        </li>`;
    }).join("")}</ul>`;
  }

  function renderRules(rules) {
    if (!Array.isArray(rules) || rules.length === 0) {
      return `<p class="ai-empty">No specific legal rule was safely identified.</p>`;
    }

    return `<div class="ai-rule-list">${rules.map((rule) => `
      <article class="ai-rule-card">
        <div class="ai-rule-top">
          <div class="ai-rule-title">
            <strong>${escape(rule.rule || "Passenger-rights rule")}</strong>
            <span>${escape(rule.source_organisation || "Official source")}</span>
          </div>
          ${rule.article ? `<span class="ai-rule-article">${escape(rule.article)}</span>` : ""}
        </div>
        <p>${escape(rule.explanation || "")}</p>
      </article>`).join("")}</div>`;
  }

  function renderSources(sources) {
    const usable = Array.isArray(sources)
      ? sources.map((source) => ({ ...source, safeUrl: safeUrl(source.url) })).filter((source) => source.safeUrl)
      : [];

    if (usable.length === 0) {
      return `<p class="ai-empty">No clickable sources were returned. Verify the assessment against official pages before using it.</p>`;
    }

    return `<div class="ai-source-list">${usable.map((source, index) => `
      <a class="ai-source-card" href="${escape(source.safeUrl)}" target="_blank" rel="noopener noreferrer">
        <span class="ai-source-number">${index + 1}</span>
        <span class="ai-source-text">
          <strong>${escape(source.title || "Official web source")}</strong>
          <span>${escape(sourceDomain(source.safeUrl))}</span>
        </span>
        <span class="ai-source-arrow">↗</span>
      </a>`).join("")}</div>`;
  }

  function renderAiResult(payload) {
    const panel = ensurePanel();
    const analysis = payload.analysis || {};
    const confidence = ["high", "medium", "low"].includes(analysis.confidence) ? analysis.confidence : "medium";
    const points = Array.isArray(analysis.verification_points) ? analysis.verification_points : [];
    const rules = Array.isArray(analysis.applicable_rules) ? analysis.applicable_rules : [];
    const sources = Array.isArray(payload.sources) ? payload.sources : [];
    const departure = getFormValue("departureAirport") || "Departure";
    const arrival = getFormValue("arrivalAirport") || "Arrival";
    const flightNumber = getFormValue("flightNumber").toUpperCase() || "Not supplied";
    const airline = getFormValue("airline") || "Not supplied";

    panel.classList.remove("hidden");
    panel.innerHTML = `
      <div class="ai-hero">
        <div class="ai-hero-top">
          <div class="ai-bruce-identity">
            <span class="ai-bruce-mark">BR</span>
            <div><strong>Bruce Rogers</strong><span>AI Claims Assistant</span></div>
          </div>
          <span class="ai-live-pill">Research complete</span>
        </div>
        <h3>Evidence-based case review</h3>
        <p>${escape(analysis.case_summary || "The case was researched, but the service returned no summary.")}</p>
        <div class="ai-route-strip">
          <div class="ai-route-airport"><span>From</span><strong>${escape(departure)}</strong></div>
          <span class="ai-route-arrow">→</span>
          <div class="ai-route-airport"><span>To</span><strong>${escape(arrival)}</strong></div>
        </div>
      </div>

      <div class="ai-body">
        <div class="ai-summary-grid">
          <div class="ai-summary-stat"><span>Flight</span><strong>${escape(flightNumber)} · ${escape(airline)}</strong></div>
          <div class="ai-summary-stat"><span>Travel date</span><strong>${escape(displayDate(getFormValue("flightDate")))}</strong></div>
          <div class="ai-summary-stat"><span>Research confidence</span><span class="ai-confidence-pill ${confidence}">${escape(confidence)}</span></div>
        </div>

        <section class="ai-section">
          <div class="ai-title-row"><h4>Possible entitlement</h4><span>Not a guarantee</span></div>
          <div class="ai-entitlement"><span>Initial researched view</span><strong>${escape(analysis.possible_entitlement || "Unable to determine from the available evidence.")}</strong></div>
        </section>

        <section class="ai-section">
          <div class="ai-title-row"><h4>What could be verified</h4><span>${points.length} checks</span></div>
          ${renderVerification(points)}
        </section>

        <section class="ai-section">
          <div class="ai-title-row"><h4>Relevant rules</h4><span>${rules.length} sources of law</span></div>
          ${renderRules(rules)}
        </section>

        <section class="ai-section">
          <div class="ai-title-row"><h4>Evidence review</h4><span>Before sending</span></div>
          <div class="ai-split-grid">
            <div class="ai-info-box danger"><h5>Conflicts or concerns</h5>${listMarkup(analysis.contradictions, "No conflict was reported. This is not document-authenticity verification.")}</div>
            <div class="ai-info-box warning"><h5>Still needed</h5>${listMarkup(analysis.missing_evidence, "No additional evidence was listed.")}</div>
          </div>
        </section>

        <section class="ai-section">
          <div class="ai-title-row"><h4>Recommended next steps</h4><span>Action plan</span></div>
          ${listMarkup(analysis.next_steps, "Review every statement and supporting document before sending the claim.")}
        </section>

        <section class="ai-section">
          <div class="ai-title-row"><h4>Research sources</h4><span>Open to verify</span></div>
          ${renderSources(sources)}
        </section>

        <div class="ai-meta-note">${escape(analysis.disclaimer || "General information only. Bruce Rogers is software, not a human or licensed lawyer. The claimant must review and approve the final email.")}</div>

        <div class="ai-action-row">
          <button type="button" class="secondary-button" id="aiResearchAgainButton">Research again</button>
          <button type="button" class="primary-button" id="openAiLetterButton">Open claim email</button>
        </div>
      </div>
    `;

    document.getElementById("aiResearchAgainButton")?.addEventListener("click", () => {
      const button = document.getElementById("buildLetterButton");
      if (button) runAiResearch(button);
    });
    document.getElementById("openAiLetterButton")?.addEventListener("click", openPreparedLetter);
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function stripGeneratedSignature(body) {
    const text = String(body || "").trim();
    const signatureIndex = text.search(/\n\s*Yours faithfully,?/i);
    return signatureIndex >= 0 ? text.slice(0, signatureIndex).trim() : text;
  }

  function formatEmailBody(body) {
    const text = stripGeneratedSignature(body).replaceAll("\r", "");
    const lines = text.split("\n");
    let html = "";
    let listOpen = false;

    const closeList = () => {
      if (listOpen) {
        html += "</ul>";
        listOpen = false;
      }
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        closeList();
        continue;
      }

      const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
      if (bullet) {
        if (!listOpen) {
          html += "<ul>";
          listOpen = true;
        }
        html += `<li>${escape(bullet[1])}</li>`;
        continue;
      }

      closeList();
      if (/^dear\b/i.test(line)) {
        html += `<p class="email-greeting">${escape(line)}</p>`;
      } else if (line.endsWith(":") && line.length < 80) {
        html += `<h4>${escape(line.slice(0, -1))}</h4>`;
      } else {
        html += `<p>${escape(line)}</p>`;
      }
    }

    closeList();
    return html || "<p>The AI did not return an email body. Use the researched assessment to prepare the claim manually.</p>";
  }

  function renderAiLetter(payload) {
    const analysis = payload.analysis || {};
    const email = analysis.email || {};
    const sources = Array.isArray(payload.sources) ? payload.sources : [];
    const claimant = getFormValue("claimantName") || "the claimant";

    let reference = "";
    try {
      if (!state.reference) state.reference = createReference();
      reference = state.reference;
    } catch {
      reference = `HL-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`;
    }

    const sourceItems = sources.map((source) => {
      const url = safeUrl(source.url);
      return url ? `<li><a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(source.title || sourceDomain(url))}</a></li>` : "";
    }).join("");

    const claimLetter = document.getElementById("claimLetter");
    if (!claimLetter) return;

    claimLetter.classList.add("ai-letter-preview");
    claimLetter.innerHTML = `
      <article class="email-sheet">
        <header class="email-brand-header">
          <div class="email-brand-row">
            <div class="email-logo-wrap">
              <img src="./holidaylawyer-logo.jpg" alt="" aria-hidden="true" />
              <div class="email-brand-name"><strong>HolidayLawyer.ai</strong><span>Evidence-based passenger claim</span></div>
            </div>
            <span class="email-br-mark">BR</span>
          </div>
          <div class="email-meta-grid">
            <div><span>Case</span><strong>${escape(reference)}</strong></div>
            <div><span>Flight</span><strong>${escape(getFormValue("flightNumber").toUpperCase() || "Not supplied")}</strong></div>
            <div><span>Date</span><strong>${escape(displayDate(getFormValue("flightDate")))}</strong></div>
            <div><span>Route</span><strong>${escape(getFormValue("departureAirport") || "—")} → ${escape(getFormValue("arrivalAirport") || "—")}</strong></div>
          </div>
        </header>

        <div class="email-content">
          <div class="email-subject-card"><span>Email subject</span><strong>${escape(email.subject || "Passenger-rights claim")}</strong></div>
          <div class="email-body">${formatEmailBody(email.body)}</div>

          <div class="email-signature">
            <span class="email-br-mark">BR</span>
            <div class="email-signature-text">
              <strong>Bruce Rogers</strong>
              <span>AI Claims Assistant · HolidayLawyer.ai</span>
              <small>Prepared on behalf of ${escape(claimant)}</small>
            </div>
          </div>

          ${sourceItems ? `<footer class="email-source-footer"><h4>Research sources used</h4><ol>${sourceItems}</ol></footer>` : ""}
          <div class="email-review-note">Reviewed and approved by the claimant before sending. Bruce Rogers is software, not a human or licensed lawyer. Public flight information cannot prove passenger identity, booking ownership, cabin class or document authenticity.</div>
        </div>
      </article>
    `;

    document.getElementById("letterCard")?.classList.remove("hidden");
    try {
      updateHomeAndCase();
    } catch {
      // The letter remains usable even if the compact case summary cannot update.
    }
  }

  function openPreparedLetter() {
    document.getElementById("letterCard")?.classList.remove("hidden");
    try {
      showView("case");
    } catch {
      document.querySelectorAll(".app-view").forEach((view) => view.classList.remove("active"));
      document.querySelector('[data-view="case"]')?.classList.add("active");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function renderError(error) {
    const panel = ensurePanel();
    panel.classList.remove("hidden");
    panel.innerHTML = `
      <div class="ai-error-card">
        <div class="ai-bruce-identity" style="margin-bottom:14px">
          <span class="ai-bruce-mark">BR</span>
          <div><strong style="color:#17233a">Bruce Rogers</strong><span style="color:#718096">AI Claims Assistant</span></div>
        </div>
        <h3>The live research could not finish</h3>
        <p>The website design and offline case checker still work. The problem is only with the live AI request.</p>
        <div class="ai-error-box"><p>${escape(error.message || "Unknown connection error.")}</p></div>
        <div class="ai-action-row">
          <button type="button" class="secondary-button" id="basicLetterFallback">Use basic offline email</button>
          <button type="button" class="primary-button" id="retryAiButton">Try again</button>
        </div>
      </div>
    `;
    document.getElementById("basicLetterFallback")?.addEventListener("click", buildBasicLetter);
    document.getElementById("retryAiButton")?.addEventListener("click", () => {
      const button = document.getElementById("buildLetterButton");
      if (button) runAiResearch(button);
    });
  }

  function buildBasicLetter() {
    try {
      if (!state.reference) state.reference = createReference();
      const claimLetter = document.getElementById("claimLetter");
      claimLetter?.classList.remove("ai-letter-preview");
      if (claimLetter) claimLetter.innerHTML = buildLetter();
      document.getElementById("letterCard")?.classList.remove("hidden");
      updateHomeAndCase();
      showView("case");
      showToast("Basic email created without live research.");
    } catch {
      showToast("The basic email could not be created.");
    }
  }

  async function runAiResearch(button) {
    if (!button || button.disabled) return;

    latestAiResponse = null;
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
      try { state.aiResponse = data; } catch { /* AI response storage is optional. */ }
      renderAiResult(data);
      renderAiLetter(data);
      showToast("Research complete. Review the evidence, then open the claim email.");
    } catch (error) {
      renderError(error);
      showToast("AI research failed. Retry or use the offline email.");
    } finally {
      button.disabled = false;
      button.textContent = latestAiResponse ? "Research again" : "Try AI research again";
    }
  }

  function init() {
    ensureStylesheet();
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
    if (resultCard) {
      const observer = new MutationObserver(() => {
        if (!resultCard.classList.contains("hidden") && !latestAiResponse) {
          button.textContent = "Research & build with AI";
        }
      });
      observer.observe(resultCard, { attributes: true, attributeFilter: ["class"] });
    }
  }

  init();
})();
