(() => {
  "use strict";

  const AIRPORT_DATA_URL = "https://cdn.jsdelivr.net/gh/jpatokal/openflights@master/data/airports.dat";
  const AIRLINE_DATA_URL = "https://cdn.jsdelivr.net/gh/jpatokal/openflights@master/data/airlines.dat";
  const MAX_RESULTS = 16;

  const POPULAR_AIRPORT_CODES = new Set([
    "ZRH", "GVA", "BSL", "LHR", "LGW", "CDG", "ORY", "FRA", "MUC", "AMS",
    "BRU", "VIE", "MAD", "BCN", "FCO", "MXP", "JFK", "EWR", "LAX", "SFO",
    "DXB", "DOH", "SIN", "HKG", "NRT", "HND", "CMB", "ZAG", "ZCL", "ZAM"
  ]);

  const POPULAR_AIRLINE_CODES = new Set([
    "LX", "EK", "LH", "BA", "U2", "FR", "QR", "TK", "AF", "KL", "OS", "SN",
    "SQ", "CX", "EY", "AA", "DL", "UA", "AC", "IB", "AZ", "SK", "TP", "UL"
  ]);

  const COVERED_COUNTRIES = new Set([
    "austria", "belgium", "bulgaria", "croatia", "cyprus", "czech republic", "czechia",
    "denmark", "estonia", "finland", "france", "germany", "greece", "hungary", "ireland",
    "italy", "latvia", "lithuania", "luxembourg", "malta", "netherlands", "poland",
    "portugal", "romania", "slovakia", "slovenia", "spain", "sweden", "iceland",
    "liechtenstein", "norway", "switzerland"
  ]);

  const FALLBACK_AIRPORTS = [
    ["ZRH", "LSZH", "Zurich Airport", "Zürich", "Switzerland"],
    ["GVA", "LSGG", "Geneva Airport", "Geneva", "Switzerland"],
    ["BSL", "LFSB", "EuroAirport Basel Mulhouse Freiburg", "Basel", "Switzerland"],
    ["LHR", "EGLL", "Heathrow Airport", "London", "United Kingdom"],
    ["LGW", "EGKK", "Gatwick Airport", "London", "United Kingdom"],
    ["FRA", "EDDF", "Frankfurt Airport", "Frankfurt", "Germany"],
    ["CDG", "LFPG", "Charles de Gaulle Airport", "Paris", "France"],
    ["DXB", "OMDB", "Dubai International Airport", "Dubai", "United Arab Emirates"],
    ["ZAG", "LDZA", "Franjo Tuđman Airport", "Zagreb", "Croatia"],
    ["ZCL", "MMZC", "General Leobardo C. Ruiz International Airport", "Zacatecas", "Mexico"],
    ["ZAM", "RPMZ", "Zamboanga International Airport", "Zamboanga", "Philippines"]
  ].map(([iata, icao, name, city, country]) => makeAirport({ iata, icao, name, city, country }));

  const FALLBACK_AIRLINES = [
    ["Swiss International Air Lines", "SWISS", "LX", "SWR", "SWISS", "Switzerland"],
    ["Emirates", "", "EK", "UAE", "EMIRATES", "United Arab Emirates"],
    ["Lufthansa", "", "LH", "DLH", "LUFTHANSA", "Germany"],
    ["British Airways", "", "BA", "BAW", "SPEEDBIRD", "United Kingdom"],
    ["easyJet", "", "U2", "EZY", "EASY", "United Kingdom"],
    ["Ryanair", "", "FR", "RYR", "RYANAIR", "Ireland"],
    ["Qatar Airways", "", "QR", "QTR", "QATARI", "Qatar"],
    ["Turkish Airlines", "", "TK", "THY", "TURKISH", "Turkey"],
    ["Air France", "", "AF", "AFR", "AIRFRANS", "France"],
    ["KLM Royal Dutch Airlines", "KLM", "KL", "KLM", "KLM", "Netherlands"],
    ["Austrian Airlines", "", "OS", "AUA", "AUSTRIAN", "Austria"],
    ["SriLankan Airlines", "", "UL", "ALK", "SRILANKAN", "Sri Lanka"]
  ].map(([name, alias, iata, icao, callsign, country]) => makeAirline({ name, alias, iata, icao, callsign, country }));

  let airportsPromise;
  let airlinesPromise;

  function normalise(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function parseCsvLine(line) {
    const fields = [];
    let value = "";
    let quoted = false;

    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"') {
        if (quoted && line[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === "," && !quoted) {
        fields.push(value);
        value = "";
      } else {
        value += character;
      }
    }

    fields.push(value);
    return fields;
  }

  function makeAirport({ iata, icao, name, city, country }) {
    const airport = {
      iata: iata && iata !== "\\N" ? iata : "",
      icao: icao && icao !== "\\N" ? icao : "",
      name: name || "Airport",
      city: city && city !== "\\N" ? city : "",
      country: country || ""
    };

    airport.code = airport.iata || airport.icao;
    airport.search = normalise([airport.iata, airport.icao, airport.name, airport.city, airport.country].join(" "));
    airport.citySearch = normalise(airport.city);
    airport.nameSearch = normalise(airport.name);
    airport.countrySearch = normalise(airport.country);
    return airport;
  }

  function makeAirline({ name, alias, iata, icao, callsign, country }) {
    const airline = {
      name: name || "Airline",
      alias: alias && alias !== "\\N" ? alias : "",
      iata: iata && iata !== "\\N" ? iata : "",
      icao: icao && icao !== "\\N" ? icao : "",
      callsign: callsign && callsign !== "\\N" ? callsign : "",
      country: country || ""
    };

    airline.code = airline.iata || airline.icao;
    airline.search = normalise([
      airline.name,
      airline.alias,
      airline.iata,
      airline.icao,
      airline.callsign,
      airline.country
    ].join(" "));
    airline.nameSearch = normalise(airline.name);
    airline.aliasSearch = normalise(airline.alias);
    airline.callsignSearch = normalise(airline.callsign);
    airline.countrySearch = normalise(airline.country);
    return airline;
  }

  function parseAirportData(text) {
    const seen = new Set();
    const parsed = [];

    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const fields = parseCsvLine(line);
      if (fields.length < 6) continue;

      const airport = makeAirport({
        name: fields[1],
        city: fields[2],
        country: fields[3],
        iata: fields[4],
        icao: fields[5]
      });

      if (!airport.code || !airport.name) continue;
      const key = `${airport.code}|${airport.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      parsed.push(airport);
    }

    return parsed.length ? parsed : FALLBACK_AIRPORTS;
  }

  function parseAirlineData(text) {
    const seen = new Set();
    const parsed = [];

    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const fields = parseCsvLine(line);
      if (fields.length < 8 || fields[7] === "N") continue;

      const airline = makeAirline({
        name: fields[1],
        alias: fields[2],
        iata: fields[3],
        icao: fields[4],
        callsign: fields[5],
        country: fields[6]
      });

      if (!airline.name || airline.name === "\\N") continue;
      const key = `${normalise(airline.name)}|${normalise(airline.country)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      parsed.push(airline);
    }

    return parsed.length ? parsed : FALLBACK_AIRLINES;
  }

  async function loadAirports() {
    if (!airportsPromise) {
      airportsPromise = fetch(AIRPORT_DATA_URL, { cache: "force-cache" })
        .then((response) => {
          if (!response.ok) throw new Error(`Airport data returned ${response.status}`);
          return response.text();
        })
        .then(parseAirportData)
        .catch(() => FALLBACK_AIRPORTS);
    }
    return airportsPromise;
  }

  async function loadAirlines() {
    if (!airlinesPromise) {
      airlinesPromise = fetch(AIRLINE_DATA_URL, { cache: "force-cache" })
        .then((response) => {
          if (!response.ok) throw new Error(`Airline data returned ${response.status}`);
          return response.text();
        })
        .then(parseAirlineData)
        .catch(() => FALLBACK_AIRLINES);
    }
    return airlinesPromise;
  }

  function scoreAirport(airport, query, tokens) {
    if (!query) return POPULAR_AIRPORT_CODES.has(airport.iata) ? 0 : 100;
    if (!tokens.every((token) => airport.search.includes(token))) return Number.POSITIVE_INFINITY;

    const iata = normalise(airport.iata);
    const icao = normalise(airport.icao);
    let score = 50;

    if (iata === query) score = 0;
    else if (icao === query) score = 1;
    else if (airport.citySearch === query) score = 2;
    else if (airport.citySearch.startsWith(query)) score = 4;
    else if (airport.nameSearch.startsWith(query)) score = 6;
    else if (iata.startsWith(query)) score = 7;
    else if (icao.startsWith(query)) score = 8;
    else if (airport.countrySearch.startsWith(query)) score = 12;
    else if (airport.citySearch.includes(query)) score = 16;
    else if (airport.nameSearch.includes(query)) score = 20;
    else score = 28;

    if (POPULAR_AIRPORT_CODES.has(airport.iata)) score -= query.length === 1 ? 3 : 1;
    return score;
  }

  function scoreAirline(airline, query, tokens) {
    if (!query) return POPULAR_AIRLINE_CODES.has(airline.iata) ? 0 : 100;
    if (!tokens.every((token) => airline.search.includes(token))) return Number.POSITIVE_INFINITY;

    const iata = normalise(airline.iata);
    const icao = normalise(airline.icao);
    let score = 50;

    if (iata === query) score = 0;
    else if (icao === query) score = 1;
    else if (airline.nameSearch === query) score = 2;
    else if (airline.nameSearch.startsWith(query)) score = 4;
    else if (airline.aliasSearch.startsWith(query)) score = 5;
    else if (airline.callsignSearch.startsWith(query)) score = 6;
    else if (iata.startsWith(query)) score = 7;
    else if (icao.startsWith(query)) score = 8;
    else if (airline.countrySearch.startsWith(query)) score = 12;
    else if (airline.nameSearch.includes(query)) score = 18;
    else score = 28;

    if (POPULAR_AIRLINE_CODES.has(airline.iata)) score -= query.length === 1 ? 3 : 1;
    return score;
  }

  function findAirports(airports, rawQuery) {
    const query = normalise(rawQuery);
    const tokens = query.split(/\s+/).filter(Boolean);

    return airports
      .map((airport) => ({ item: airport, score: scoreAirport(airport, query, tokens) }))
      .filter((entry) => Number.isFinite(entry.score) && entry.score < 100)
      .sort((left, right) => {
        if (left.score !== right.score) return left.score - right.score;
        return (left.item.city || left.item.name).localeCompare(right.item.city || right.item.name, undefined, { sensitivity: "base" });
      })
      .slice(0, MAX_RESULTS)
      .map((entry) => entry.item);
  }

  function findAirlines(airlines, rawQuery) {
    const query = normalise(rawQuery);
    const tokens = query.split(/\s+/).filter(Boolean);

    return airlines
      .map((airline) => ({ item: airline, score: scoreAirline(airline, query, tokens) }))
      .filter((entry) => Number.isFinite(entry.score) && entry.score < 100)
      .sort((left, right) => {
        if (left.score !== right.score) return left.score - right.score;
        return left.item.name.localeCompare(right.item.name, undefined, { sensitivity: "base" });
      })
      .slice(0, MAX_RESULTS)
      .map((entry) => entry.item);
  }

  function setCoverageValue(name, value) {
    const element = document.getElementById("caseForm")?.elements[name];
    if (!element) return;
    element.value = value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function countryCoverage(country) {
    return country ? (COVERED_COUNTRIES.has(normalise(country)) ? "covered" : "outside") : "";
  }

  function syncCoverage() {
    const departure = document.querySelector('input[name="departureAirport"]');
    const arrival = document.querySelector('input[name="arrivalAirport"]');
    const airline = document.querySelector('input[name="airline"]');

    setCoverageValue("departureArea", countryCoverage(departure?.dataset.airportCountry));
    setCoverageValue("arrivalArea", countryCoverage(arrival?.dataset.airportCountry));

    const airlineCountry = airline?.dataset.airlineCountry || "";
    setCoverageValue("carrierArea", airlineCountry ? countryCoverage(airlineCountry) : "unknown");
  }

  function injectSmartStyles() {
    if (document.getElementById("smart-travel-field-styles")) return;
    const style = document.createElement("style");
    style.id = "smart-travel-field-styles";
    style.textContent = `
      .smart-hidden-grid{display:none!important}
      .smart-airline-field{grid-column:1/-1}
      .travel-autocomplete input.smart-selected{border-color:#88ace8!important;background:#f7faff!important;box-shadow:0 0 0 4px rgba(40,105,223,.06)}
      .airline-autocomplete .airport-search-icon{font-size:16px}
      @media(max-width:580px){.smart-airline-field{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function prepareForm() {
    const form = document.getElementById("caseForm");
    const incidentStep = form?.querySelector('.form-step[data-step="2"] fieldset');
    const detailsStep = form?.querySelector('.form-step[data-step="3"] fieldset');
    const detailsGrid = detailsStep?.querySelector(".field-grid");
    const oldCoverageGrid = incidentStep?.querySelector(".field-grid");

    if (!form || !incidentStep || !detailsStep || !detailsGrid || !oldCoverageGrid || incidentStep.dataset.smartTravelFields === "ready") return;
    incidentStep.dataset.smartTravelFields = "ready";

    ["departureArea", "arrivalArea", "carrierArea"].forEach((name) => {
      const select = form.elements[name];
      if (!select) return;
      select.required = false;
      select.closest("label")?.classList.add("smart-hidden-field");
    });
    oldCoverageGrid.classList.add("smart-hidden-grid");

    const departureInput = form.elements.departureAirport;
    const arrivalInput = form.elements.arrivalAirport;
    const airlineInput = form.elements.airline;
    const departureLabel = departureInput?.closest("label");
    const arrivalLabel = arrivalInput?.closest("label");
    const airlineLabel = airlineInput?.closest("label");

    if (!departureLabel || !arrivalLabel || !airlineLabel) return;

    departureLabel.querySelector("span").textContent = "From airport or city";
    arrivalLabel.querySelector("span").textContent = "To airport or city";
    airlineLabel.querySelector("span").textContent = "Operating airline";

    departureInput.placeholder = "Airport or city";
    arrivalInput.placeholder = "Airport or city";
    airlineInput.placeholder = "Airline name";

    airlineLabel.classList.add("smart-airline-field");

    const routeGrid = document.createElement("div");
    routeGrid.className = "field-grid smart-route-grid";
    routeGrid.append(departureLabel, arrivalLabel, airlineLabel);
    incidentStep.insertBefore(routeGrid, oldCoverageGrid);

    const legend = detailsStep.querySelector("legend");
    if (legend) legend.textContent = "Passenger and booking details";
  }

  function attachAutocomplete({
    input,
    index,
    kind,
    icon,
    loadItems,
    findItems,
    selectedValue,
    applySelection,
    clearSelection,
    optionMarkup,
    loadingText,
    emptyText
  }) {
    const label = input?.closest("label");
    if (!input || !label || input.dataset.smartAutocomplete === "ready") return;

    input.dataset.smartAutocomplete = "ready";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");

    const wrapper = document.createElement("div");
    wrapper.className = `airport-autocomplete travel-autocomplete ${kind}-autocomplete`;
    label.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const searchIcon = document.createElement("span");
    searchIcon.className = "airport-search-icon";
    searchIcon.setAttribute("aria-hidden", "true");
    searchIcon.textContent = icon;
    wrapper.appendChild(searchIcon);

    const list = document.createElement("div");
    list.id = `${kind}-options-${index}`;
    list.className = "airport-options hidden";
    list.setAttribute("role", "listbox");
    wrapper.appendChild(list);
    input.setAttribute("aria-controls", list.id);

    let currentResults = [];
    let activeIndex = -1;
    let requestNumber = 0;
    let choosing = false;

    function close() {
      list.classList.add("hidden");
      list.innerHTML = "";
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      activeIndex = -1;
    }

    function setActive(nextIndex) {
      const options = [...list.querySelectorAll(".airport-option")];
      if (!options.length) return;
      activeIndex = Math.max(0, Math.min(nextIndex, options.length - 1));
      options.forEach((option, optionIndex) => {
        const active = optionIndex === activeIndex;
        option.classList.toggle("active", active);
        option.setAttribute("aria-selected", String(active));
      });
      const active = options[activeIndex];
      input.setAttribute("aria-activedescendant", active.id);
      active.scrollIntoView({ block: "nearest" });
    }

    function choose(item) {
      choosing = true;
      input.value = selectedValue(item);
      clearSelection(input);
      applySelection(input, item);
      input.dataset.selectionValue = input.value;
      input.classList.add("smart-selected");
      input.setCustomValidity("");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      choosing = false;
      close();
      syncCoverage();
    }

    function render(results) {
      currentResults = results;
      activeIndex = -1;
      input.setAttribute("aria-expanded", "true");
      list.classList.remove("hidden");

      if (!results.length) {
        list.innerHTML = `<div class="airport-empty">${escapeHtml(emptyText)}</div>`;
        return;
      }

      list.innerHTML = results.map((item, optionIndex) => `
        <button class="airport-option" id="${list.id}-option-${optionIndex}" type="button" role="option" aria-selected="false" data-smart-index="${optionIndex}">
          ${optionMarkup(item)}
        </button>
      `).join("");
    }

    async function search(showPopular = document.activeElement === input) {
      if (choosing) return;

      const query = input.value.trim();
      const thisRequest = ++requestNumber;
      clearSelection(input);
      input.classList.remove("smart-selected");
      syncCoverage();

      if (!query && !showPopular) {
        close();
        return;
      }

      list.classList.remove("hidden");
      list.innerHTML = `<div class="airport-loading"><span></span> ${escapeHtml(loadingText)}</div>`;
      input.setAttribute("aria-expanded", "true");

      const items = await loadItems();
      if (thisRequest !== requestNumber) return;
      render(findItems(items, query));
    }

    input.addEventListener("input", () => search(false));
    input.addEventListener("focus", () => search(true));

    input.addEventListener("keydown", (event) => {
      if (list.classList.contains("hidden")) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive(activeIndex + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive(activeIndex <= 0 ? currentResults.length - 1 : activeIndex - 1);
      } else if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault();
        choose(currentResults[activeIndex]);
      } else if (event.key === "Escape") {
        close();
      }
    });

    list.addEventListener("mousedown", (event) => event.preventDefault());
    list.addEventListener("click", (event) => {
      const option = event.target.closest("[data-smart-index]");
      if (!option) return;
      const item = currentResults[Number(option.dataset.smartIndex)];
      if (item) choose(item);
    });

    document.addEventListener("click", (event) => {
      if (!wrapper.contains(event.target)) close();
    });
  }

  function initialise() {
    injectSmartStyles();
    prepareForm();

    const departureInput = document.querySelector('input[name="departureAirport"]');
    const arrivalInput = document.querySelector('input[name="arrivalAirport"]');
    const airlineInput = document.querySelector('input[name="airline"]');

    const clearAirport = (input) => {
      delete input.dataset.iata;
      delete input.dataset.icao;
      delete input.dataset.airportName;
      delete input.dataset.airportCity;
      delete input.dataset.airportCountry;
      delete input.dataset.selectionValue;
    };

    const applyAirport = (input, airport) => {
      input.dataset.iata = airport.iata;
      input.dataset.icao = airport.icao;
      input.dataset.airportName = airport.name;
      input.dataset.airportCity = airport.city;
      input.dataset.airportCountry = airport.country;
    };

    [departureInput, arrivalInput].filter(Boolean).forEach((input, index) => {
      attachAutocomplete({
        input,
        index,
        kind: "airport",
        icon: "⌕",
        loadItems: loadAirports,
        findItems: findAirports,
        selectedValue: (airport) => `${airport.city || airport.name} (${airport.code}) — ${airport.name}`,
        applySelection: applyAirport,
        clearSelection: clearAirport,
        loadingText: "Loading airports…",
        emptyText: "No matching airport found.",
        optionMarkup: (airport) => {
          const code = airport.iata || airport.icao;
          const secondaryCode = airport.iata && airport.icao ? airport.icao : "";
          return `
            <span class="airport-option-main">
              <strong>${escapeHtml(airport.city || airport.name)}</strong>
              <span class="airport-code">${escapeHtml(code)}</span>
            </span>
            <small>${escapeHtml(airport.name)} · ${escapeHtml(airport.country)}${secondaryCode ? ` · ${escapeHtml(secondaryCode)}` : ""}</small>
          `;
        }
      });
    });

    if (airlineInput) {
      attachAutocomplete({
        input: airlineInput,
        index: 0,
        kind: "airline",
        icon: "✈",
        loadItems: loadAirlines,
        findItems: findAirlines,
        selectedValue: (airline) => `${airline.name}${airline.code ? ` (${airline.code})` : ""}`,
        clearSelection: (input) => {
          delete input.dataset.airlineName;
          delete input.dataset.airlineCountry;
          delete input.dataset.airlineIata;
          delete input.dataset.airlineIcao;
          delete input.dataset.selectionValue;
        },
        applySelection: (input, airline) => {
          input.dataset.airlineName = airline.name;
          input.dataset.airlineCountry = airline.country;
          input.dataset.airlineIata = airline.iata;
          input.dataset.airlineIcao = airline.icao;
        },
        loadingText: "Loading airlines…",
        emptyText: "No matching airline found.",
        optionMarkup: (airline) => `
          <span class="airport-option-main">
            <strong>${escapeHtml(airline.name)}</strong>
            ${airline.code ? `<span class="airport-code">${escapeHtml(airline.code)}</span>` : ""}
          </span>
          <small>${escapeHtml(airline.country || "Country not listed")}${airline.callsign ? ` · ${escapeHtml(airline.callsign)}` : ""}</small>
        `
      });
    }

    loadAirports();
    loadAirlines();
    syncCoverage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  } else {
    initialise();
  }
})();