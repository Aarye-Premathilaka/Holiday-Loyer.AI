const state = {
  view: "home",
  step: 1,
  totalSteps: 4,
  assessment: null,
  reference: ""
};

const form = document.getElementById("caseForm");
const formSteps = [...document.querySelectorAll(".form-step")];
const views = [...document.querySelectorAll(".app-view")];
const navButtons = [...document.querySelectorAll(".bottom-nav [data-view-link]")];
const toast = document.getElementById("toast");

const stepNames = { 1: "Problem", 2: "Incident", 3: "Details", 4: "Evidence" };
const evidenceNames = {
  booking: "Booking confirmation",
  boarding: "Boarding pass",
  messages: "Airline messages",
  receipts: "Receipts",
  photos: "Photos",
  pir: "Baggage incident report"
};

function showView(view) {
  state.view = view;
  views.forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.viewLink === view));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("click", (event) => {
  const viewLink = event.target.closest("[data-view-link]");
  if (viewLink) showView(viewLink.dataset.viewLink);

  const startCase = event.target.closest("[data-start-case]");
  if (startCase) {
    selectCase(startCase.dataset.startCase);
    showView("check");
  }
});

function selectCase(type) {
  [...form.querySelectorAll('input[name="caseType"]')].forEach((input) => {
    input.checked = input.value === type;
  });
  updateConditionalFields();
  state.step = 2;
  updateStep();
}

function getValue(name) {
  return form.elements[name]?.value || "";
}

function caseType() {
  return form.querySelector('input[name="caseType"]:checked')?.value || "";
}

function evidenceValues() {
  return [...form.querySelectorAll('input[name="evidence"]:checked')].map((input) => input.value);
}

function updateConditionalFields() {
  const type = caseType();
  const flight = document.getElementById("flightFields");
  const baggage = document.getElementById("baggageFields");

  flight.classList.toggle("hidden", type !== "flight");
  baggage.classList.toggle("hidden", type !== "baggage");

  flight.querySelectorAll("select").forEach((select) => {
    select.required = type === "flight";
    if (type !== "flight") select.value = "";
  });

  baggage.querySelectorAll("select").forEach((select) => {
    select.required = type === "baggage";
    if (type !== "baggage") select.value = "";
  });

  document.getElementById("checkTitle").textContent = type === "baggage" ? "Baggage claim" : "Flight claim";
}

form.addEventListener("change", (event) => {
  if (event.target.name === "caseType") updateConditionalFields();
});

function updateStep() {
  formSteps.forEach((step) => step.classList.toggle("active", Number(step.dataset.step) === state.step));
  document.getElementById("stepLabel").textContent = `${state.step} of ${state.totalSteps}`;
  document.getElementById("stepName").textContent = stepNames[state.step];
  document.getElementById("progressFill").style.width = `${state.step / state.totalSteps * 100}%`;
  document.getElementById("backButton").disabled = state.step === 1;
  document.getElementById("nextButton").textContent = state.step === state.totalSteps ? "See result" : "Continue";
  document.getElementById("formError").textContent = "";
}

function validateStep() {
  const active = formSteps.find((step) => Number(step.dataset.step) === state.step);
  const required = [...active.querySelectorAll("[required]")].filter((element) => !element.closest(".hidden"));

  for (const element of required) {
    if (element.type === "radio") {
      if (!active.querySelector(`input[name="${element.name}"]:checked`)) {
        return fail("Choose an option before continuing.");
      }
    } else if (element.type === "checkbox") {
      if (!element.checked) return fail("Please confirm the information before continuing.");
    } else if (!String(element.value).trim()) {
      element.focus();
      return fail("Complete the required fields.");
    } else if (!element.checkValidity()) {
      element.reportValidity();
      return fail("Check the information you entered.");
    }
  }
  return true;
}

function fail(message) {
  document.getElementById("formError").textContent = message;
  return false;
}

document.getElementById("nextButton").addEventListener("click", () => {
  if (!validateStep()) return;
  if (state.step < state.totalSteps) {
    state.step += 1;
    updateStep();
  } else {
    showAssessment();
  }
});

document.getElementById("backButton").addEventListener("click", () => {
  if (state.step > 1) {
    state.step -= 1;
    updateStep();
  }
});

function routeCoverage() {
  const departure = getValue("departureArea");
  const arrival = getValue("arrivalArea");
  const carrier = getValue("carrierArea");
  if (departure === "covered") return "covered";
  if (departure === "outside" && arrival === "covered" && carrier === "covered") return "covered";
  if (departure === "outside" && arrival === "covered" && carrier === "unknown") return "uncertain";
  return "outside";
}

function estimateValue() {
  if (caseType() === "baggage") {
    if (getValue("expenses") === "yes") return "Documented expenses";
    if (getValue("baggageIncident") === "damaged") return "Repair / replacement";
    return "Evidence needed";
  }

  if (routeCoverage() === "outside") return "Outside route test";
  if (getValue("flightIncident") === "delay" && getValue("arrivalDelay") === "under3") return "Unlikely standard payment";

  const amounts = { short: "Possible €250", medium: "Possible €400", long: "Possible €600" };
  const amount = amounts[getValue("distance")] || "Distance needed";
  return getValue("cause") === "extraordinary" && amount.startsWith("Possible")
    ? amount.replace("Possible", "Disputed")
    : amount;
}

function readiness() {
  let score = 35;
  const important = ["claimantName", "claimantEmail", "airline", "bookingReference", "flightNumber", "flightDate", "departureAirport", "arrivalAirport", "caseSummary", "requestedOutcome"];
  important.forEach((field) => { if (getValue(field)) score += 4; });
  score += Math.min(evidenceValues().length * 4, 24);
  if (caseType() === "baggage" && getValue("pir") === "yes") score += 5;
  return Math.min(score, 100);
}

function buildAssessment() {
  const reasons = [];
  const coverage = routeCoverage();
  const score = readiness();

  reasons.push(coverage === "covered" ? "The route appears to pass the simplified coverage test." : coverage === "uncertain" ? "The operating airline must be confirmed." : "This route appears outside the simplified route test.");

  if (caseType() === "flight") {
    if (["3to4", "over4"].includes(getValue("arrivalDelay"))) reasons.push("The reported arrival delay is at least three hours.");
    if (getValue("cause") === "extraordinary") reasons.push("The airline may dispute payment because of the reported cause.");
    if (getValue("cause") === "none") reasons.push("No clear reason has been provided by the airline.");
  } else {
    reasons.push(getValue("pir") === "yes" ? "A baggage incident report was completed." : "A baggage incident report may still be needed.");
    if (getValue("expenses") === "yes") reasons.push("Necessary purchases are supported by receipts.");
  }

  if (!evidenceValues().includes("booking")) reasons.push("Add the booking confirmation before sending.");

  return { score, coverage, estimate: estimateValue(), reasons };
}

function showAssessment() {
  state.assessment = buildAssessment();
  form.classList.add("hidden");
  const card = document.getElementById("resultCard");
  card.classList.remove("hidden");

  document.getElementById("resultHeading").textContent = state.assessment.score >= 80 ? "Case looks well prepared" : state.assessment.score >= 60 ? "Case is ready for review" : "Add a few missing details";
  document.getElementById("readinessScore").textContent = `${state.assessment.score}%`;
  document.getElementById("scoreRing").style.background = `radial-gradient(closest-side,#fff 73%,transparent 74% 99%), conic-gradient(var(--blue) ${state.assessment.score}%,#e5eaf1 0)`;
  document.getElementById("possibleValue").textContent = state.assessment.estimate;
  document.getElementById("coverageValue").textContent = { covered: "Appears covered", uncertain: "Confirm airline", outside: "Appears outside" }[state.assessment.coverage];
  document.getElementById("resultReasons").innerHTML = state.assessment.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("");
  updateHomeAndCase();
}

document.getElementById("editCaseButton").addEventListener("click", () => {
  document.getElementById("resultCard").classList.add("hidden");
  form.classList.remove("hidden");
  state.step = 4;
  updateStep();
});

document.getElementById("buildLetterButton").addEventListener("click", () => {
  state.reference = createReference();
  document.getElementById("claimLetter").innerHTML = buildLetter();
  document.getElementById("letterCard").classList.remove("hidden");
  updateHomeAndCase();
  showView("case");
  showToast("Claim letter created. Review every detail before sending.");
});

function createReference() {
  const date = new Date();
  return `HL-${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function outcomeText(value) {
  return {
    compensation: "the compensation applicable to this journey",
    refund: "a refund of the affected travel service",
    expenses: "reimbursement of documented necessary expenses",
    "compensation-expenses": "the applicable compensation and documented necessary expenses",
    "written-response": "a clear written explanation and appropriate resolution"
  }[value] || "an appropriate resolution";
}

function buildLetter() {
  const evidence = evidenceValues().map((key) => evidenceNames[key]).filter(Boolean);
  const today = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric" }).format(new Date());
  const type = caseType() === "baggage" ? "baggage incident" : "flight disruption";

  return `
    <div class="letter-head"><div><strong>HolidayLawyer.ai</strong><br><span>Prepared with Bruce Rogers · AI Claims Assistant</span></div><strong>BR</strong></div>
    <p><strong>${escapeHtml(getValue("claimantName"))}</strong><br>${escapeHtml(getValue("claimantEmail"))}<br>${escapeHtml(today)}<br>Case ${escapeHtml(state.reference)}</p>
    <p>Customer Relations / Claims Department<br><strong>${escapeHtml(getValue("airline"))}</strong></p>
    <h3>Formal claim concerning ${escapeHtml(type)} — Flight ${escapeHtml(getValue("flightNumber"))}, ${escapeHtml(formatDate(getValue("flightDate")))}</h3>
    <p>Dear Sir or Madam,</p>
    <p>I am writing as the claimant regarding booking reference <strong>${escapeHtml(getValue("bookingReference"))}</strong> and the journey from <strong>${escapeHtml(getValue("departureAirport"))}</strong> to <strong>${escapeHtml(getValue("arrivalAirport"))}</strong>.</p>
    <p><strong>Factual summary</strong><br>${escapeHtml(getValue("caseSummary")).replaceAll("\n", "<br>")}</p>
    <p>I request ${escapeHtml(outcomeText(getValue("requestedOutcome")))}. The current initial assessment is <strong>${escapeHtml(state.assessment?.estimate || "subject to verification")}</strong>.</p>
    <p>Please confirm receipt and provide a clear written decision. If the claim is refused, please identify the factual and contractual or legal basis, the supporting evidence and the appropriate escalation process.</p>
    ${evidence.length ? `<p><strong>Supporting evidence</strong></p><ul>${evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
    <p>Yours faithfully,<br><br><strong>${escapeHtml(getValue("claimantName"))}</strong><br>Claimant</p>
    <p class="letter-note">This draft was prepared with Bruce Rogers, an AI Claims Assistant. Bruce Rogers is software, not a human or licensed lawyer. The claimant must review and approve every statement before sending.</p>
  `;
}

function updateHomeAndCase() {
  if (!state.assessment) return;

  document.getElementById("homeCaseTitle").textContent = caseType() === "baggage" ? "Baggage claim" : "Flight claim";
  document.getElementById("homeCaseStatus").textContent = state.reference ? "Letter ready" : "Checked";
  document.getElementById("homeCaseText").textContent = `${state.assessment.score}% ready · ${state.assessment.estimate}`;
  document.getElementById("continueCaseButton").textContent = state.reference ? "Open case" : "Continue case";
  document.getElementById("continueCaseButton").dataset.viewLink = state.reference ? "case" : "check";

  document.getElementById("caseStatusTitle").textContent = state.reference ? "Claim letter ready" : "Assessment complete";
  document.getElementById("caseStatusDot").textContent = state.reference ? "Ready" : "Checked";
  document.getElementById("caseReference").textContent = state.reference || "Pending";
  document.getElementById("caseReadiness").textContent = `${state.assessment.score}%`;
  document.getElementById("caseEstimate").textContent = state.assessment.estimate;
  document.getElementById("casePageSubtitle").textContent = state.reference ? "Review and export the document below." : "Your assessment is ready. Build the letter when you are satisfied.";
  document.getElementById("caseActionButton").textContent = state.reference ? "Edit case" : "Build letter in Check";
}

document.getElementById("copyLetterButton").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(document.getElementById("claimLetter").innerText);
    showToast("Letter copied.");
  } catch {
    showToast("Copy was blocked. Select the text manually.");
  }
});

document.getElementById("printLetterButton").addEventListener("click", () => window.print());

function analyseReply(text) {
  const value = text.toLowerCase();
  if (["we will pay", "claim approved", "refund approved", "accepted your claim"].some((word) => value.includes(word))) {
    return { badge: "Accepted", heading: "The claim appears accepted", text: "Check the amount and expected payment date.", reply: "Thank you for confirming acceptance. Please confirm the approved amount and expected payment date." };
  }
  if (["extraordinary circumstances", "weather conditions", "air traffic control", "airport closure", "security reasons"].some((word) => value.includes(word))) {
    return { badge: "Cause disputed", heading: "They rely on extraordinary circumstances", text: "Ask for the exact event, its effect on your flight and the reasonable measures taken.", reply: "Please identify the specific extraordinary circumstance, explain how it affected this flight and provide the factual basis for concluding that the disruption could not have been avoided despite reasonable measures." };
  }
  if (["please provide", "additional information", "missing document", "boarding pass", "receipts"].some((word) => value.includes(word))) {
    return { badge: "More details", heading: "They need more information", text: "Send only the requested items and keep a complete copy.", reply: "Please find the requested information and supporting documents attached. Kindly confirm receipt and continue the assessment of my claim." };
  }
  if (["claim rejected", "not entitled", "cannot compensate", "no compensation", "not eligible"].some((word) => value.includes(word))) {
    return { badge: "Rejected", heading: "The claim appears rejected", text: "Check whether they gave a precise factual and legal reason.", reply: "Please provide the precise factual and legal basis for the refusal, the evidence relied on and the appropriate escalation process." };
  }
  return { badge: "Unclear", heading: "The response needs closer review", text: "It does not clearly accept, reject or request information.", reply: "Please clarify whether my claim is accepted, rejected or awaiting further information, and identify any action required from me." };
}

document.getElementById("analyseReplyButton").addEventListener("click", () => {
  const text = document.getElementById("airlineResponse").value.trim();
  if (!text) return showToast("Paste the airline response first.");
  const result = analyseReply(text);
  document.getElementById("replyBadge").textContent = result.badge;
  document.getElementById("replyHeading").textContent = result.heading;
  document.getElementById("replyText").textContent = result.text;
  document.getElementById("replySuggestion").textContent = result.reply;
  document.getElementById("replyResult").classList.remove("hidden");
});

function caseData() {
  const fields = {};
  [...form.elements].forEach((element) => {
    if (!element.name || element.name === "evidence") return;
    if (["radio", "checkbox"].includes(element.type)) {
      if (element.checked) fields[element.name] = element.value || true;
    } else {
      fields[element.name] = element.value;
    }
  });
  fields.evidence = evidenceValues();
  return { fields, assessment: state.assessment, reference: state.reference, letter: document.getElementById("claimLetter").innerHTML };
}

function restoreCase(data) {
  if (!data?.fields) return;
  [...form.elements].forEach((element) => {
    if (!element.name) return;
    if (element.name === "evidence") {
      element.checked = Array.isArray(data.fields.evidence) && data.fields.evidence.includes(element.value);
    } else if (element.type === "radio") {
      element.checked = data.fields[element.name] === element.value;
    } else if (element.type === "checkbox") {
      element.checked = Boolean(data.fields[element.name]);
    } else if (data.fields[element.name] !== undefined) {
      element.value = data.fields[element.name];
    }
  });
  state.assessment = data.assessment || null;
  state.reference = data.reference || "";
  document.getElementById("claimLetter").innerHTML = data.letter || "";
  document.getElementById("letterCard").classList.toggle("hidden", !data.letter);
  updateConditionalFields();
  updateHomeAndCase();
}

document.getElementById("saveCaseButton").addEventListener("click", () => {
  localStorage.setItem("holidayLawyerCompactCase", JSON.stringify(caseData()));
  showToast("Case saved on this device.");
});

document.getElementById("exportCaseButton").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(caseData(), null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `holidaylawyer-case-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

document.getElementById("clearCaseButton").addEventListener("click", () => {
  localStorage.removeItem("holidayLawyerCompactCase");
  form.reset();
  state.step = 1;
  state.assessment = null;
  state.reference = "";
  document.getElementById("resultCard").classList.add("hidden");
  document.getElementById("letterCard").classList.add("hidden");
  form.classList.remove("hidden");
  updateConditionalFields();
  updateStep();
  location.reload();
});

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("visible"), 2600);
}

const saved = localStorage.getItem("holidayLawyerCompactCase");
if (saved) {
  try { restoreCase(JSON.parse(saved)); } catch { /* Ignore broken local data. */ }
}

updateConditionalFields();
updateStep();
