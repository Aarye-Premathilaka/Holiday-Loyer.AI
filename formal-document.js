(() => {
  "use strict";

  const claimLetter = document.getElementById("claimLetter");
  if (!claimLetter) return;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getFormValue(name) {
    const element = document.getElementById("caseForm")?.elements[name];
    return String(element?.value || "").trim();
  }

  function displayDate(value) {
    if (!value) return "Date not supplied";
    try {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric"
      }).format(new Date(`${value}T12:00:00`));
    } catch {
      return value;
    }
  }

  function today() {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(new Date());
  }

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function stripSignature(body) {
    const text = String(body || "").replaceAll("\r", "").trim();
    const signatureIndex = text.search(/\n\s*(?:Yours faithfully|Yours sincerely|Kind regards),?/i);
    return signatureIndex >= 0 ? text.slice(0, signatureIndex).trim() : text;
  }

  function narrativeMarkup(body) {
    const lines = stripSignature(body).split("\n");
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
          html += '<ul class="formal-body-list">';
          listOpen = true;
        }
        html += `<li>${escapeHtml(bullet[1])}</li>`;
        continue;
      }

      closeList();
      if (/^dear\b/i.test(line)) {
        html += `<p class="formal-salutation">${escapeHtml(line)}</p>`;
      } else if (line.endsWith(":") && line.length < 90) {
        html += `<p class="formal-body-heading">${escapeHtml(line.slice(0, -1))}</p>`;
      } else {
        html += `<p>${escapeHtml(line)}</p>`;
      }
    }

    closeList();
    return html || "<p>The researched assessment did not return a narrative. Review the case summary and legal sections below.</p>";
  }

  function bulletList(items, emptyText) {
    const usable = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!usable.length) return `<p class="formal-empty">${escapeHtml(emptyText)}</p>`;
    return `<ul>${usable.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function legalRulesMarkup(rules) {
    const usable = Array.isArray(rules) ? rules : [];
    if (!usable.length) {
      return '<p class="formal-empty">No specific legal provision was safely identified. Confirm the applicable law before sending.</p>';
    }
    return `<ul>${usable.map((rule) => {
      const title = [rule.rule, rule.article].filter(Boolean).join(" — ");
      const explanation = rule.explanation ? `: ${rule.explanation}` : "";
      const organisation = rule.source_organisation ? ` (${rule.source_organisation})` : "";
      return `<li><strong>${escapeHtml(title || "Passenger-rights rule")}</strong>${escapeHtml(explanation)}${escapeHtml(organisation)}</li>`;
    }).join("")}</ul>`;
  }

  function issueItems(analysis) {
    const items = [];
    if (analysis.case_summary) items.push(analysis.case_summary);

    const labels = {
      verified_by_public_source: "verified by a public source",
      supported_by_user_document: "supported by a declared document",
      user_provided_only: "user-provided only",
      conflicting: "conflicting information",
      unable_to_verify: "unable to verify"
    };

    for (const point of Array.isArray(analysis.verification_points) ? analysis.verification_points : []) {
      const status = labels[point.status] || "requires review";
      const evidence = point.evidence ? ` ${point.evidence}` : "";
      items.push(`${point.field || "Case fact"}: ${point.value || "not available"} — ${status}.${evidence}`);
    }

    for (const conflict of Array.isArray(analysis.contradictions) ? analysis.contradictions : []) {
      items.push(`Conflict requiring attention: ${conflict}`);
    }
    return items;
  }

  function requestedItems(analysis) {
    const items = [];
    if (analysis.possible_entitlement) items.push(analysis.possible_entitlement);
    for (const step of Array.isArray(analysis.next_steps) ? analysis.next_steps : []) items.push(step);
    if (!items.length) items.push("A written, evidence-based response and an appropriate resolution of the claim.");
    return items;
  }

  function researchSourcesMarkup(sources) {
    const usable = (Array.isArray(sources) ? sources : [])
      .map((source) => ({ title: source.title || "Official source", url: safeUrl(source.url) }))
      .filter((source) => source.url);

    if (!usable.length) return "";
    return `<div class="formal-source-block"><h4>Research sources</h4><ol>${usable.map((source) => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a></li>`).join("")}</ol></div>`;
  }

  function getReference() {
    try {
      if (typeof state !== "undefined") {
        if (!state.reference && typeof createReference === "function") state.reference = createReference();
        if (state.reference) return state.reference;
      }
    } catch {
      // Fall through to a local reference.
    }
    return `HL-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`;
  }

  function currentAiResponse() {
    try {
      return typeof state !== "undefined" ? state.aiResponse : null;
    } catch {
      return null;
    }
  }

  function buildFormalDocument() {
    const payload = currentAiResponse();
    const analysis = payload?.analysis;
    if (!analysis) return;

    const generatedKey = payload.generatedAt || JSON.stringify(analysis).slice(0, 100);
    if (claimLetter.dataset.formalDocumentKey === generatedKey && claimLetter.querySelector(".formal-legal-document")) return;

    const email = analysis.email || {};
    const rules = analysis.applicable_rules || [];
    const sources = payload.sources || [];
    const claimant = getFormValue("claimantName") || "the claimant";
    const airline = getFormValue("airline") || "Operating airline";
    const flightNumber = getFormValue("flightNumber").toUpperCase() || "Not supplied";
    const flightDate = displayDate(getFormValue("flightDate"));
    const departure = getFormValue("departureAirport") || "Departure airport not supplied";
    const arrival = getFormValue("arrivalAirport") || "Arrival airport not supplied";
    const bookingReference = getFormValue("bookingReference") || "Not supplied";
    const reference = getReference();

    claimLetter.dataset.formalDocumentKey = generatedKey;
    claimLetter.classList.remove("ai-letter-preview");
    claimLetter.classList.add("formal-letter-preview");
    claimLetter.innerHTML = `
      <article class="formal-legal-document">
        <span class="formal-corner formal-corner-tl" aria-hidden="true"></span>
        <span class="formal-corner formal-corner-tr" aria-hidden="true"></span>
        <span class="formal-corner formal-corner-bl" aria-hidden="true"></span>
        <span class="formal-corner formal-corner-br" aria-hidden="true"></span>

        <header class="formal-letterhead">
          <div class="formal-brand">
            <img src="./holidaylawyer-logo.jpg" alt="HolidayLawyer.ai" />
            <div class="formal-brand-copy">
              <strong>BRUCE ROGERS</strong>
              <span>HolidayLawyer.ai Claims Office</span>
              <em>Travel Claims &amp; Passenger Rights</em>
            </div>
          </div>
          <div class="formal-head-rule"></div>
        </header>

        <div class="formal-address-date">
          <address>
            <strong>Claims Department</strong><br />
            ${escapeHtml(airline)}<br />
            Operating carrier / responsible claims office
          </address>
          <time>${escapeHtml(today())}</time>
        </div>

        <div class="formal-case-reference">
          <span>Case reference</span><strong>${escapeHtml(reference)}</strong>
          <span>Booking</span><strong>${escapeHtml(bookingReference)}</strong>
        </div>

        <h1>Re: ${escapeHtml(email.subject || `Passenger-rights claim concerning flight ${flightNumber}`)}</h1>

        <section class="formal-narrative">
          ${narrativeMarkup(email.body)}
        </section>

        <section class="formal-flight-strip">
          <div><span>Flight</span><strong>${escapeHtml(flightNumber)}</strong></div>
          <div><span>Travel date</span><strong>${escapeHtml(flightDate)}</strong></div>
          <div class="formal-route"><span>Route</span><strong>${escapeHtml(departure)} → ${escapeHtml(arrival)}</strong></div>
        </section>

        <section class="formal-legal-section">
          <div class="formal-section-title"><span class="formal-section-icon">§</span><h2>Applicable Legal Basis</h2><i></i></div>
          ${legalRulesMarkup(rules)}
        </section>

        <section class="formal-legal-section">
          <div class="formal-section-title"><span class="formal-section-icon">!</span><h2>Issue Presented</h2><i></i></div>
          ${bulletList(issueItems(analysis), "The available information was insufficient to describe the issue safely.")}
        </section>

        <section class="formal-legal-section">
          <div class="formal-section-title"><span class="formal-section-icon">✓</span><h2>Requested Resolution</h2><i></i></div>
          ${bulletList(requestedItems(analysis), "A written response and an appropriate resolution are requested.")}
        </section>

        ${Array.isArray(analysis.missing_evidence) && analysis.missing_evidence.length ? `
          <section class="formal-legal-section formal-evidence-section">
            <div class="formal-section-title"><span class="formal-section-icon">▤</span><h2>Evidence Still Required</h2><i></i></div>
            ${bulletList(analysis.missing_evidence, "No additional evidence was listed.")}
          </section>` : ""}

        ${researchSourcesMarkup(sources)}

        <footer class="formal-signature-area">
          <p>Yours faithfully,</p>
          <div class="formal-signature-row">
            <div class="formal-signature-block">
              <div class="formal-signature-script">Bruce Rogers</div>
              <div class="formal-signature-line"></div>
              <strong>Bruce Rogers</strong>
              <span>AI Claims Assistant · HolidayLawyer.ai Claims Office</span>
              <small>Prepared on behalf of ${escapeHtml(claimant)}</small>
            </div>
            <div class="formal-br-seal" aria-label="Bruce Rogers digital mark">BR</div>
          </div>

          <div class="formal-footer-row">
            <div>
              <strong>HolidayLawyer.ai</strong>
              <span>Evidence-based passenger claim assistance</span>
            </div>
            <div class="formal-contact-lines">
              <span>holidaylawyer.ai</span>
              <span>Digital claims document</span>
            </div>
          </div>

          <p class="formal-disclosure">AI-assisted draft. Bruce Rogers is software, not a human or licensed lawyer, and the signature-style mark is a digital design element—not a lawyer's legal signature. The claimant must review, correct and approve every statement before sending or filing this document.</p>
        </footer>
      </article>
    `;

    document.querySelector("#letterCard h2")?.replaceChildren(document.createTextNode("Formal claim document"));
    const openButton = document.getElementById("openAiLetterButton");
    if (openButton) openButton.textContent = "Open formal claim document";
  }

  const observer = new MutationObserver(() => {
    const payload = currentAiResponse();
    if (!payload?.analysis) return;
    if (claimLetter.querySelector(".email-sheet") || !claimLetter.querySelector(".formal-legal-document")) {
      queueMicrotask(buildFormalDocument);
    }
  });

  observer.observe(claimLetter, { childList: true, subtree: true });

  const pageObserver = new MutationObserver(() => {
    const openButton = document.getElementById("openAiLetterButton");
    if (openButton) openButton.textContent = "Open formal claim document";
  });
  pageObserver.observe(document.body, { childList: true, subtree: true });

  buildFormalDocument();
})();