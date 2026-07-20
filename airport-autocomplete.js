(() => {
  "use strict";

  const AIRPORT_DATA_URL = "https://cdn.jsdelivr.net/gh/jpatokal/openflights@master/data/airports.dat";
  const MAX_RESULTS = 18;
  const POPULAR_CODES = new Set([
    "ZRH", "ZAG", "ZCL", "ZAM", "LHR", "LGW", "CDG", "ORY", "FRA", "MUC",
    "AMS", "BRU", "GVA", "BSL", "VIE", "MAD", "BCN", "FCO", "MXP", "JFK",
    "EWR", "LAX", "SFO", "DXB", "DOH", "SIN", "HKG", "NRT", "HND", "CMB"
  ]);

  const FALLBACK_AIRPORTS = [
    ["ZRH", "LSZH", "Zurich Airport", "Zürich", "Switzerland"],
    ["ZAG", "LDZA", "Franjo Tuđman Airport", "Zagreb", "Croatia"],
    ["ZCL", "MMZC", "General Leobardo C. Ruiz International Airport", "Zacatecas", "Mexico"],
    ["ZAM", "RPMZ", "Zamboanga International Airport", "Zamboanga", "Philippines"],
    ["LHR", "EGLL", "Heathrow Airport", "London", "United Kingdom"],
    ["LGW", "EGKK", "Gatwick Airport", "London", "United Kingdom"],
    ["GVA", "LSGG", "Geneva Airport", "Geneva", "Switzerland"],
    ["BSL", "LFSB", "EuroAirport Basel Mulhouse Freiburg", "Basel", "Switzerland"],
    ["FRA", "EDDF", "Frankfurt Airport", "Frankfurt", "Germany"],
    ["CDG", "LFPG", "Charles de Gaulle Airport", "Paris", "France"]
  ].map(([iata, icao, name, city, country]) => makeAirport({ iata, icao, name, city, country }));

  let airportsPromise;

  function normalise(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
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
    airport.search = normalise([
      airport.iata,
      airport.icao,
      airport.name,
      airport.city,
      airport.country
    ].join(" "));
    airport.citySearch = normalise(airport.city);
    airport.nameSearch = normalise(airport.name);
    airport.countrySearch = normalise(airport.country);
    return airport;
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

  function scoreAirport(airport, query, tokens) {
    if (!tokens.every((token) => airport.search.includes(token))) return Number.POSITIVE_INFINITY;

    const iata = normalise(airport.iata);
    const icao = normalise(airport.icao);
    let score = 50;

    if (iata === query) score = 0;
    else if (icao === query) score = 1;
    else if (airport.citySearch === query) score = 2;
    else if (airport.citySearch.startsWith(query)) score = 5;
    else if (airport.nameSearch.startsWith(query)) score = 7;
    else if (iata.startsWith(query)) score = 8;
    else if (icao.startsWith(query)) score = 9;
    else if (airport.countrySearch.startsWith(query)) score = 12;
    else if (airport.citySearch.includes(query)) score = 16;
    else if (airport.nameSearch.includes(query)) score = 20;
    else score = 28;

    if (POPULAR_CODES.has(airport.iata)) score -= query.length === 1 ? 3 : 1;
    return score;
  }

  function findAirports(airports, rawQuery) {
    const query = normalise(rawQuery);
    if (!query) return [];
    const tokens = query.split(/\s+/).filter(Boolean);

    return airports
      .map((airport) => ({ airport, score: scoreAirport(airport, query, tokens) }))
      .filter((entry) => Number.isFinite(entry.score))
      .sort((left, right) => {
        if (left.score !== right.score) return left.score - right.score;
        return (left.airport.city || left.airport.name).localeCompare(
          right.airport.city || right.airport.name,
          undefined,
          { sensitivity: "base" }
        );
      })
      .slice(0, MAX_RESULTS)
      .map((entry) => entry.airport);
  }

  function selectedValue(airport) {
    const place = airport.city || airport.name;
    return `${place} (${airport.code}) — ${airport.name}`;
  }

  function attachAutocomplete(input, index) {
    const label = input.closest("label");
    if (!label || input.dataset.airportAutocomplete === "ready") return;

    input.dataset.airportAutocomplete = "ready";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");

    const wrapper = document.createElement("div");
    wrapper.className = "airport-autocomplete";
    label.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const icon = document.createElement("span");
    icon.className = "airport-search-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "⌕";
    wrapper.appendChild(icon);

    const list = document.createElement("div");
    list.id = `airport-options-${index}`;
    list.className = "airport-options hidden";
    list.setAttribute("role", "listbox");
    wrapper.appendChild(list);
    input.setAttribute("aria-controls", list.id);

    let activeIndex = -1;
    let currentResults = [];
    let requestNumber = 0;

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

    function choose(airport) {
      input.value = selectedValue(airport);
      input.dataset.iata = airport.iata;
      input.dataset.icao = airport.icao;
      input.dataset.airportName = airport.name;
      input.dataset.airportCity = airport.city;
      input.dataset.airportCountry = airport.country;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      close();
    }

    function render(results) {
      currentResults = results;
      activeIndex = -1;
      input.setAttribute("aria-expanded", "true");
      list.classList.remove("hidden");

      if (!results.length) {
        list.innerHTML = '<div class="airport-empty">No matching airport found. Try a city, airport name, IATA or ICAO code.</div>';
        return;
      }

      list.innerHTML = results.map((airport, optionIndex) => {
        const code = airport.iata || airport.icao;
        const secondaryCode = airport.iata && airport.icao ? airport.icao : "";
        return `
          <button class="airport-option" id="${list.id}-option-${optionIndex}" type="button" role="option" aria-selected="false" data-airport-index="${optionIndex}">
            <span class="airport-option-main">
              <strong>${escapeHtml(airport.city || airport.name)}</strong>
              <span class="airport-code">${escapeHtml(code)}</span>
            </span>
            <small>${escapeHtml(airport.name)} · ${escapeHtml(airport.country)}${secondaryCode ? ` · ${escapeHtml(secondaryCode)}` : ""}</small>
          </button>
        `;
      }).join("");
    }

    async function search() {
      const query = input.value.trim();
      const thisRequest = ++requestNumber;
      delete input.dataset.iata;
      delete input.dataset.icao;

      if (!query) {
        close();
        return;
      }

      list.classList.remove("hidden");
      list.innerHTML = '<div class="airport-loading"><span></span> Loading worldwide airports…</div>';
      input.setAttribute("aria-expanded", "true");

      const airports = await loadAirports();
      if (thisRequest !== requestNumber) return;
      render(findAirports(airports, query));
    }

    input.addEventListener("input", search);
    input.addEventListener("focus", () => {
      if (input.value.trim()) search();
    });

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
      const option = event.target.closest("[data-airport-index]");
      if (!option) return;
      const airport = currentResults[Number(option.dataset.airportIndex)];
      if (airport) choose(airport);
    });

    document.addEventListener("click", (event) => {
      if (!wrapper.contains(event.target)) close();
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function initialise() {
    const inputs = [
      document.querySelector('input[name="departureAirport"]'),
      document.querySelector('input[name="arrivalAirport"]')
    ].filter(Boolean);

    inputs.forEach((input, index) => attachAutocomplete(input, index));
    loadAirports();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  } else {
    initialise();
  }
})();
