# Sample Report Delivery — Seanika Pulle, Nithya Partners

**Status:** Ready to send  
**Generated:** 21 June 2026  
**PDF:** `docs/phase0/samples/seanika_colombo_house_sample.pdf`

---

## Recipient

| Field | Value |
|---|---|
| Name | Ms. Seanika Pulle |
| Title | Head of Department — Conveyancing & Real Estate |
| Firm | Nithya Partners |
| Email | seanika@nithyapartners.com |
| Phone | +94 11 471 2625 (Ext. 211) |

---

## Sample property profile

Representative diaspora-style transaction in Colombo District (anonymised — not a live client matter):

| Attribute | Value |
|---|---|
| Property type | House for sale |
| District | Colombo |
| Land size | 8 perches |
| Built area | 1,800 sqft |
| Bedrooms | 3 |

**Estimate summary (live data as of 21 June 2026):**

- **33 comparable listings** matched in Colombo District
- **Confidence:** High
- **Price range (asking):** LKR 26.0M (P25) — LKR 30.0M (median) — LKR 55.0M (P75)
- **Data sources:** OnlineProperty.lk, Ikman.lk, Lamudi.lk

---

## Email — ready to send

**From:** Ovindu Karunaratne — karunaratneovindu@gmail.com  
**To:** seanika@nithyapartners.com  
**Subject:** Sample property intelligence report — as promised

> Dear Ms. Pulle,
>
> Thank you again for making time to speak with me in May. As promised, I've attached a sample Property Market Intelligence Report for a representative Colombo house transaction — the kind of diaspora purchase your team might see in practice.
>
> **Subject property (illustrative):** 3-bedroom house, 8 perches, ~1,800 sqft, Colombo District  
> **Estimated asking range:** LKR 26.0M – 55.0M (median LKR 30.0M), based on 33 comparable listings  
> **Confidence:** High — same district, matched by property type, size, and bedrooms
>
> The report includes the comparable listings table, methodology note, and the disclaimer referencing the Institute of Valuers of Sri Lanka. It is intended as a market reference only — not a formal valuation — which I understand aligns with how your firm would use something like this.
>
> I'd welcome your honest critique on three points in particular:
>
> 1. **Accuracy** — does the price range feel plausible for this type of property in Colombo?
> 2. **Usefulness** — would this save your team or your diaspora clients any time in the due-diligence conversation?
> 3. **Gaps** — what's missing that would make this genuinely useful in a legal context? (I know zoning, road access, and UDA restrictions are hard to get without physical checks — flagging those as known limitations.)
>
> No commercial ask here. If the data quality isn't there yet, I'd rather hear that now. If it is useful, we can discuss whether a per-report disbursement model makes sense at the price point you mentioned.
>
> Happy to jump on a 15-minute call if easier than email.
>
> Kind regards,  
> Ovindu Karunaratne  
> 076 248 5456  |  karunaratneovindu@gmail.com  
> Co-founder, Ardeno Studio  
> https://ardeno-studio-website.vercel.app/

**Attachment:** `seanika_colombo_house_sample.pdf`

---

## How to regenerate the PDF

```bash
# 1. Build dashboard against production API
cd dashboard
VITE_API_URL=https://property-price-intelligence-an-ardeno-production.fly.dev npm run build

# 2. Serve the built app (in a separate terminal)
npx serve -s dist -l 3456

# 3. Generate PDF (requires: pip install playwright && python -m playwright install chromium)
python3 scripts/generate_report_pdf.py \
  --output docs/phase0/samples/seanika_colombo_house_sample.pdf \
  --district Colombo --type house --size-perches 8 --size-sqft 1800 --bedrooms 3
```

**Live report URL** (once frontend SPA routing is deployed):

```
https://propertylk.vercel.app/report?district=Colombo&type=house&listing_type=sale&size_perches=8&size_sqft=1800&bedrooms=3
```

---

## Follow-up plan

| Action | When |
|---|---|
| Send email with PDF attached | Immediately |
| If no reply in 5 working days | Send one polite follow-up (see `outreach_emails_ready.md` template A-follow) |
| Log response in outreach tracker | On receipt |
| Schedule 15-min feedback call | If she engages positively |

---

## Notes from discovery call (for context in any follow-up)

- Handles 1–2 diaspora transactions/month
- Cannot advise on price — refers to registered valuers
- Would pass cost to client as disbursement only if data proves reliable
- **Ceiling: LKR 5,000 per report** (~USD 17)
- Already uses Google/ChatGPT/Gemini for rough checks — sceptical of wrong AI outputs in legal contexts
- Hardest data: zoning, road access, UDA restrictions
- North/East districts have weakest comparable coverage
