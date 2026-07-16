const cases = {
  flight: {
    title: "Flight problem",
    description: "Delay, cancellation, denied boarding or a missed connection.",
    subject: "Formal claim concerning flight disruption",
    opening: "I am writing to submit a formal claim regarding a flight disruption connected with my holiday booking."
  },
  baggage: {
    title: "Baggage claim",
    description: "Lost, delayed or damaged baggage and necessary replacement purchases.",
    subject: "Formal claim concerning baggage loss, delay or damage",
    opening: "I am writing to submit a formal claim concerning my baggage and the losses or expenses resulting from the incident."
  },
  insurance: {
    title: "Travel insurance claim",
    description: "Rejected reimbursement, cancellation cover or travel-related expenses.",
    subject: "Request for review of travel insurance claim",
    opening: "I am writing to request a formal review of the decision or handling of my travel insurance claim."
  },
  hotel: {
    title: "Hotel or accommodation dispute",
    description: "Booking cancellation, serious defects, incorrect room or misleading description.",
    subject: "Formal complaint and claim concerning accommodation services",
    opening: "I am writing to make a formal complaint and claim concerning accommodation services provided in connection with my holiday."
  },
  package: {
    title: "Package holiday problem",
    description: "Missing services, major changes or a holiday materially different from the booking.",
    subject: "Formal claim concerning package holiday services",
    opening: "I am writing to submit a formal claim concerning the package holiday services supplied under my booking."
  },
  rental: {
    title: "Car rental dispute",
    description: "Unexpected charges, deposit problems or disputed vehicle damage.",
    subject: "Formal dispute concerning car rental charges or services",
    opening: "I am writing to formally dispute charges or service issues connected with my car rental booking."
  }
};

let selectedCase = "";

const caseForm = document.getElementById("caseForm");
const caseButtons = [...document.querySelectorAll("[data-case]")];
const selectedCaseTitle = document.getElementById("selectedCaseTitle");
const selectedCaseDescription = document.getElementById("selectedCaseDescription");
const formMessage = document.getElementById("formMessage");
const documentSection = document.getElementById("documentSection");
const generatedDocument = document.getElementById("generatedDocument");
const toast = document.getElementById("toast");

document.getElementById("year").textContent = new Date().getFullYear();

function chooseCase(caseKey, scroll = false) {
  if (!cases[caseKey]) return;

  selectedCase = caseKey;
  selectedCaseTitle.textContent = cases[caseKey].title;
  selectedCaseDescription.textContent = cases[caseKey].description;

  document.querySelectorAll("#caseMenu button").forEach((button) => {
    button.classList.toggle("active", button.dataset.case === caseKey);
  });

  document.querySelectorAll(".service-card").forEach((card) => {
    card.style.borderColor = card.dataset.case === caseKey ? "#93b5f5" : "";
  });

  formMessage.textContent = "";

  if (scroll) {
    document.getElementById("builder").scrollIntoView({ behavior: "smooth" });
  }
}

document.querySelectorAll("#caseMenu button").forEach((button) => {
  button.addEventListener("click", () => chooseCase(button.dataset.case));
});

document.querySelectorAll(".choose-case").forEach((button) => {
  button.addEventListener("click", () => chooseCase(button.dataset.case, true));
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function buildDocument(data) {
  const caseInfo = cases[selectedCase];
  const today = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date());

  const evidenceList = data.evidence
    ? data.evidence.split(",").map((item) => item.trim()).filter(Boolean)
    : [];

  return `
    <div class="letter-top">
      <div>
        <strong>${escapeHtml(data.fullName)}</strong><br>
        ${escapeHtml(data.country)}
      </div>
      <div>
        ${escapeHtml(today)}<br>
        Reference: ${escapeHtml(data.reference)}
      </div>
    </div>

    <p>
      Customer Relations / Claims Department<br>
      <strong>${escapeHtml(data.provider)}</strong>
    </p>

    <h3>${escapeHtml(caseInfo.subject)}</h3>

    <p>Dear Sir or Madam,</p>

    <p>${escapeHtml(caseInfo.opening)}</p>

    <p>
      The relevant incident occurred on <strong>${escapeHtml(formatDate(data.incidentDate))}</strong>.
      My booking, policy or case reference is <strong>${escapeHtml(data.reference)}</strong>.
    </p>

    <p>
      <strong>Summary of the matter</strong><br>
      ${escapeHtml(data.summary).replaceAll("\n", "<br>")}
    </p>

    <p>
      I request <strong>${escapeHtml(data.outcome.toLowerCase())}</strong>.
      The amount or resolution currently requested is
      <strong>${escapeHtml(data.amount)}</strong>.
    </p>

    <p>Please review this matter and provide:</p>
    <ul>
      <li>a written confirmation that this claim has been received;</li>
      <li>a clear decision based on the booking, policy or service terms that apply;</li>
      <li>payment, reimbursement, refund or correction where the claim is accepted; and</li>
      <li>a precise factual and contractual explanation if any part of the claim is refused.</li>
    </ul>

    ${evidenceList.length ? `
      <p><strong>Available supporting evidence</strong></p>
      <ul>
        ${evidenceList.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    ` : `
      <p>
        I have retained relevant booking records, correspondence and other supporting evidence
        and can provide copies where required.
      </p>
    `}

    <p>
      Please respond within a reasonable period and identify the correct escalation or
      dispute-resolution process if the matter cannot be resolved directly.
    </p>

    <p>
      Yours faithfully,<br><br>
      <strong>${escapeHtml(data.fullName)}</strong>
    </p>

    <p class="document-notice">
      AI-assisted template generated from information entered by the user.
      Review all facts, legal references, deadlines and requested amounts before sending.
      HolidayLawyer.ai is not a law firm, court or government authority and does not guarantee an outcome.
    </p>
  `;
}

caseForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!selectedCase) {
    formMessage.textContent = "Please choose a case type first.";
    return;
  }

  if (!caseForm.checkValidity()) {
    formMessage.textContent = "Please complete the required fields.";
    caseForm.reportValidity();
    return;
  }

  const data = {
    fullName: document.getElementById("fullName").value.trim(),
    provider: document.getElementById("provider").value.trim(),
    reference: document.getElementById("reference").value.trim(),
    incidentDate: document.getElementById("incidentDate").value,
    country: document.getElementById("country").value.trim(),
    amount: document.getElementById("amount").value.trim(),
    outcome: document.getElementById("outcome").value,
    summary: document.getElementById("summary").value.trim(),
    evidence: document.getElementById("evidence").value.trim()
  };

  generatedDocument.innerHTML = buildDocument(data);
  documentSection.classList.remove("hidden");
  documentSection.scrollIntoView({ behavior: "smooth", block: "start" });
  showToast("Document generated. Review every detail before sending.");
});

document.getElementById("copyDocument").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(generatedDocument.innerText);
    showToast("Document copied.");
  } catch {
    showToast("Copy was blocked. Select and copy the document manually.");
  }
});

document.getElementById("printDocument").addEventListener("click", () => {
  window.print();
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("visible"), 2800);
}
