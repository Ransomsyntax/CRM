# CONVOSIS CRM — journey audit repair verification

Date: 14 October 2026. Source audit: Pasted markdown(3).md, tested baseline `acd305a25661640427a360137d4b1b4c04ec8e75`.

All ten reported findings have implementation changes and focused verification. This verifies the repaired journeys; it does not certify every CRM feature.

| Finding | Repair | Verification |
|---|---|---|
| F01 Conversion warning | Clear the saved conversion form guard before navigation. | Browser conversion with an optional deal reaches success without a dialog. |
| F02 Deal Grid missing values | Reuse List column formatters in a dedicated Grid feature. | Browser asserts stage, amount, probability, date; Enter opens the record. |
| F03 Minimum amount filter | Apply input changes with debounce and change events; ignore detached controls. | Browser: 2600 excludes 2500/1000; 2500 matches one; clear restores two. API checks inclusive boundary 2600 and empty result 2601. |
| F04 Free quote form | Check server authorization before rendering platform creation fields. | Free browser reaches Upgrade required; backend quote list/create returns 403. Professional fixtures can create quotes. |
| F05 Duplicate layout selectors | Add the header picker only to core modules, keeping the existing platform selector. | Quote and Case browser forms expose one platform layout picker. |
| F06 Unnamed quote controls | Add row-specific names to numeric controls and remove buttons. | Browser targets quantity/discount/tax by accessible name and checks Remove line item 1. |
| F07 Misleading quote summary | Show base subtotal and combined line/overall discount and tax, retaining the existing grand-total calculation. | Browser and Node: base 250000, discount 25000, tax 40500, adjustment 500, total 266000. Existing quote API/PDF regression passes. |
| F08 Invalid campaign data | Budget minimum and date order checks in forms; finite nonnegative budget and valid chronological dates on create/update APIs. | Browser validity checks and valid save; API rejects negative budget, invalid date, reversed dates, including partial updates. Equal dates and zero budget accepted. |
| F09 Case lifecycle | Default new/blank status to New in form and backend; retain allowed-status validation. | Browser default New; API rejects Active and accepts Resolved. No bulk rewrite of existing cases. |
| F10 Case relationship IDs | Use authorized related-record names and links in detail fields. | Browser asserts linked Account/Contact names and destinations. |

Regression also exposed a missing openDealForAccount dependency in the interaction module. The selected Account → Deal handler is now connected, and the Account → Deal → Quote browser journey passes. Older browser assertions were updated to await asynchronous filter rendering and the current save-to-detail navigation.

## Commands

```sh
python3 -m pytest -q -rs --ignore-glob='tests/*browser*' --ignore=tests/test_dashboard_drilldown_browser.py --timeout=180
python3 -m pytest -q tests/test_browser_qa_journey_repairs.py tests/test_browser_module_filters.py tests/test_browser_contextual_actions.py --timeout=180
node tests/qa_quote_totals.mjs
```

## Results

- Broader regression command: **314 passed in 347.08 seconds**, no failures or skips.
- Three focused browser suites: **3 passed in 57.18 seconds**.
- Quote calculation script: all four assertions passed.
- JavaScript syntax checks and git diff whitespace checks passed.
- Main frontend entry remains below the repository 160000-byte limit.

## Scope

Browser tests run against isolated local SQLite databases and synthetic users, with Free and Professional test entitlements. No real upgrade or paid transaction was performed. Desktop Chromium was used. The broader command includes the mixed AI queue browser test but excludes browser-named suites other than the three explicitly run above. Full mobile, cross-browser, live tenant-role, load, outbound integrations, and advanced feature certification remain outside this repair pass. Existing unsupported case statuses were not changed in bulk; the audit states its QA case had already been corrected.

Production release checks are recorded separately after deployment. Local workflow evidence must not be confused with an authenticated production retest.

## Evening repair follow-up

The complete 335-test suite included every browser suite. The initial run found two failures: an actual import-navigation defect and an outdated sales-numbering assertion.

- **Import destination navigation:** Setup's module selector was treated as an unsaved record form. Choosing Deals, Accounts, or Contacts raised the draft-discard warning and blocked navigation. The navigation-only selector is now excluded from draft tracking; record and settings forms retain their guards.
- **Sales-numbering regression:** Saving now opens the saved record detail. The test still expected a return to the list; it now waits for the detail route while preserving generated-number, read-only, editing, and deletion assertions.
- Focused import, sales-numbering, and audit journeys rerun: **3 passed in 63.46 seconds**. Imports completed for Leads, Deals, Accounts, and Contacts.

Final complete rerun: **335 passed in 369.23 seconds**, with no failures or skips. Command: `python3 -m pytest -q --timeout=180`. All browser suites were included. Quote calculation assertions and JavaScript syntax/whitespace checks also passed. Frontend release marker: `20261014-import-guard-v40`.
