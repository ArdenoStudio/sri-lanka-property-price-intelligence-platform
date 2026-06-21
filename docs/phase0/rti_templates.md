# RTI Request Letter Templates

**Legal basis:** Right to Information Act No. 12 of 2016.
**Statutory response window:** 14 working days (initial acknowledgement), 28 working days (substantive reply).
**Fee:** Nil for inspection; photocopy fees as gazetted (typically LKR 2–5 per page).
**Mode:** Written request to the designated Information Officer of each authority. Physical delivery (registered post) recommended; email permitted where the agency lists an RTI email.

File all four in **Phase 0 week 1** so statutory replies arrive by Phase 2 (week 5).

---

## Common header (use on each letter)

```
[Your full name]
[Your NIC number]
[Your postal address]
[Email]  |  [Mobile]

[Date]

The Information Officer
[Agency name]
[Agency address]

Sir / Madam,

Subject: Request for Information under the Right to Information Act No. 12 of 2016

I, [Your name] (NIC: [xxx]), a citizen of Sri Lanka, hereby make a formal
request under Section 24 of the Right to Information Act No. 12 of 2016
for the following information held by your authority:

[Numbered list — see per-agency sections below]

I request the information in electronic (CSV / Excel / shapefile / PDF) form,
delivered by email to [email], or on CD/USB collected in person, whichever is
easier for your office. If any part of this request is deemed exempt under
Section 5 of the Act, kindly provide the non-exempt portion along with reasons
for the partial refusal.

If any fee is payable for reproduction, kindly notify me in advance and I will
remit it promptly.

Thank you for your assistance.

Yours faithfully,

[Signature]
[Name]
```

---

## 1. Government Valuation Department (Department of Valuation)

**Addressee:** Information Officer, Department of Valuation, "Vidhatha Mandira", No. 4, Sri Sangaraja Mawatha, Colombo 10.
**Why:** Aggregate assessed-value and transfer statistics feed the calibration layer for Phase 6D and establish relationships for the 2027 property tax AVM procurement.

**Items requested:**
1. District-wise aggregate statistics of property valuations completed by the Department for the calendar years 2020–2025, disaggregated by:
   a. Property type (residential land, residential house, apartment, commercial, agricultural);
   b. District and Divisional Secretariat;
   c. Purpose (stamp duty / acquisition / rating / other);
   d. Count of valuations and total aggregate valued amount (LKR).
2. Median and mean assessed value per perch for residential land, and per square foot for houses and apartments, by District and DS Division, for years 2022, 2023, 2024 and 2025 to date.
3. Copy of the current methodology / practice manual used for mass valuation and individual valuation, to the extent it is not marked confidential.
4. A list of private-sector valuation firms registered with or referred to by the Department in the last three years.
5. Details of any public tender or procurement notice issued or planned for computer-assisted mass appraisal (CAMA) or property-based valuation (PBV) systems in connection with the 2027 property tax reform.

---

## 2. Urban Development Authority (UDA)

**Addressee:** Information Officer, Urban Development Authority, 6th-8th Floor, "Sethsiripaya" Stage II, Battaramulla.
**Why:** Zoning layers and building-approval volume are Phase 6 GIS moat; permit pipeline signals supply-side pressure for reports.

**Items requested:**
1. Shapefile or GeoJSON of the current Colombo Metropolitan Region zoning / Development Plan, including:
   a. Zone type boundaries (residential, mixed-use, commercial, industrial, special);
   b. Floor Area Ratio (FAR) and building-height limits per zone;
   c. Reservation and buffer zones.
2. Annual counts of building approvals issued under the UDA Law for the Colombo, Dehiwala-Mount Lavinia, Sri Jayawardenepura Kotte, Moratuwa and Negombo Municipal Council areas for 2022, 2023, 2024 and 2025 to date, broken down by building use (residential single, residential multi-unit, mixed-use, commercial, other) and by number of floors.
3. Copies of any published Development Plan, Action Plan, or Guideline documents for the Colombo Metropolitan Region currently in force.
4. List of condominium projects granted "Condominium Property" registration under the Apartment Ownership Law (as amended) in the last three years, with project name, location (DS Division), and number of units, to the extent publicly available.

---

## 3. National Building Research Organisation (NBRO)

**Addressee:** Information Officer, National Building Research Organisation, 99/1 Jawatte Road, Colombo 05.
**Why:** Landslide hazard zonation is the single biggest risk overlay for hill-country listings; unavailable from any commercial source.

**Items requested:**
1. Latest landslide hazard zonation maps (shapefile / GeoTIFF) for all districts covered, indicating hazard categories (very high / high / moderate / low / safe).
2. The methodology report and metadata accompanying the landslide hazard zonation maps.
3. Any published subsidence, rockfall, or cut-slope stability maps for the Colombo District and the Western Province.
4. A list of areas gazetted or officially advised as "landslide-prone" in the last five years.
5. NBRO guidelines, if any, applicable to pre-purchase site investigation in hazard-prone areas, that an ordinary buyer could reasonably request.

---

## 4. Colombo Municipal Council (CMC)

**Addressee:** Information Officer, Colombo Municipal Council, Town Hall, F.R. Senanayake Mawatha, Colombo 07.
**Why:** Assessment rate schedules feed the "annual holding cost" section of reports; ward-level data is the highest-resolution public price signal inside Colombo.

**Items requested:**
1. The current schedule of Annual Value assessments for rateable properties in each Ward of the CMC, at the level of aggregation your office is able to publish (ward average / band / range per property category is acceptable).
2. Rate percentages currently applied to residential, commercial, and mixed-use properties in each Ward, for rating years 2023, 2024 and 2025.
3. Count of rateable properties by Ward and property category, as at the most recent revision of the rating roll.
4. Any published Ward-boundary shapefile / GeoJSON or, failing that, a scanned PDF of the current ward boundaries.
5. The schedule of trade / business licenses issued in the most recent complete year, by Ward, so that commercial-density signals can be computed.

---

## After filing — tracker fields

Log each filing in a spreadsheet (`docs/phase0/rti_tracker.csv`) with columns:

```
agency, filed_date, reference_number, acknowledged_date,
statutory_due_date, response_received_date, response_summary,
appeal_filed (y/n), follow_up_action
```

If the 14-working-day acknowledgement lapses, the Act allows an appeal to the
Designated Officer. If the 28-working-day substantive reply lapses or is
refused improperly, appeal to the RTI Commission (http://www.rticommission.lk).
