const state = {
  step: 1,
  totalSteps: 4,
  assessment: null
};

const form = document.getElementById("eligibilityForm");
const steps = [...document.querySelectorAll(".form-step")];
const nextButton = document.getElementById("nextButton");
const backButton = document.getElementById("backButton");
const progressBar = document.getElementById("progressBar");
const stepLabel = document.getElementById("stepLabel");
const stepTitle = document.getElementById("stepTitle");
const formError = document.getElementById("formError");
const resultPanel = document.getElementById("resultPanel");
const resultIcon = document.getElementById("resultIcon");
const resultHeading = document.getElementById("resultHeading");
const resultText = document.getElementById("resultText");
const resultAmount = document.getElementById("resultAmount");
const resultReasons = document.getElementById("resultReasons");
const openClaimFormButton = document.getElementById("openClaimForm");
const restartButton = document.getElementById("restartButton");
const claimBuilder = document.getElementById("claimBuilder");
const claimForm = document.getElementById("claimForm");
const claimDocument = document.getElementById("claimDocument");
const documentActions = document.getElementById("documentActions");
const documentStatus = document.getElementById("documentStatus");
const toast = document.getElementById("toast");

const stepTitles = {
  1: "Route coverage",
  2: "Arrival delay",
  3: "Flight distance",
  4: "Reason for disruption"
};

document.getElementById("currentYear").textContent = new Date().getFullYear();

function selected(name) {
  return form.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

function updateStep() {
  steps.forEach((step) => {
    step.classList.toggle("active", Number(step.dataset.step) === state.step);
  });

  stepLabel.textContent = `Step ${state.step} of ${state.totalSteps}`;
  stepTitle.textContent = stepTitles[state.step];
  progressBar.style.width = `${(state.step / state.totalSteps) * 100}%`;
  backButton.disabled = state.step === 1;
  nextButton.textContent = state.step === state.totalSteps ? "See my result" : "Continue";
  formError.textContent = "";
}

function validateCurrentStep() {
  const activeStep = steps.find((step) => Number(step.dataset.step) === state.step);
  const groups = [...new Set([...activeStep.querySelectorAll("input[type='radio']")].map((input) => input.name))];

  const missing = groups.find((group) => !activeStep.querySelector(`input[name="${group}"]:checked`));

  if (missing) {
    formError.textContent = "Please select an answer for each question before continuing.";
    return false;
  }

  return true;
}

function calculateAssessment() {
  const departureRegion = selected("departureRegion");
  const arrivalRegion = selected("arrivalRegion");
  const coveredCarrier = selected("coveredCarrier");
  const arrivalDelay = selected("arrivalDelay");
  const distance = selected("distance");
  const intraArea = selected("intraArea");
  const cause = selected("cause");

  const routeCovered =
    departureRegion === "covered" ||
    (departureRegion === "outside" &&
      arrivalRegion === "covered" &&
      coveredCarrier === "yes");

  const routeUncertain =
    departureRegion === "outside" &&
    arrivalRegion === "covered" &&
    coveredCarrier === "unknown";

  let amount = 0;
  if (distance === "short") amount = 250;
  if (distance === "medium") amount = 400;
  if (distance === "long") amount = intraArea === "yes" ? 400 : 600;

  let type = "positive";
  let heading = "Your flight may qualify";
  let text = "Based on the answers provided, you may have a compensation claim. Review the facts and supporting evidence before sending the letter.";
  let displayAmount = `Up to €${amount}`;
  let canGenerate = true;
  const reasons = [];

  if (!routeCovered && !routeUncertain) {
    type = "negative";
    heading = "The route appears outside this rule set";
    text = "The simplified EC 261 / Swiss passenger-rights route test does not appear to cover this journey. Other national or contractual rights may still exist.";
    displayAmount = "No standard estimate";
    canGenerate = false;
    reasons.push("The flight did not depart from the covered area.");
    reasons.push("An inbound journey normally requires a covered-area operating airline.");
  } else if (routeUncertain) {
    type = "warning";
    heading = "More airline information is needed";
    text = "The journey may be covered, but the operating airline's legal base is important for an inbound flight.";
    displayAmount = `Possible €${amount}`;
    reasons.push("Confirm the operating carrier, not only the company that sold the ticket.");
    reasons.push("The result should be checked before making a formal demand.");
  } else if (arrivalDelay === "under3") {
    type = "negative";
    heading = "Standard delay compensation is unlikely";
    text = "The reported arrival delay was below three hours. Assistance, reimbursement or other rights may still apply depending on the circumstances.";
    displayAmount = "Below 3-hour threshold";
    canGenerate = false;
    reasons.push("The relevant delay is normally the delay at the final destination.");
    reasons.push("Keep receipts for meals, accommodation or transport provided during a long wait.");
  } else if (arrivalDelay === "unknown") {
    type = "warning";
    heading = "Confirm the final arrival delay";
    text = "A compensation assessment needs the difference between the scheduled and actual arrival at the final destination.";
    displayAmount = `Possible €${amount}`;
    reasons.push("Use the time when a door was opened and passengers could leave, where available.");
    reasons.push("Save boarding passes, notifications and arrival-time evidence.");
  } else if (cause === "extraordinary") {
    type = "warning";
    heading = "Compensation may be disputed";
    text = "The stated cause may count as an extraordinary circumstance. The airline may avoid standard compensation if it proves the event and that reasonable measures could not prevent the delay.";
    displayAmount = `Claim value: €${amount}`;
    reasons.push("Care and assistance rights can still exist even when compensation is refused.");
    reasons.push("Ask the airline for a specific explanation and supporting facts.");
  } else {
    reasons.push("The route appears to pass the simplified coverage test.");
    reasons.push("The reported arrival delay is at least three hours.");
    reasons.push(cause === "unknown"
      ? "No clear extraordinary circumstance has yet been established."
      : "The reported reason appears more consistent with an airline-controlled disruption.");
  }

  if (intraArea === "unknown" && distance === "long") {
    type = type === "negative" ? type : "warning";
    displayAmount = "Possible €400–€600";
    reasons.push("For a long route, the amount depends on whether both airports were inside the covered area.");
  }

  return {
    type,
    heading,
    text,
    displayAmount,
    amount,
    canGenerate,
    reasons,
    answers: {
      departureRegion,
      arrivalRegion,
      coveredCarrier,
      arrivalDelay,
      distance,
      intraArea,
      cause
    }
  };
}

function showResult() {
  state.assessment = calculateAssessment();
  form.style.display = "none";
  resultPanel.className = `result-panel visible ${state.assessment.type}`;
  resultHeading.textContent = state.assessment.heading;
  resultText.textContent = state.assessment.text;
  resultAmount.textContent = state.assessment.displayAmount;
  resultReasons.innerHTML = state.assessment.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("");

  if (state.assessment.type === "negative") {
    resultIcon.textContent = "×";
  } else if (state.assessment.type === "warning") {
    resultIcon.textContent = "!";
  } else {
    resultIcon.textContent = "✓";
  }

  openClaimFormButton.style.display = state.assessment.canGenerate ? "inline-flex" : "none";
}

nextButton.addEventListener("click", () => {
  if (!validateCurrentStep()) return;

  if (state.step < state.totalSteps) {
    state.step += 1;
    updateStep();
    return;
  }

  showResult();
});

backButton.addEventListener("click", () => {
  if (state.step > 1) {
    state.step -= 1;
    updateStep();
  }
});

restartButton.addEventListener("click", () => {
  form.reset();
  form.style.display = "block";
  resultPanel.className = "result-panel";
  claimBuilder.classList.add("hidden");
  state.step = 1;
  state.assessment = null;
  updateStep();
  document.getElementById("checker").scrollIntoView({ behavior: "smooth" });
});

openClaimFormButton.addEventListener("click", () => {
  claimBuilder.classList.remove("hidden");
  claimBuilder.scrollIntoView({ behavior: "smooth" });
});

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildLetter(data) {
  const amount = state.assessment?.amount || 0;
  const amountText = state.assessment?.displayAmount || `€${amount}`;
  const causeText = state.assessment?.answers.cause === "extraordinary"
    ? "I understand that the airline may rely on extraordinary circumstances. If so, please provide a precise explanation and the supporting facts showing both the circumstances and the reasonable measures taken."
    : "Based on the information currently available to me, no qualifying extraordinary circumstance has been established.";

  return `
    <div class="letter-meta">
      <strong>${escapeHtml(data.passengerName)}</strong><br>
      Date: ${escapeHtml(new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric" }).format(new Date()))}
    </div>

    <p>
      Customer Relations Department<br>
      <strong>${escapeHtml(data.airlineName)}</strong>
    </p>

    <p class="letter-subject">
      Formal compensation claim — Flight ${escapeHtml(data.flightNumber)} on ${escapeHtml(formatDate(data.flightDate))}
    </p>

    <p>Dear Sir or Madam,</p>

    <p>
      I am writing to submit a formal claim concerning flight
      <strong>${escapeHtml(data.flightNumber)}</strong> from
      <strong>${escapeHtml(data.departureAirport)}</strong> to
      <strong>${escapeHtml(data.arrivalAirport)}</strong> on
      <strong>${escapeHtml(formatDate(data.flightDate))}</strong>.
      My booking reference is <strong>${escapeHtml(data.bookingReference)}</strong>.
    </p>

    <p>
      The scheduled arrival time was <strong>${escapeHtml(data.scheduledArrival)}</strong>,
      while the actual arrival time was <strong>${escapeHtml(data.actualArrival)}</strong>.
      I therefore request that you assess and pay the applicable compensation under
      Regulation (EC) No 261/2004, as applicable to this journey, together with the
      relevant rules and case law concerning long arrival delays.
    </p>

    <p>
      The current estimate produced from the journey information is
      <strong>${escapeHtml(amountText)}</strong>. This estimate is subject to final verification
      of the route, distance, operating carrier, actual arrival delay and cause of disruption.
    </p>

    <p>${escapeHtml(causeText)}</p>

    ${data.extraFacts ? `<p><strong>Additional facts:</strong><br>${escapeHtml(data.extraFacts).replaceAll("\n", "<br>")}</p>` : ""}

    <p>Please:</p>
    <ul>
      <li>confirm receipt of this claim;</li>
      <li>pay any compensation due, or provide a clear legal and factual reason for refusal;</li>
      <li>identify any evidence relied on if extraordinary circumstances are claimed; and</li>
      <li>provide the appropriate escalation or complaint channel if the claim is rejected.</li>
    </ul>

    <p>
      I have retained my booking confirmation, boarding documents, delay notifications
      and other supporting evidence and can provide copies where required.
    </p>

    <p>
      Please respond within a reasonable period. If the matter is not resolved, I reserve
      the right to refer the case to the competent passenger-rights enforcement or dispute-resolution body
      and to consider further legal steps.
    </p>

    <p>
      Yours faithfully,<br><br>
      <strong>${escapeHtml(data.passengerName)}</strong>
    </p>

    <p class="legal-disclaimer">
      AI-assisted draft — review before sending. This document is not issued by a court,
      government authority or law firm and does not itself prove that compensation is owed.
    </p>
  `;
}

claimForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!claimForm.checkValidity()) {
    claimForm.reportValidity();
    return;
  }

  const data = {
    passengerName: document.getElementById("passengerName").value.trim(),
    airlineName: document.getElementById("airlineName").value.trim(),
    flightNumber: document.getElementById("flightNumber").value.trim().toUpperCase(),
    flightDate: document.getElementById("flightDate").value,
    bookingReference: document.getElementById("bookingReference").value.trim().toUpperCase(),
    departureAirport: document.getElementById("departureAirport").value.trim(),
    arrivalAirport: document.getElementById("arrivalAirport").value.trim(),
    scheduledArrival: document.getElementById("scheduledArrival").value,
    actualArrival: document.getElementById("actualArrival").value,
    extraFacts: document.getElementById("extraFacts").value.trim()
  };

  claimDocument.innerHTML = buildLetter(data);
  documentActions.classList.remove("hidden");
  documentStatus.textContent = "Draft generated";
  documentStatus.style.color = "#67e8c3";
  showToast("Claim letter generated. Review every detail before sending.");
});

document.getElementById("copyLetter").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(claimDocument.innerText);
    showToast("Letter copied to clipboard.");
  } catch {
    showToast("Copy was blocked by the browser. Select the letter text manually.");
  }
});

document.getElementById("printLetter").addEventListener("click", () => {
  window.print();
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("visible"), 2800);
}

updateStep();
