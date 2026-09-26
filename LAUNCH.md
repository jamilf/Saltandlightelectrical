# Launch checklist

Live mode stays off until every item here is true. The build already refuses live mode without the licence details, but that's a safety net, not the checklist.

## Licences and registrations

- [ ] Electrical contractor licence held, and the number recorded in `licence.number`.
- [ ] Whatever supervisor certificate is required at the time is held.
- [ ] ABN.
- [ ] Registered business name, recorded in `licence.businessName` if advertising under it.

## Insurance

- [ ] Public liability insurance.
- [ ] Any other cover the work needs.

## Contact details

- [ ] Business phone, recorded in `licence.phone`.
- [ ] Domain email address.
- [ ] The `.com.au` domain, now that the business is eligible for it.

## Rules

- [ ] NSW advertising and licensing rules re-checked against current official sources, since they may have changed after 2026:
  - Building trade advertisements: https://www.nsw.gov.au/business-and-economy/running-a-business/advertising-laws-and-your-business/building-trade-advertisements
  - Electrical work licensing: https://www.nsw.gov.au/business-and-economy/licences-and-credentials/building-and-trade-licences-and-registrations/electrical
  - Home Building Regulation 2014, clause 33: https://www5.austlii.edu.au/au/legis/nsw/consol_reg/hbr2014219/s33.html

## Only then, build

- [ ] Service pages.
- [ ] An enquiry form.
- [ ] Service areas.
- [ ] Electrician or LocalBusiness structured data, including the licence number.
- [ ] A Google Business Profile.
- [ ] A reviews policy.
- [ ] The lit lamp: set the last stage in `content/milestones.json` to done, then switch `mode` to `live`.
- [ ] Update `CLAUDE.md` so the rules match live mode.
