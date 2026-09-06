# UI reference — extracted from `hostel-manager.html`

This is the visual specification for the React rebuild. Every structure below is
taken from the original single-file application. Class names in
`frontend/src/styles/app.css` are the originals, so a component can be checked
against the markup here line for line.

**Rule:** do not redesign. Match the layout, spacing, wording and colour of the
reference. The only permitted deviations are the ones listed at the bottom.

---

## Shell

```
<div class="app">
  <aside class="rail">
    <div class="brand">
      <div class="mark">{hostelName from GET /api/settings}</div>
      <div class="sub">Fees &amp; running costs</div>
    </div>
    <nav class="nav">…8 links…</nav>
    <div class="rail-foot">Changes are securely saved to the hostel database.</div>
  </aside>
  <main>
    <div class="topbar">
      <h1>{view title}</h1>
      <div class="spacer"></div>
      <div class="picker"><label>Building</label><select/></div>
      <div class="picker"><label>Month</label><input type="month"/></div>
    </div>
    <div class="wrap">…page…</div>
  </main>
</div>
```

Nav items, in order, with the counter badges the original showed:

| Label | Route | Badge |
| --- | --- | --- |
| Overview | `/` | — |
| Residents | `/residents` | count of residents staying (respects building filter) |
| Fee ledger | `/fees` | — |
| Overdue | `/overdue` | count of residents with any overdue balance |
| Staff & salaries | `/staff` | — |
| Bills & expenses | `/expenses` | — |
| Profit & loss | `/profit-loss` | — |
| Settings | `/settings` | — |

Badge markup: `<span class="tag">{n}</span>`. The active item gets `class="on"`.
When a resident profile is open, the **Residents** item stays highlighted and the
topbar `h1` shows the resident's name.

The building and month pickers are global — they live in the topbar on every
screen and are mirrored into the URL query string (`?month=2026-08&building=all`).

---

## Overview (`/`)

Six stat cards in a `.stats` grid, in this exact order and wording:

| Eyebrow | Value | Foot |
| --- | --- | --- |
| `Residents` | residentCount | `across {n} buildings` or `in {buildingName}` |
| `Collected · {Mon YYYY}` | collectedFees | `of {expectedFees} billed` — card has `ok-accent` |
| `Still to collect` | outstandingThisMonth | `this month only` |
| `Overdue, all months` | overdueAllMonths | `{n} resident(s) past due date` — card has `late-accent` |
| `Spent · {Mon YYYY}` | totalSpent | `{salaryPaid} salaries · {expenses} bills` |
| `Net for the month` | net | `collected minus spent` — `ok-accent` when ≥ 0, else `late-accent`, value prefixed `−` when negative |

Every stat card is `<div class="stat"><div class="bar"></div><div class="eyebrow">…</div><b>…</b><div class="foot">…</div></div>`.

**Building-by-building table** — rendered only when the building filter is `all`.
Card header: `Building by building · {Mon YYYY}`, hint `Tap a building name to filter everything`.
Columns: Building | Residents | Billed | Collected | Overdue | Bills | Salaries | Net (all right-aligned except the name).
- The building name is a `.link` that sets the building filter.
- Overdue cell is `var(--late)` and bold when > 0, otherwise an em dash.
- Net cell is `var(--ok)` when ≥ 0 else `var(--late)`, prefixed `−` when negative.
- A **`Shared, not assigned`** row appears when there are unattributed bills or
  salaries. Its resident/billed/collected/overdue cells are em dashes. Shared
  costs are never spread across buildings.
- `tfoot` row labelled `All three` (use `All buildings` when the count is not 3)
  totalling every column, with shared costs folded into the bills/salaries totals.

Then a `.grid2` with two `.stack` columns.

**Left column:**

1. `Who owes money` card, hint `Past the due date`.
   Columns: Resident | Building | Unpaid from | Amount due.
   Resident cell: `.name` with a `.link` to the profile, `.sub` beneath showing
   the phone or `no phone on file`. Building is a `.chip.bld`. Amount is
   `var(--late)`, bold. Shows the 12 largest; when more exist, a `.hint` footer
   reads `Showing the 12 largest. Open Overdue for the full list.`
   Empty state: **`Nobody is overdue`** / `Everyone is settled up to their due date.`

2. `Fee card · {year}` with `←` / `→` buttons (`.btn.sm.ghost`) that step the year.
   Columns: Resident | `Jan → Dec` | Monthly rent. Resident cell has the name as a
   `.link` and the building name as `.sub`. Middle cell is the 12-cell strip.
   Shows the first 15 residents. Footer contains the legend:
   `Paid in full` (ok) · `Part paid` (warn) · `Overdue` (late) · `Not due yet` (white, ruled) · `Not staying` (#E4EAEE).
   Empty state: **`No residents here yet`** / `Add someone on the Residents tab.`

**Right column:**

3. `Bills · {Mon YYYY}` — one `.catrow` per category: a 106px-min label, a
   `.catwrap > .catbar` whose width is `max(4%, amount/maxAmount * 100%)`, and the
   money right-aligned in a 72px-min cell. Then a bordered `Salaries paid` row and
   a `Total spent` row with `background:#F7FAFB`.
   Empty state: **`Nothing logged this month`** / `Add electricity, water or mess bills under Bills & expenses.`

4. `Salary run · {Mon YYYY}` — a borderless table: name + `.sub` (`{role} · {building or "all buildings"}`),
   salary right-aligned, then a chip: `Paid` / `{balance} left` (part) / `Pending`.
   Empty state: **`No staff here`** / `Add cook, warden or cleaning staff on the Staff tab.`

### Fee status strip

Twelve `<i>` elements inside `<div class="strip">`, one per month, with
`title="{Mon} {year}"`. Status → class mapping:

| Backend status | Strip class | Chip class | Chip label |
| --- | --- | --- | --- |
| `PAID` | `paid` | `chip paid` | `Paid` |
| `PART_PAID` | `part` | `chip part` | `Part paid` |
| `OVERDUE` | `late` | `chip late` | `Overdue {n}d` |
| `NOT_DUE` | `open` | `chip open` | `Not due yet` |
| `NOT_STAYING` | `na` | `chip off` | `—` |

---

## Residents (`/residents`)

**Form card** at the top. Header is `Add a resident`, or `Edit {name}` with a
`Cancel` ghost button when editing. `.formgrid` fields in this order:
Name · Building (select) · Phone · Monthly rent (number) · Due day (number 1–31) ·
Joined (`type="month"`) · Vacated (blank if staying) (`type="month"`) · submit
button reading `Add resident` / `Save changes`.

**List card**. Header is `Everyone` or the building name; hint on the right reads
`{n} staying · {m} on record`.
Columns: Name | Building | Phone | Rent | Due | {Mon YYYY} | Owed | Actions.
- Name cell: `.link` to profile, `.sub` reading `Since {Mon YYYY}` plus
  ` · vacated {Mon YYYY}` when they have left.
- Due cell: `5th`, `21st`, `3rd` — ordinal suffix.
- Month cell: the status chip, or `<span class="chip off">Vacated</span>`.
- Owed cell: red bold total, or an em dash.
- Actions: `Edit` (`.btn.sm.ghost`) and `Remove` (`.btn.sm.danger`).
Empty state: **`Nobody here yet`** / `Use the form above to add the first resident.`

Add to the reference behaviour: a search box, a status filter
(staying / vacated / archived / all) and pagination, per the production spec.

---

## Resident profile (`/residents/:id`)

Two buttons above the layout: `← All residents` and `Edit details` (both `.btn.ghost.sm`).
Then `<div class="profile">` — a 308px left column and a fluid right column.

**Left `.stack`:**
- Photo card: `.photo` showing the image or the initials placeholder
  (first letters of the first two name parts, uppercased). Below it the name as an
  `h2` at 19px and a `.sub` reading `{building} · staying since {Mon YYYY}` or
  `{building} · vacated {Mon YYYY}`. Actions: `Add photo`, `Remove`.
- `Aadhaar card` card: `.idcard` with placeholder text
  `No card on file` / `Photograph or upload it here`. Actions `Add card`, `Remove`,
  and a `.hint` beneath. **Replace the original's "Stored only in this app on your
  device." with `Stored securely; only signed-in staff can open it.`**
- `Move to another building` card: a `.bldline` with a building select and a
  `Move` button, then one `.catrow` per past transfer showing the date and
  `{from} → {to}`, or the hint `No transfers recorded.`

**Right `.stack`:**
- Three stat cards: `Monthly rent` (foot `due on the {n}th`), `Owes now`
  (`late-accent` when > 0 else `ok-accent`; foot `unpaid since {Mon YYYY}` or
  `fully settled`), `Paid to date` (`ok-accent`, foot `{n} payment(s)`).
- `Contact & terms` card using `.deets`: Phone · Building · Joined · Status ·
  `{Mon YYYY}` → status chip.
- `Fee card · {year}` with the year steppers and the strip.
- `Month by month` table: Month | Rent | Paid | Balance | Status | Settle.
  Balance is bold red when > 0. The Settle column shows a `Mark paid` button when
  the balance is > 0. Rows run newest month first.
- `Payment history` table: Paid on | For | Amount | Note | (undo).
  Note defaults to `Fee payment`. The action is an `Undo` `.btn.sm.danger`.
  Empty state: **`No payments recorded`** / `Use the fee ledger to log the first one.`

Clicking a photo or Aadhaar image opens the `.lightbox` (Escape or click closes it).

---

## Fee ledger (`/fees`)

Three stat cards: `Billed` (foot `{n} residents`), `Received`
(`ok-accent`, foot `{n}% of the month`), `Balance` (`late-accent`, foot `still to come in`).

`Fee ledger · {Mon YYYY}` card, hint `Type an amount and press Enter for part payments`.
Columns: Resident | Building | Rent | Paid | Balance | Status | Record a payment.
- Resident cell `.sub` reads `Due {D Mon}`.
- The action cell is a `.pay-inline` containing a number input whose placeholder
  is the outstanding balance, an `Add` ghost button, and a `Full` button shown
  only while a balance remains. Enter in the input submits the `Add`.
Empty state: **`Nobody enrolled here in {Mon YYYY}`** / `Pick another month or building.`

`Payments received` card below, hint `{n} entr(y|ies)`.
Columns: Date | Resident | Amount | Note | (undo).
Empty state: **`No payments logged for {Mon YYYY}`** / `Use the ledger above to record one.`

---

## Overdue (`/overdue`)

Three stat cards: `Total overdue` (`late-accent`, foot `across {n} unpaid months`),
`Residents involved` (foot `of {n} staying`), `Oldest arrears`
(value rendered at `font-size:19px` as `{n} days`, foot the resident's name).

`Every unpaid month, past due date` card with a `Print list` ghost button.
Columns: Resident | Building | Phone | For month | Rent | Paid | Due | Late by | Settle.
`Due` is red bold; `Late by` is a `.chip.late` reading `{n} days`; Settle is a
`Mark paid` button.
Empty state: **`Nothing is overdue`** / `Every fee is either paid or not due yet.`

---

## Staff & salaries (`/staff`)

Three stat cards: `Monthly payroll` (foot `{n} staff on duty`), `Paid · {Mon YYYY}`
(`ok-accent`, foot `{n}% of payroll`), `Pending` (`late-accent`, foot `still to pay out`).

Form card `Add staff` / `Edit {name}`: Name · Role · Works at (select, blank option
labelled `All buildings`) · Monthly salary · Status (`Working` / `Left`) · submit.

`Salary register · {Mon YYYY}` table.
Columns: Name | Role | Works at | Salary | Paid | Balance | Status | Pay.
Status chip: `Left` (off) / `Paid` / `Part paid` / `Pending`.
The Pay cell is a `.pay-inline` with an amount input, `Add`, `Full` (when a balance
remains), then `Edit` and `Remove`. Inputs are hidden for staff who have left.
Empty state: **`No staff on the register`** / `Add cook, warden or cleaning staff above.`

---

## Bills & expenses (`/expenses`)

Stat row: a `Bills · {Mon YYYY}` card (foot `{n} entr(y|ies)` plus ` · {building}`
when filtered), followed by one card per building showing that building's monthly
total with the foot `this month`.

`Log a bill` form: Date (`type="date"`) · Building (select with a
`Shared / all` blank option) · Category (select) · Amount · Note
(placeholder `Meter reading, vendor, period…`) · `Add bill`.

`Bills in {Mon YYYY}` card, hint `Total {money}`.
Columns: Date | Building | Category | Note | Amount | (remove).
The building cell is a `.chip.bld` reading the building name or `Shared`.
Empty state: **`No bills for {Mon YYYY}`** / `Log electricity, water, gas, internet or mess costs above.`

---

## Profit & loss (`/profit-loss`)

Four stat cards: `Income · {Mon YYYY}` (`ok-accent`, foot `rent actually received`),
`Expenses` (`late-accent`, foot `{salaries} salaries · {bills} bills`),
`Profit for the month` (foot `{n}% of income kept`),
`If everyone paid` (foot `{billed} billed less expenses`).

`Statement · {Mon YYYY}` card with the hint `Cash basis — money in, money out`
and a `Print` button. One column per building, plus a `Shared` column when
unattributed costs exist, plus a `Total` column unless a single building is
filtered. Rows:
- `Income` section header (`.eyebrow`, spanning every column)
- `Rent collected`
- `Rent billed (memo)` — rendered in `.sub`
- `Expenses` section header
- one row per expense category present
- `Salaries paid`
- `Total expenses` — `background:#F7FAFB`, bold
- `tfoot`: `Profit / loss`, coloured green/red per column.
Footer hint: `{arrears} of {Mon YYYY} rent is overdue and not counted as income until it is collected.`

`Year to date · {year}` card with year steppers.
Columns: Month | Income | Expenses | Profit | `Income vs expenses`.
The last column stacks two `.catwrap` bars — teal for income, `var(--late)` for
expenses — both scaled against the year's peak value. Zero cells show an em dash.
`tfoot`: `{year} total` with the three totals and the note `teal = income · red = expenses`.

---

## Settings (`/settings`)

`.grid2`. Left `.stack`:
- `Buildings` card, hint `Rename to match your own names`. One `.bldline` per
  building: a text input, a `.hint.num` reading `{n} staying`, and a `Remove`
  danger button. Footer `.imgacts` with `Save names` and `Add a building`.
  Removing a building that still has residents must be refused with a message.
- `Hostel details` card: Hostel name · Currency symbol · Default due day ·
  **Timezone** (new) · `Save details`.

Right column, `Your data` card. Replace the original's localStorage copy with a
line describing the database, e.g.
`{n} residents · {n} fee payments · {n} staff · {n} bills. Stored in the hostel
database and available on every device you sign in from.`
Actions become server exports: `Export residents (CSV)`, `Export payments (CSV)`,
`Export expenses (CSV)`. **Drop** `Reload SBI register`, `Restore from backup` and
`Clear everything` — seeding is a one-off script and destructive wipes are not a
production feature.

---

## Deliberate deviations from the reference

1. `window.confirm` → the reusable `ConfirmDialog` modal.
2. `window.storage` → REST API + PostgreSQL. The rail footer text changes from
   "Everything you enter is saved automatically on this device." to
   "Changes are securely saved to the hostel database."
3. Base64 images → private S3 with presigned URLs.
4. A fee becomes overdue the day *after* its due date, not at midnight on it.
5. Added: `/login`, loading / error / empty states, pagination, search filters,
   and a resident status filter.
6. The Settings "Your data" card exports instead of importing a browser JSON blob.
