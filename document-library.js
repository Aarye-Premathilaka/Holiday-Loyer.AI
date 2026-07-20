(() => {
  "use strict";

  const STORAGE_KEY = "holidayLawyerDocumentLibraryV1";
  const MAX_DOCUMENTS = 24;
  const HTML2PDF_URLS = [
    "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js",
    "https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js"
  ];

  let pdfLibraryPromise = null;
  let saveTimer = null;

  function value(name) {
    const field = document.getElementById("caseForm")?.elements[name];
    return typeof field?.value === "string" ? field.value.trim() : "";
  }

  function currentReference() {
    try {
      if (typeof state !== "undefined" && state.reference) return state.reference;
    } catch {
      // Fall back to the visible reference.
    }
    const visible = document.getElementById("caseReference")?.textContent?.trim();
    return visible && !["—", "Pending"].includes(visible) ? visible : "";
  }

  function toast(message) {
    try {
      if (typeof showToast === "function") return showToast(message);
    } catch {
      // Use the local toast below.
    }
    const element = document.getElementById("toast");
    if (!element) return;
    element.textContent = message;
    element.classList.add("visible");
    window.setTimeout(() => element.classList.remove("visible"), 2800);
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function cleanFilePart(text, fallback = "claim") {
    const cleaned = String(text || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70);
    return cleaned || fallback;
  }

  function getDocuments() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function persistDocuments(documents) {
    let next = documents.slice(0, MAX_DOCUMENTS);
    while (next.length) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      } catch {
        next = next.slice(0, -1);
      }
    }
    return [];
  }

  function hashText(text) {
    let hash = 2166136261;
    const source = String(text || "");
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function claimContainer() {
    return document.getElementById("claimLetter");
  }

  function printableElement(root = claimContainer()) {
    if (!root) return null;
    return root.querySelector(".formal-legal-document, .email-sheet") || root;
  }

  function hasUsableDocument() {
    const root = claimContainer();
    if (!root) return false;
    const text = root.innerText.replace(/\s+/g, " ").trim();
    return text.length > 180 && !root.querySelector(".offline-formal-trigger");
  }

  function selectedEvidenceLabels() {
    const labels = [];
    document.querySelectorAll('input[name="evidence"]:checked').forEach((input) => {
      const text = input.closest("label")?.innerText?.trim();
      if (text) labels.push(text);
    });
    return labels;
  }

  function buildSnapshot() {
    const root = claimContainer();
    if (!root || !hasUsableDocument()) return null;

    const reference = currentReference();
    const flight = value("flightNumber").toUpperCase();
    const airline = value("airline");
    const from = value("departureAirport");
    const to = value("arrivalAirport");
    const claimant = value("claimantName");
    const caseKind = document.querySelector('input[name="caseType"]:checked')?.value || "flight";
    const html = root.innerHTML;
    const fingerprint = hashText(`${reference}|${flight}|${html}`);
    const now = new Date().toISOString();

    return {
      id: reference || `HL-DOC-${Date.now()}-${fingerprint}`,
      reference,
      title: `${caseKind === "baggage" ? "Baggage claim" : "Flight claim"}${flight ? ` · ${flight}` : ""}`,
      claimant,
      airline,
      flight,
      route: [from, to].filter(Boolean).join(" → "),
      travelDate: value("flightDate"),
      evidence: selectedEvidenceLabels(),
      createdAt: now,
      updatedAt: now,
      fingerprint,
      html
    };
  }

  function saveCurrentDocument({ announce = false } = {}) {
    const snapshot = buildSnapshot();
    if (!snapshot) return null;

    const documents = getDocuments();
    const existingIndex = documents.findIndex((item) =>
      (snapshot.reference && item.reference === snapshot.reference) || item.fingerprint === snapshot.fingerprint
    );

    if (existingIndex >= 0) {
      snapshot.createdAt = documents[existingIndex].createdAt || snapshot.createdAt;
      documents.splice(existingIndex, 1);
    }

    documents.unshift(snapshot);
    persistDocuments(documents);
    renderLibrary();
    if (announce) toast("Document saved in your library.");
    return snapshot;
  }

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        reject(new Error("PDF library could not load."));
      };
      document.head.appendChild(script);
    });
  }

  async function ensurePdfLibrary() {
    if (typeof window.html2pdf === "function") return window.html2pdf;
    if (pdfLibraryPromise) return pdfLibraryPromise;

    pdfLibraryPromise = (async () => {
      let lastError;
      for (const url of HTML2PDF_URLS) {
        try {
          await loadScript(url);
          if (typeof window.html2pdf === "function") return window.html2pdf;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError || new Error("PDF library is unavailable.");
    })();

    try {
      return await pdfLibraryPromise;
    } catch (error) {
      pdfLibraryPromise = null;
      throw error;
    }
  }

  function createPdfStage(html) {
    const stage = document.createElement("div");
    stage.className = "pdf-download-stage";
    stage.innerHTML = html;
    document.body.appendChild(stage);

    const element = printableElement(stage);
    if (element) {
      element.style.margin = "0";
      element.style.boxShadow = "none";
      element.style.maxWidth = "210mm";
      element.style.width = "210mm";
      element.style.background = "#fff";
    }
    return { stage, element };
  }

  async function waitForImages(element) {
    if (!element) return;
    const images = [...element.querySelectorAll("img")];
    await Promise.all(images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      });
    }));
  }

  function pdfFilename(documentItem = {}) {
    const reference = documentItem.reference || currentReference();
    const flight = documentItem.flight || value("flightNumber").toUpperCase();
    const airline = documentItem.airline || value("airline");
    const date = documentItem.travelDate || value("flightDate") || new Date().toISOString().slice(0, 10);
    return `${cleanFilePart(reference || flight || "HolidayLawyer-claim")}-${cleanFilePart(airline, "airline")}-${cleanFilePart(date)}.pdf`;
  }

  async function downloadHtmlAsPdf(html, documentItem, button) {
    const originalText = button?.textContent;
    if (button) {
      button.disabled = true;
      button.textContent = "Creating PDF…";
    }

    let stage;
    try {
      await ensurePdfLibrary();
      const created = createPdfStage(html);
      stage = created.stage;
      if (!created.element) throw new Error("No document is available to download.");
      await waitForImages(created.element);

      await window.html2pdf()
        .set({
          margin: 0,
          filename: pdfFilename(documentItem),
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false,
            scrollX: 0,
            scrollY: 0
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
          pagebreak: { mode: ["css", "legacy"], avoid: [".formal-signature-block", ".formal-section"] }
        })
        .from(created.element)
        .save();

      toast("PDF downloaded and kept in your document library.");
    } catch (error) {
      console.error("PDF download failed", error);
      toast("The PDF could not be downloaded. Please check your internet connection and try again.");
    } finally {
      stage?.remove();
      if (button) {
        button.disabled = false;
        button.textContent = originalText || "Download PDF";
      }
    }
  }

  async function downloadCurrent(button) {
    const snapshot = saveCurrentDocument();
    const root = claimContainer();
    if (!snapshot || !root) {
      toast("Create or open a document first.");
      return;
    }
    await downloadHtmlAsPdf(root.innerHTML, snapshot, button);
  }

  function injectStyles() {
    if (document.getElementById("document-library-styles")) return;
    const style = document.createElement("style");
    style.id = "document-library-styles";
    style.textContent = `
      .pdf-download-stage{position:fixed;left:-100000px;top:0;width:210mm;min-height:297mm;background:#fff;z-index:-1;overflow:visible}
      .document-library-card{margin-top:16px}
      .document-library-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}
      .document-library-head h2{margin:3px 0 4px}
      .document-library-head p{margin:0;color:var(--muted,#718096);font-size:11px;line-height:1.5}
      .library-count{display:inline-flex;min-width:34px;height:28px;align-items:center;justify-content:center;border-radius:999px;background:var(--blue-soft,#edf4ff);color:var(--blue,#2869df);font-size:10px;font-weight:900}
      .document-library-list{display:grid;gap:10px}
      .library-empty{padding:20px;border:1px dashed #d8e2ef;border-radius:16px;text-align:center;color:var(--muted,#718096);font-size:11px;line-height:1.55;background:#fbfcfe}
      .library-document{padding:14px;border:1px solid #dfe7f1;border-radius:17px;background:#fff;box-shadow:0 8px 24px rgba(25,49,82,.05)}
      .library-document-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      .library-document-title{min-width:0}
      .library-document-title strong{display:block;overflow:hidden;color:var(--ink,#17233a);font-size:12px;text-overflow:ellipsis;white-space:nowrap}
      .library-document-title span{display:block;margin-top:4px;color:var(--muted,#718096);font-size:9px;line-height:1.4}
      .library-document-date{flex:0 0 auto;color:#63738b;font-size:9px;font-weight:700}
      .library-evidence{display:flex;flex-wrap:wrap;gap:5px;margin:10px 0 0}
      .library-evidence span{padding:4px 7px;border-radius:999px;background:#f2f6fb;color:#52647d;font-size:8px;font-weight:750}
      .library-document-actions{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin-top:12px}
      .library-document-actions button{min-height:38px;padding:0 12px;border:1px solid #dce5f0;border-radius:12px;background:#fff;color:var(--ink,#17233a);font-size:10px;font-weight:850;cursor:pointer}
      .library-document-actions button[data-library-action="download"]{border-color:var(--blue,#2869df);color:#fff;background:var(--blue,#2869df)}
      .library-document-actions button[data-library-action="delete"]{width:42px;padding:0;color:#a03832}
      .library-clear{margin-top:12px;width:100%;min-height:40px;border:0;background:transparent;color:#7b8798;font-size:9px;font-weight:800;cursor:pointer}
      @media(max-width:580px){.library-document-actions{grid-template-columns:1fr 1fr}.library-document-actions button[data-library-action="delete"]{grid-column:1/-1;width:100%}}
    `;
    document.head.appendChild(style);
  }

  function ensureLibraryCard() {
    let card = document.getElementById("documentLibraryCard");
    if (card) return card;

    const letterCard = document.getElementById("letterCard");
    const caseView = document.querySelector('[data-view="case"]');
    if (!caseView) return null;

    card = document.createElement("section");
    card.id = "documentLibraryCard";
    card.className = "card document-library-card";
    card.innerHTML = `
      <div class="document-library-head">
        <div><span class="quiet-label">History</span><h2>Document library</h2><p>Your generated claim documents stay on this device.</p></div>
        <span class="library-count" id="documentLibraryCount">0</span>
      </div>
      <div class="document-library-list" id="documentLibraryList"></div>
      <button class="library-clear hidden" id="clearDocumentLibrary" type="button">Clear document history</button>
    `;

    if (letterCard) letterCard.insertAdjacentElement("afterend", card);
    else caseView.appendChild(card);

    card.addEventListener("click", handleLibraryClick);
    return card;
  }

  function dateLabel(value) {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(value));
    } catch {
      return "Saved document";
    }
  }

  function renderLibrary() {
    const card = ensureLibraryCard();
    if (!card) return;
    const documents = getDocuments();
    const list = card.querySelector("#documentLibraryList");
    const count = card.querySelector("#documentLibraryCount");
    const clear = card.querySelector("#clearDocumentLibrary");
    count.textContent = String(documents.length);
    clear.classList.toggle("hidden", documents.length === 0);

    if (!documents.length) {
      list.innerHTML = '<div class="library-empty">Your first generated claim document will appear here automatically.</div>';
      return;
    }

    list.innerHTML = documents.map((item) => `
      <article class="library-document" data-library-id="${escapeHtml(item.id)}">
        <div class="library-document-top">
          <div class="library-document-title">
            <strong>${escapeHtml(item.title || "Formal claim document")}</strong>
            <span>${escapeHtml(item.reference || "No reference")} · ${escapeHtml(item.airline || "Airline not listed")}${item.route ? ` · ${escapeHtml(item.route)}` : ""}</span>
          </div>
          <span class="library-document-date">${escapeHtml(dateLabel(item.updatedAt || item.createdAt))}</span>
        </div>
        ${Array.isArray(item.evidence) && item.evidence.length ? `<div class="library-evidence">${item.evidence.slice(0, 5).map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</div>` : ""}
        <div class="library-document-actions">
          <button type="button" data-library-action="open">Open</button>
          <button type="button" data-library-action="download">Download PDF</button>
          <button type="button" data-library-action="delete" aria-label="Delete document">×</button>
        </div>
      </article>
    `).join("");
  }

  function openDocument(item) {
    const root = claimContainer();
    if (!root) return;
    root.innerHTML = item.html || "";
    document.getElementById("letterCard")?.classList.remove("hidden");
    try {
      if (typeof state !== "undefined" && item.reference) state.reference = item.reference;
    } catch {
      // The stored document remains available without state restoration.
    }
    try {
      if (typeof showView === "function") showView("case");
    } catch {
      document.querySelectorAll(".app-view").forEach((view) => view.classList.remove("active"));
      document.querySelector('[data-view="case"]')?.classList.add("active");
    }
    document.getElementById("letterCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
    toast("Document opened from your library.");
  }

  async function handleLibraryClick(event) {
    const clearButton = event.target.closest("#clearDocumentLibrary");
    if (clearButton) {
      if (window.confirm("Clear all saved document history on this device?")) {
        localStorage.removeItem(STORAGE_KEY);
        renderLibrary();
        toast("Document history cleared.");
      }
      return;
    }

    const actionButton = event.target.closest("[data-library-action]");
    const row = actionButton?.closest("[data-library-id]");
    if (!actionButton || !row) return;

    const documents = getDocuments();
    const item = documents.find((documentItem) => documentItem.id === row.dataset.libraryId);
    if (!item) return;

    const action = actionButton.dataset.libraryAction;
    if (action === "open") {
      openDocument(item);
    } else if (action === "download") {
      await downloadHtmlAsPdf(item.html, item, actionButton);
    } else if (action === "delete") {
      persistDocuments(documents.filter((documentItem) => documentItem.id !== item.id));
      renderLibrary();
      toast("Document removed from the library.");
    }
  }

  function bindDownloadButton() {
    const button = document.getElementById("printLetterButton");
    if (!button || button.dataset.directPdfReady === "yes") return;
    button.dataset.directPdfReady = "yes";
    button.textContent = "Download PDF";
    button.setAttribute("aria-label", "Download this document as a PDF");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      downloadCurrent(button);
    }, true);
  }

  function watchDocuments() {
    const root = claimContainer();
    if (!root) return;
    const observer = new MutationObserver(() => {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => saveCurrentDocument(), 450);
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    if (hasUsableDocument()) saveCurrentDocument();
  }

  function initialise() {
    injectStyles();
    ensureLibraryCard();
    renderLibrary();
    bindDownloadButton();
    watchDocuments();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  } else {
    initialise();
  }
})();