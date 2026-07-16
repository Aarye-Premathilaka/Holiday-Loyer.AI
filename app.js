const wizardState = {
  step: 1,
  totalSteps: 5,
  assessment: null,
  caseReference: ""
};

const stepHeadings = {
  1: "Choose the problem",
  2: "Check route coverage",
  3: "Describe the incident",
  4: "Add case details",
  5: "Review your evidence"
};

const elaraMessages = {
  1: "Select what happened. I will build a case path and show you which information matters.",
  2: "Route and operating-carrier information determine whether this passenger-rights framework may apply.",
  3: "The incident details affect the possible outcome, evidence and wording of the claim.",
  4: "Use factual information only. The draft will use these details exactly as you provide them.",
  5: "Evidence often decides whether a claim is easy to assess. Select only items you can genuinely provide."
};

const evidenceLabels = {
  booking: "Booking confirmation",
  boarding: "Boarding pass",
  id: "Identification copy",
  messages: "Airline messages",
  receipts: "Expense receipts",
  photos: "Photos or damage evidence",
  pir: "Baggage incident report",
  timeline: "Written incident timeline"
};

const form = document.getElementById("claimWizard");
const steps = [...document.querySelectorAll(".wizard-step")];
const nextButton = document.getElementById("nextButton");
const backButton = document.getElementById("backButton");
const stepCounter = document.getElementById("stepCounter");
const stepHeading = document.getElementById("stepHeading");
const progressFill = document.getElementById("progressFill");
const wizardError = document.getElementById("wizardError");
const elaraMessage = document.getElementById("elaraMessage");
const flightIncidentFields = document.getElementById("flightIncidentFields");
const baggageIncidentFields = document.getElementById("baggageIncidentFields");
const assessmentPanel = document.getElementById("assessmentPanel");
const documentWorkspace = document.getElementById("documentWorkspace");
const responseAnalyser = document.getElementById("responseAnalyser");
const savedCaseButton = document.getElementById("savedCaseButton");
const toast = document.getElementById("toast");

document.getElementById("year").textContent = new Date().getFullYear();

function getValue(name) {
  return form.elements[name]?.value || "";
}

function getCheckedEvidence() {
  return [...form.querySelectorAll('input[name="evidence"]:checked')].map((input) => input.value);
}

function setValue(name, value) {
  const element = form.elements[name];
  if (!element) return;

  if (element instanceof RadioNodeList) {
    [...element].forEach((input) => {
      input.checked = input.value === value;
    });
    return;
  }

  element.value = value ?? "";
}

function selectedCaseType() {
  return form.querySelector('input[name="caseType"]:checked')?.value || "";
}

function updateConditionalFields() {
  const caseType = selectedCaseType();
  const flightSelects = flightIncidentFields.querySelectorAll("select");
  const baggageSelects = baggageIncidentFields.querySelectorAll("select");

  flightIncidentFields.classList.toggle("hidden", caseType !== "flight");
  baggageIncidentFields.classList.toggle("hidden", caseType !== "baggage");

  flightSelects.forEach((element) => {
    element.required = caseType === "flight";
    if (caseType !== "flight") element.value = "";
  });

  baggageSelects.forEach((element) => {
    element.required = caseType === "baggage";
    if (caseType !== "baggage") element.value = "";
  });
}

form.addEventListener("change", (event) => {
  if (event.target.name === "caseType") {
    updateConditionalFields();
  }
});

function updateStep() {
  steps.forEach((step) => {
    step.classList.toggle("active", Number(step.dataset.step) === wizardState.step);
  });

  stepCounter.textContent = `Step ${wizardState.step} of ${wizardState.totalSteps}`;
  stepHeading.textContent = stepHeadings[wizardState.step];
  progressFill.style.width = `${(wizardState.step / wizardState.totalSteps) * 100}%`;
  elaraMessage.textContent = elaraMessages[wizardState.step];
  backButton.disabled = wizardState.step === 1;
  nextButton.textContent = wizardState.step === wizardState.totalSteps ? "See assessment" : "Continue";
  wizardError.textContent = "";
}

function validateStep() {
  const activeStep = steps.find((step) => Number(step.dataset.step) === wizardState.step);
  const requiredElements = [...activeStep.querySelectorAll("[required]")].filter((element) => {
    return !element.closest(".hidden");
  });

  for (const element of requiredElements) {
    if (element.type === "radio") {
      const selected = activeStep.querySelector(`input[name="${element.name}"]:checked`);
      if (!selected) {
        wizardError.textContent = "Please select an answer before continuing.";
        return false;
      }
    } else if (element.type === "checkbox") {
      if (!element.checked) {
        wizardError.textContent = "Please confirm the authorisation before continuing.";
        return false;
      }
    } else if (!String(element.value).trim()) {
      wizardError.textContent = "Please complete all required fields before continuing.";
      element.focus();
      return false;
    } else if (!element.checkValidity()) {
      wizardError.textContent = "Please check the highlighted information.";
      element.reportValidity();
      return false;
    }
  }

  return true;
}

nextButton.addEventListener("click", () => {
  if (!validateStep()) return;

  if (wizardState.step < wizardState.totalSteps) {
    wizardState.step += 1;
    updateStep();
    return;
  }

  showAssessment();
});

backButton.addEventListener("click", () => {
  if (wizardState.step > 1) {
    wizardState.step -= 1;
    updateStep();
  }
});

function isRouteCovered() {
  const departure = getValue("departureArea");
  const arrival = getValue("arrivalArea");
  const carrier = getValue("carrierArea");

  if (departure === "covered") return "yes";
  if (departure === "outside" && arrival === "covered" && carrier === "covered") return "yes";
  if (departure === "outside" && arrival === "covered" && carrier === "unknown") return "uncertain";
  return "no";
}

function calculatePossibleValue() {
  const caseType = selectedCaseType();

  if (caseType === "baggage") {
    const expenses = getValue("expenses");
    const baggageIncident = getValue("baggageIncident");

    if (expenses === "yes") {
      return {
        value: "Documented expenses",
        note: "Reasonable, necessary purchases require receipts and final assessment."
      };
    }

    if (baggageIncident === "damaged") {
      return {
        value: "Repair / replacement",
        note: "Subject to proof, condition, value and the carrier’s assessment."
      };
    }

    return {
      value: "Needs evidence",
      note: "The amount depends on the documented loss and applicable baggage rules."
    };
  }

  const distance = getValue("distance");
  const delay = getValue("arrivalDelay");
  const incident = getValue("flightIncident");
  const cause = getValue("cause");
  const coverage = isRouteCovered();

  if (coverage === "no") {
    return {
      value: "Outside route test",
      note: "Other contractual or national rights may still exist."
    };
  }

  if (incident === "delay" && delay === "under3") {
    return {
      value: "Compensation unlikely",
      note: "Other care, refund or expense rights may still be relevant."
    };
  }

  let amount = "";
  if (distance === "short") amount = "€250";
  if (distance === "medium") amount = "€400";
  if (distance === "long") amount = "€600";

  if (!amount) {
    return {
      value: "Distance needed",
      note: "Confirm the route distance before using a standard estimate."
    };
  }

  if (cause === "extraordinary") {
    return {
      value: `Disputed ${amount}`,
      note: "The airline may rely on extraordinary circumstances, but should explain them."
    };
  }

  return {
    value: `Possible ${amount}`,
    note: "Initial standard estimate only; route, timing and cause must be verified."
  };
}

function calculateReadiness() {
  let score = 28;
  const evidence = getCheckedEvidence();

  const coreFields = [
    "claimantName",
    "claimantEmail",
    "airline",
    "bookingReference",
    "flightNumber",
    "flightDate",
    "departureAirport",
    "arrivalAirport",
    "caseSummary",
    "requestedOutcome"
  ];

  coreFields.forEach((field) => {
    if (getValue(field)) score += 4;
  });

  score += Math.min(evidence.length * 4, 24);

  if (selectedCaseType() === "baggage" && getValue("pir") === "yes") score += 7;
  if (selectedCaseType() === "flight" && getValue("distance") !== "unknown") score += 4;
  if (getValue("cause") === "none" || getValue("cause") === "airline") score += 3;

  return Math.min(score, 100);
}

function buildAssessment() {
  const caseType = selectedCaseType();
  const coverage = isRouteCovered();
  const evidence = getCheckedEvidence();
  const value = calculatePossibleValue();
  const readiness = calculateReadiness();
  const reasons = [];
  const missing = [];

  let heading = caseType === "flight"
    ? "Your flight case is ready for review"
    : "Your baggage case is ready for review";

  let intro = "The assessment below organises the information you provided. It is not a guarantee that payment is legally due.";

  if (coverage === "yes") {
    reasons.push("The route appears to pass the simplified coverage test.");
  } else if (coverage === "uncertain") {
    reasons.push("Coverage depends on confirming the operating airline’s legal base.");
    missing.push("Confirm the operating carrier—not only the company that sold the ticket.");
  } else {
    reasons.push("The route appears outside this passenger-rights route test.");
    missing.push("Check whether another country’s law, travel contract or insurance policy applies.");
  }

  if (caseType === "flight") {
    const delay = getValue("arrivalDelay");
    const cause = getValue("cause");
    const incident = getValue("flightIncident");

    reasons.push(`The reported incident is: ${labelForIncident(incident)}.`);

    if (delay === "3to4" || delay === "over4") {
      reasons.push("The reported arrival delay is at least three hours.");
    } else if (delay === "under3") {
      missing.push("Standard long-delay compensation may not apply below three hours.");
    } else if (delay === "unknown") {
      missing.push("Confirm the actual arrival delay at the final destination.");
    }

    if (cause === "extraordinary") {
      reasons.push("The reported cause may be treated as an extraordinary circumstance.");
      missing.push("Ask the airline for a precise explanation and supporting facts.");
    } else if (cause === "none") {
      reasons.push("No clear disruption reason has been provided by the airline.");
      missing.push("Request the airline’s specific factual reason for the disruption.");
    }

    if (!evidence.includes("boarding")) missing.push("Add the boarding pass if available.");
    if (!evidence.includes("messages")) missing.push("Save cancellation or delay notifications.");
  } else {
    const baggageIncident = getValue("baggageIncident");
    const pir = getValue("pir");
    const expenses = getValue("expenses");

    reasons.push(`The reported baggage incident is: ${labelForBaggage(baggageIncident)}.`);

    if (pir === "yes") {
      reasons.push("A baggage incident report has been recorded.");
    } else {
      missing.push("Locate or request the baggage incident report reference.");
    }

    if (expenses === "yes") {
      reasons.push("Necessary replacement expenses are supported by receipts.");
    } else if (expenses === "no-receipts") {
      missing.push("Find missing receipts or other proof of replacement purchases.");
    }

    if (!evidence.includes("pir")) missing.push("Attach the property irregularity report if available.");
    if (!evidence.includes("receipts") && expenses !== "none") missing.push("Attach itemised expense receipts.");
    if (!evidence.includes("photos") && baggageIncident === "damaged") missing.push("Add clear photos of the damage.");
  }

  if (!evidence.includes("booking")) missing.push("Attach the booking confirmation.");
  if (!evidence.includes("timeline")) missing.push("Prepare a short incident timeline.");

  if (readiness < 60) {
    heading = "Your case needs more information";
  } else if (readiness >= 85) {
    heading = "Your case appears well prepared";
  }

  let nextAction = "Prepare the first claim";
  let actionNote = "Send it to the airline with the relevant evidence.";

  if (coverage === "no") {
    nextAction = "Check the correct framework";
    actionNote = "Do not send a regulation-based demand before confirming jurisdiction.";
  } else if (missing.length > 5) {
    nextAction = "Complete the evidence";
    actionNote = "Strengthen the package before sending the formal claim.";
  }

  return {
    caseType,
    coverage,
    value,
    readiness,
    heading,
    intro,
    reasons,
    missing: [...new Set(missing)].slice(0, 8),
    nextAction,
    actionNote,
    evidence
  };
}

function showAssessment() {
  wizardState.assessment = buildAssessment();
  form.classList.add("hidden");
  assessmentPanel.classList.remove("hidden");

  document.getElementById("assessmentHeading").textContent = wizardState.assessment.heading;
  document.getElementById("assessmentIntro").textContent = wizardState.assessment.intro;
  document.getElementById("readinessScore").textContent = `${wizardState.assessment.readiness}%`;
  document.getElementById("possibleValue").textContent = wizardState.assessment.value.value;
  document.getElementById("valueNote").textContent = wizardState.assessment.value.note;

  const coverageText = {
    yes: "Appears covered",
    uncertain: "Needs confirmation",
    no: "Appears outside"
  };

  document.getElementById("coverageStatus").textContent = coverageText[wizardState.assessment.coverage];
  document.getElementById("coverageNote").textContent =
    wizardState.assessment.coverage === "yes"
      ? "Based on the departure, arrival and carrier answers."
      : "Verify jurisdiction before relying on the standard framework.";

  document.getElementById("nextAction").textContent = wizardState.assessment.nextAction;
  document.getElementById("actionNote").textContent = wizardState.assessment.actionNote;

  document.getElementById("reasonList").innerHTML =
    wizardState.assessment.reasons.map((item) => `<li>${escapeHtml(item)}</li>`).join("");

  document.getElementById("missingList").innerHTML =
    (wizardState.assessment.missing.length
      ? wizardState.assessment.missing
      : ["No major missing items detected. Review all facts before sending."]
    ).map((item) => `<li>${escapeHtml(item)}</li>`).join("");

  const swissNotice = document.getElementById("swissNotice");
  swissNotice.classList.toggle(
    "hidden",
    !(getValue("swissCase") === "yes" && selectedCaseType() === "flight" && getValue("flightIncident") === "delay")
  );

  document.querySelector(".workspace-main").scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("editAnswersButton").addEventListener("click", () => {
  assessmentPanel.classList.add("hidden");
  form.classList.remove("hidden");
  wizardState.step = 5;
  updateStep();
});

function generateCaseReference() {
  const date = new Date();
  const datePart = [
    String(date.getFullYear()).slice(-2),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("");
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `HL-${datePart}-${randomPart}`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function outcomeText(value) {
  const outcomes = {
    compensation: "payment of the compensation that is applicable to this journey",
    refund: "a refund of the ticket price or unused travel services",
    expenses: "reimbursement of the documented necessary expenses",
    "compensation-expenses": "the applicable compensation together with reimbursement of documented necessary expenses",
    "written-response": "a clear written explanation and an appropriate resolution"
  };

  return outcomes[value] || "an appropriate resolution";
}

function buildClaimDocument() {
  const assessment = wizardState.assessment;
  const today = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date());

  const caseTypeTitle = assessment.caseType === "flight" ? "flight disruption" : "baggage incident";
  const evidence = assessment.evidence.map((key) => evidenceLabels[key]).filter(Boolean);

  const specificParagraph = assessment.caseType === "flight"
    ? `
      <p>
        According to the information currently available, the route and incident should be assessed
        under the passenger-rights rules applicable to this journey. The current initial estimate is
        <strong>${escapeHtml(assessment.value.value)}</strong>. This estimate remains subject to verification
        of the route, operating carrier, distance, timing and cause of disruption.
      </p>
    `
    : `
      <p>
        I request an assessment of the baggage incident and reimbursement or compensation for the
        documented loss, damage and necessary expenses, as applicable. The exact amount remains subject
        to the evidence and the carrier’s final assessment.
      </p>
    `;

  return `
    <div class="letter-brand">
      <div>
        <strong>HolidayLawyer.ai</strong>
        <span>AI-assisted travel claim preparation</span>
      </div>
      <span class="letter-mark">BR</span>
    </div>

    <div class="letter-meta">
      <div>
        <strong>${escapeHtml(getValue("claimantName"))}</strong><br>
        ${escapeHtml(getValue("claimantEmail"))}
      </div>
      <div>
        ${escapeHtml(today)}<br>
        Case: ${escapeHtml(wizardState.caseReference)}
      </div>
    </div>

    <p>
      Customer Relations / Claims Department<br>
      <strong>${escapeHtml(getValue("airline"))}</strong>
    </p>

    <h3>
      Formal claim concerning ${escapeHtml(caseTypeTitle)} —
      Flight ${escapeHtml(getValue("flightNumber"))},
      ${escapeHtml(formatDate(getValue("flightDate")))}
    </h3>

    <p>Dear Sir or Madam,</p>

    <p>
      I am writing as the claimant in relation to booking reference
      <strong>${escapeHtml(getValue("bookingReference"))}</strong> and flight
      <strong>${escapeHtml(getValue("flightNumber"))}</strong> from
      <strong>${escapeHtml(getValue("departureAirport"))}</strong> to
      <strong>${escapeHtml(getValue("arrivalAirport"))}</strong>.
    </p>

    <p>
      <strong>Factual summary</strong><br>
      ${escapeHtml(getValue("caseSummary")).replaceAll("\n", "<br>")}
    </p>

    ${specificParagraph}

    <p>
      I request ${escapeHtml(outcomeText(getValue("requestedOutcome")))}.
      Please confirm receipt and provide a clear written decision based on the facts,
      evidence and rules applicable to this journey.
    </p>

    <p>If the claim is refused, please identify:</p>
    <ul>
      <li>the exact factual reason for the refusal;</li>
      <li>the contractual or legal basis relied on;</li>
      <li>the evidence supporting any extraordinary-circumstances argument; and</li>
      <li>the appropriate escalation or dispute-resolution process.</li>
    </ul>

    ${evidence.length ? `
      <p><strong>Supporting evidence available</strong></p>
      <ul>
        ${evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    ` : ""}

    <p>
      Please respond within a reasonable period. I have retained a copy of this claim
      and the supporting records.
    </p>

    <div class="letter-signature">
      <div>
        Yours faithfully,<br><br>
        <strong>${escapeHtml(getValue("claimantName"))}</strong><br>
        Claimant
      </div>
      <div class="ai-prepared">
        Prepared with Bruce Rogers<br>
        AI Claims Assistant<br>
        User reviewed and approved
      </div>
    </div>

    <p class="document-notice">
      This draft was generated from information entered by the claimant. Bruce Rogers is an
      artificial-intelligence claims assistant, not a human or licensed lawyer. HolidayLawyer.ai
      is not a law firm, court or government authority and does not guarantee payment or legal success.
    </p>
  `;
}

document.getElementById("generateDocumentButton").addEventListener("click", () => {
  wizardState.caseReference = generateCaseReference();
  document.getElementById("caseReference").textContent = wizardState.caseReference;
  document.getElementById("claimDocument").innerHTML = buildClaimDocument();

  const attachments = wizardState.assessment.evidence.length
    ? wizardState.assessment.evidence.map((key) => evidenceLabels[key]).filter(Boolean)
    : ["No attachments selected"];

  document.getElementById("attachmentList").innerHTML =
    attachments.map((item) => `<li>${escapeHtml(item)}</li>`).join("");

  documentWorkspace.classList.remove("hidden");
  responseAnalyser.classList.remove("hidden");
  documentWorkspace.scrollIntoView({ behavior: "smooth", block: "start" });
  showToast("Claim package generated. Review every fact before sending.");
});

document.getElementById("copyDocumentButton").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(document.getElementById("claimDocument").innerText);
    showToast("Claim document copied.");
  } catch {
    showToast("Copy was blocked. Select and copy the document manually.");
  }
});

document.getElementById("printDocumentButton").addEventListener("click", () => {
  window.print();
});

function labelForIncident(value) {
  const labels = {
    delay: "long arrival delay",
    cancellation: "flight cancellation",
    denied: "denied boarding",
    connection: "missed connection"
  };
  return labels[value] || "flight disruption";
}

function labelForBaggage(value) {
  const labels = {
    delayed: "delayed baggage",
    lost: "missing baggage",
    damaged: "damaged baggage"
  };
  return labels[value] || "baggage problem";
}

function collectCaseData() {
  return {
    savedAt: new Date().toISOString(),
    step: wizardState.step,
    fields: {
      caseType: selectedCaseType(),
      departureArea: getValue("departureArea"),
      arrivalArea: getValue("arrivalArea"),
      carrierArea: getValue("carrierArea"),
      swissCase: getValue("swissCase"),
      flightIncident: getValue("flightIncident"),
      arrivalDelay: getValue("arrivalDelay"),
      distance: getValue("distance"),
      cause: getValue("cause"),
      baggageIncident: getValue("baggageIncident"),
      pir: getValue("pir"),
      baggageDays: getValue("baggageDays"),
      expenses: getValue("expenses"),
      claimantName: getValue("claimantName"),
      claimantEmail: getValue("claimantEmail"),
      airline: getValue("airline"),
      bookingReference: getValue("bookingReference"),
      flightNumber: getValue("flightNumber"),
      flightDate: getValue("flightDate"),
      claimantCount: getValue("claimantCount"),
      departureAirport: getValue("departureAirport"),
      arrivalAirport: getValue("arrivalAirport"),
      caseSummary: getValue("caseSummary"),
      requestedOutcome: getValue("requestedOutcome"),
      authorised: form.elements.authorised.checked,
      evidence: getCheckedEvidence()
    }
  };
}

function applyCaseData(data) {
  if (!data?.fields) return;

  const fields = data.fields;

  [...form.querySelectorAll('input[name="caseType"]')].forEach((input) => {
    input.checked = input.value === fields.caseType;
  });

  [
    "departureArea", "arrivalArea", "carrierArea", "swissCase",
    "flightIncident", "arrivalDelay", "distance", "cause",
    "baggageIncident", "pir", "baggageDays", "expenses",
    "claimantName", "claimantEmail", "airline", "bookingReference",
    "flightNumber", "flightDate", "claimantCount", "departureAirport",
    "arrivalAirport", "caseSummary", "requestedOutcome"
  ].forEach((name) => setValue(name, fields[name]));

  [...form.querySelectorAll('input[name="evidence"]')].forEach((input) => {
    input.checked = Array.isArray(fields.evidence) && fields.evidence.includes(input.value);
  });

  form.elements.authorised.checked = Boolean(fields.authorised);
  updateConditionalFields();
}

function updateSavedCaseIndicator() {
  const saved = localStorage.getItem("holidayLawyerCase");
  savedCaseButton.classList.toggle("has-case", Boolean(saved));
  savedCaseButton.innerHTML = saved
    ? "<span>●</span> Saved case available"
    : "<span>●</span> No saved case";
}

document.getElementById("saveCaseButton").addEventListener("click", () => {
  localStorage.setItem("holidayLawyerCase", JSON.stringify(collectCaseData()));
  updateSavedCaseIndicator();
  showToast("Case saved in this browser.");
});

savedCaseButton.addEventListener("click", () => {
  const raw = localStorage.getItem("holidayLawyerCase");
  if (!raw) {
    showToast("No saved case was found.");
    return;
  }

  try {
    const data = JSON.parse(raw);
    applyCaseData(data);
    wizardState.step = Math.min(Math.max(Number(data.step) || 1, 1), 5);
    assessmentPanel.classList.add("hidden");
    form.classList.remove("hidden");
    updateStep();
    showToast("Saved case restored.");
  } catch {
    showToast("The saved case could not be restored.");
  }
});

document.getElementById("clearCaseButton").addEventListener("click", () => {
  localStorage.removeItem("holidayLawyerCase");
  form.reset();
  wizardState.step = 1;
  wizardState.assessment = null;
  assessmentPanel.classList.add("hidden");
  documentWorkspace.classList.add("hidden");
  responseAnalyser.classList.add("hidden");
  form.classList.remove("hidden");
  updateConditionalFields();
  updateStep();
  updateSavedCaseIndicator();
  showToast("Case cleared.");
});

document.getElementById("exportCaseButton").addEventListener("click", () => {
  const data = JSON.stringify(collectCaseData(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `holidaylawyer-case-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Case file downloaded.");
});

function analyseResponse(text) {
  const content = text.toLowerCase();

  const acceptanceWords = ["we will pay", "payment has been approved", "claim approved", "compensation approved", "refund approved", "accepted your claim"];
  const infoWords = ["please provide", "additional information", "send us", "require the following", "missing document", "receipts", "boarding pass"];
  const extraordinaryWords = ["extraordinary circumstances", "weather conditions", "air traffic control", "airport closure", "security reasons", "strike outside"];
  const rejectionWords = ["claim rejected", "not entitled", "cannot compensate", "no compensation", "decline your claim", "not eligible"];

  if (acceptanceWords.some((word) => content.includes(word))) {
    return {
      type: "accepted",
      badge: "Likely accepted",
      heading: "The airline appears to accept the claim",
      text: "Check the amount, payment method and expected payment date. Keep the message until the money arrives.",
      reply: "Thank you for confirming acceptance of my claim. Please confirm the approved amount, payment method and expected payment date."
    };
  }

  if (extraordinaryWords.some((word) => content.includes(word))) {
    return {
      type: "extraordinary",
      badge: "Cause disputed",
      heading: "The airline relies on extraordinary circumstances",
      text: "This does not automatically explain the full refusal. Ask for the precise event, its effect on your flight and the reasonable measures taken.",
      reply: "Thank you for your response. Please identify the specific extraordinary circumstance, explain how it affected this flight and provide the factual basis for concluding that the disruption could not have been avoided despite reasonable measures."
    };
  }

  if (infoWords.some((word) => content.includes(word))) {
    return {
      type: "more-info",
      badge: "More information",
      heading: "The airline is requesting documents or details",
      text: "Reply with only the requested information, label each attachment clearly and keep a complete copy of what you send.",
      reply: "Thank you for your message. Please find the requested information and supporting documents attached. Kindly confirm receipt and continue the assessment of my claim."
    };
  }

  if (rejectionWords.some((word) => content.includes(word))) {
    return {
      type: "rejected",
      badge: "Likely rejected",
      heading: "The airline appears to reject the claim",
      text: "Check whether the response gives a specific factual and legal reason. A general refusal may need a focused reply or escalation.",
      reply: "Thank you for your response. Please provide the precise factual and legal basis for the refusal, together with the evidence relied on and the appropriate escalation or dispute-resolution process."
    };
  }

  return {
    type: "more-info",
    badge: "Needs review",
    heading: "The response is not clear enough to classify",
    text: "The message may contain a partial answer or generic wording. Identify whether it accepts, rejects or asks for more information.",
    reply: "Thank you for your response. Please clarify whether my claim is accepted, rejected or awaiting further information, and identify any action required from me."
  };
}

document.getElementById("analyseResponseButton").addEventListener("click", () => {
  const text = document.getElementById("airlineResponse").value.trim();
  const resultElement = document.getElementById("responseResult");
  const replyElement = document.getElementById("responseReply");

  if (!text) {
    showToast("Paste the airline response first.");
    return;
  }

  const result = analyseResponse(text);
  resultElement.className = `response-result ${result.type}`;
  resultElement.querySelector(".response-badge").textContent = result.badge;
  resultElement.querySelector("h3").textContent = result.heading;
  resultElement.querySelector("p").textContent = result.text;
  replyElement.textContent = `Suggested reply:\n\n${result.reply}`;
  replyElement.classList.remove("hidden");
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("visible"), 2800);
}

updateConditionalFields();
updateStep();
updateSavedCaseIndicator();
