# E&O / Professional Indemnity Insurance — RFQ Brief

**Purpose:** Request quotes from Sri Lankan general insurance brokers for a Professional Indemnity / Errors & Omissions policy covering the reports and AVM output produced by the platform. Required in force **before Phase 5a launch** (first paid legal-firm report).

**Why now:** Asking-price-based valuation output will be relied on by conveyancing lawyers and, later, diaspora buyers. Even with disclaimers, mis-estimate claims are a foreseeable liability. A PI policy is the standard mitigation and is table-stakes for bank procurement later.

**Suggested brokers to approach (get ≥3 quotes):**
- Senaratne Insurance Brokers
- Protection & Indemnity Brokers
- NITF (reinsurance side, via a direct insurer)
- Direct insurers: Ceylinco General, AIA General, Allianz Lanka, SLIC General
- International broker with SL desk: Aon, Marsh (if the policy needs to respond to overseas-based diaspora claimants)

---

## Business description (for the RFQ)

> [Legal entity name], trading as [trading name], operates a web platform that
> aggregates publicly listed residential property data in Sri Lanka and
> produces three categories of deliverable:
>
> 1. **Due-diligence reports** — PDF reports covering a single listed property,
>    supplied to conveyancing law firms and overseas retail buyers. Each report
>    contains an estimated market-value range based on asking-price comparables
>    and a gradient-boosting model, a listing history summary, comparable
>    listings, and public risk overlays (flood, distance-to-amenity).
>    Each report carries an explicit disclaimer that it is not a formal
>    valuation for mortgage, legal, tax, or official purposes.
>
> 2. **API output** (future — Phase 7+) — programmatic access to the same
>    AVM estimate for use by licensed financial institutions, starting with
>    mortgage pre-screening only.
>
> 3. **Dashboard analytics** (consumer-facing) — neighbourhood median prices,
>    rental-yield indicators, mortgage affordability calculators. No
>    individual-property valuation binding opinions delivered through the
>    consumer dashboard.
>
> The company does NOT hold itself out as a chartered valuer. It does NOT
> issue opinions of value for secured-lending, tax, probate, compulsory
> acquisition, or litigation purposes. All output is branded as
> "market-intelligence" rather than "valuation", consistent with the
> Institute of Valuers of Sri Lanka's scope of practice for licensed valuers.

---

## Risk posture (disclose upfront)

| Control | Status |
|---|---|
| Written disclaimer on every report | In force from day 1 |
| Methodology appendix in every report | In force from day 1 |
| PDPA compliance — no seller PII stored | Audited; see `docs/phase0/pdpa_audit.md` |
| Data sources | Publicly listed asking prices only; no stamp duty / transfer deed data |
| Terms of Service with liability cap | To be in force before first sale |
| Chartered valuer advisory board | To be named before Phase 5a launch |
| Model calibration to actual transactions | Planned Phase 6 once ≥1,500-sample dataset available |
| Published MdAPE metric | Planned Phase 3 holdout test |

---

## Coverage requested

1. **Professional Indemnity / Errors & Omissions**
   - Territory: Sri Lanka + worldwide for reports delivered to overseas
     diaspora clients.
   - Jurisdiction: Sri Lanka + overseas courts where a diaspora claim might
     be brought (UK, Australia, Canada, US, UAE).
   - Retroactive date: inception date acceptable.
   - Limit of indemnity (primary): **USD 250,000** each and every claim /
     aggregate. Also quote USD 500,000 and USD 1,000,000 step-ups.
   - Deductible: quote at USD 1,000 and USD 2,500 options.
   - Defence costs: in addition to or inclusive of the limit — please state.

2. **Cyber liability (add-on or standalone)**
   - Breach response, notification, and first-party data-restoration costs
     for a database containing publicly sourced listing records and customer
     email addresses / payment references (Stripe-held card data, NOT stored
     on our infrastructure).
   - Limit: USD 100,000 adequate for Phase 0–5; please also quote USD 250,000.

3. **Directors & Officers** — not required at this stage; please quote
   separately if it can be bundled cheaply.

4. **Public liability** — not applicable (no physical premises visited by
   clients, no site-visit risk).

---

## Deliverables expected from the broker

1. Indicative annual premium for each combination above.
2. Specimen policy wording for the primary PI policy.
3. Exclusions list — particularly whether the policy excludes:
   a. Claims arising from unlicensed valuation practice (we must not be
      characterised as practising valuation);
   b. Claims arising from data-scraping-based ToS disputes;
   c. Claims from bank clients exceeding a named sub-limit.
4. Any warranties or subjectivities (e.g. requirement for an advisory board,
   methodology audit, membership of an industry body).
5. Approximate premium uplift if bank-facing API revenue is added in year 2.

---

## Answers to predictable underwriter questions

- **Are you a member of the Institute of Valuers of Sri Lanka?** No. We do
  not issue formal valuations; we supply market-intelligence reports.
- **Do you have any prior claims or circumstances?** No. New venture.
- **Estimated first-year revenue band?** USD 5,000 – USD 50,000, stepping
  to USD 50,000 – USD 250,000 in year 2 if bank pilot lands.
- **Estimated number of reports / opinions issued per year?** 100 – 2,000
  in year 1 across legal and diaspora channels.
- **Largest single client concentration?** Currently none. Target in year 2
  is a bank pilot at USD 12k – 24k annual.
- **Do you have a written complaints procedure?** To be drafted before Phase
  5a launch. Can share draft on request.

---

## Target terms

- Annual premium cap in year 1: **USD 1,500 equivalent** for PI USD 250k +
  Cyber USD 100k bundle. Anything materially above, re-scope or reduce limit.
- Policy must allow mid-term upgrade of limit without short-period penalty
  in anticipation of a bank pilot.
- Must permit US / UK / AU diaspora claimants without exclusion.

---

## Decision log

```
Broker        Quote date    Premium (LKR)   PI limit   Exclusions notes   Chosen?
Senaratne     yyyy-mm-dd
P&I Brokers   yyyy-mm-dd
Ceylinco Gen  yyyy-mm-dd
...
```

File in `docs/phase0/eo_tracker.md` once quotes arrive.
