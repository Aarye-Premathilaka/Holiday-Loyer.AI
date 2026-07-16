# FlightClaim AI

A polished, responsive portfolio MVP that checks possible flight-delay compensation and generates a structured airline claim letter.

## What the project demonstrates

- Professional responsive UI design
- Accessible multi-step forms
- Rule-based eligibility analysis
- Dynamic document generation
- Browser print-to-PDF workflow
- Privacy-first client-side processing
- Responsible-AI wording and legal safeguards

## Run it

No installation is required.

1. Extract the ZIP file.
2. Open `index.html` in a modern browser.

For a cleaner local-development URL, run one of these commands inside the folder:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Important legal/product positioning

Use terms such as:

- AI-assisted claim platform
- Passenger-rights assistant
- Claim letter generator
- Initial eligibility assessment

Do not present the service as:

- an official AI lawyer
- a court-approved document issuer
- a government authority
- a guarantee that compensation will be paid

The current MVP intentionally says **“may qualify.”**

## Current MVP limitations

- It uses a simplified deterministic rule engine.
- It does not verify live flight data.
- It does not identify the real operating carrier automatically.
- It does not submit claims to airlines.
- It does not store user accounts or evidence.
- It does not replace a qualified lawyer.

## Strong next development steps

1. Add a backend so API keys never appear in browser code.
2. Connect a flight-status provider to verify actual arrival times.
3. Add airport lookup and automatic distance calculation.
4. Add secure evidence upload for tickets, boarding passes and airline messages.
5. Generate DOCX/PDF claim packages on the server.
6. Add multilingual English/German support.
7. Add a claim timeline and airline-response tracker.
8. Add a safe LLM explanation layer with source citations and strict templates.
9. Add tests for route, delay, distance and extraordinary-circumstance combinations.
10. Deploy the frontend to Cloudflare Pages, Vercel or GitHub Pages.

## Suggested architecture for a full-stack portfolio version

```text
Frontend: React or Next.js + TypeScript
Backend: Spring Boot or Node.js
Database: PostgreSQL
Document storage: S3-compatible object storage
AI: server-side LLM API with structured JSON output
Authentication: secure email login or OAuth
Flight data: licensed flight-status API
PDF generation: server-side HTML-to-PDF
```

A Spring Boot backend would be especially valuable for an apprenticeship application because it demonstrates APIs, validation, testing, security and structured business logic.
