# HolidayLawyer.ai — Advanced Version 4

A static, GitHub Pages-compatible portfolio prototype for a focused travel-claims product.

## Product decision

The website focuses first on two useful, structured workflows:

- Flight disruption claims
- Lost, delayed or damaged baggage claims

Hotel, package-holiday, insurance and car-rental workflows remain on the roadmap rather than pretending that one generic form can solve every travel dispute.

## Working features

- Five-step adaptive case wizard
- Simplified route-coverage test
- Flight compensation estimate
- Baggage evidence path
- Case readiness score
- Missing-evidence checklist
- Professional claim document generator
- Fixed Elara AI Claims Assistant identity
- Claimant-controlled signature and approval
- Print / Save as PDF
- Copy document
- Save case in browser local storage
- Restore and clear saved case
- Export case as JSON
- Airline-response analyser using transparent local rules
- Privacy and terms prototype pages
- Official Swiss and EU reference links
- Responsive mobile and desktop design

## Run locally

Open `index.html` in a modern browser.

No installation, API key or server is required.

## Deploy to GitHub Pages

Place these files directly in the root of the repository:

```text
index.html
styles.css
app.js
privacy.html
terms.html
README.md
```

Commit and push. GitHub Pages should publish the new version automatically.

## Important product positioning

Elara is:

- an AI Claims Assistant
- a drafting and explanation interface
- permanently identified as software

Elara is not:

- a human lawyer
- a licensed attorney
- a court representative
- an official signature
- a guarantee of compensation

The claimant remains the sender and approves the final document.

## Why the current version does not use AI yet

The deterministic workflow should be tested before a generative model is connected. The later AI layer should improve explanations and writing without controlling:

- route coverage
- compensation amounts
- evidence truth
- legal deadlines
- final sending

## Recommended next version

1. Add a secure backend.
2. Store the API key only as a backend environment secret.
3. Add AI explanations and response analysis.
4. Keep compensation and coverage in tested rule code.
5. Add airport lookup and route-distance calculation.
6. Add German and English language support.
7. Add secure file upload and document extraction.
8. Add a real database and authenticated case dashboard.
9. Obtain qualified legal and privacy review before commercial launch.
