# Rate card data reference

One file per department (`rates-art.json`, `rates-props.json`, `rates-setdec.json`),
each a single object describing one published BECTU rate card. The calculator and
the rate tables below it both read the same file.

---

## Card

### `published` — String

The rate card's publication period, abbreviated as the cards abbreviate it
(`"2025-26"`). Printed as-is in the source credit, and spelled out in full
(`2025-2026`) in the rate cards heading.

### `source` — String

The URL to find the PDF rate card.

### `source` — Array of Objects _(alternative format)_

Alternatively an array of rate cards, used when one department's rates come from
several published cards.

- **`subcategory`** — String. The properly formatted name of the sub department
  (i.e. _Dressing Props_). Display text only: it names the link and appears in
  the source credit, and does not have to match a [`subcategories`](#subcategories--array-of-objects-optional) code.
- **`url`** — String. The URL to find the PDF rate card.

### `department` — String

The department's name.

### `issuedBy` — String _(optional)_

The branch that publishes the card, for when it is not the department's own
(the Art Department Branch issues the Set Dec card). Defaults to
`<department> Department Branch`.

### `secondFigureNegotiable` — Boolean _(optional)_

What the rates tables print in place of a missing `rec`, on a rate that has a
`min` but no `rec` and no `note` of its own.

- `true` — prints **Neg.**, meaning the second figure is there to be negotiated
  (the Art and Set Dec cards).
- `false` _(default)_ — prints the `min` on its own (the Props cards).

A `note` on the rate is used ahead of this.

### `footnotes` — Array _(optional)_

The card's own notes, in the order they should appear. Each entry is either a
plain String (a standalone line) or an object:

- **`marker`** — String _(optional)_. The symbol tying the note to the figures it
  explains (i.e. `*` or `**`).
- **`text`** — String. The note itself.

### `labels` — Object _(optional)_

The names given to the two rate figures, as these vary between rate cards. Used in the calculator's result and in the table legend. Roles may override this.

- **`min`** — String _(optional)_. The name of the minimum rate. Defaults to `Minimum`.
- **`rec`** — String _(optional)_. The name of the recommended rate. Defaults to `Recommended`.

---

## `bands` — Array of Objects

An array of possible budget bands consisting of objects.

- **`name`** — String. The budget band name, written as `<name> (<budget range>)`,
  i.e. `TV Band 3 (£3M < £8M per hr)`. The table header splits the two apart and
  sets the range on its own line.
- **`code`** — String. A short string that we can look up rates with. A code
  beginning `tv` puts the band on the **TV** rate card, anything else on the
  **film** rate card.
- **`alias`** — Boolean _(optional)_. Used for when we need to hide a band name.
  If `true` the band is dropped from the table columns and the calculator's band
  list, and other band codes point to this one.

---

## `subcategories` — Array of Objects _(optional)_

The sub departments within this department. Each becomes its own table and its own
block in the calculator's role list, in the order declared here. A subcategory no
role belongs to is left out.

- **`code`** — String. A short code that roles reference with their `subcategory`.
- **`name`** — String. The properly formatted name of the sub department
  (i.e. _Prop Modellers_).
- **`footnotes`** — Array _(optional)_. Notes belonging to this sub department's
  card, in the same format as the card's [`footnotes`](#footnotes--array-optional).
  Where present these are printed **instead of** the card's footnotes, not
  alongside them.

---

## `allowanceTypes` — Array of Objects _(optional)_

The allowance columns this card carries, in the order they should appear. A table
only gets the columns its own roles use.

- **`code`** — String. A short code that rates reference in their `allowances`.
- **`name`** — String. The allowance's display name (i.e. _Box_).
- **`period`** — String. The period the allowance is paid over, lowercase
  (`"weekly"`, `"daily"`). Roles may override this in the calculator; the table
  column heading always names the period given here.

---

## `roles` — Array of Objects

A list of all possible job roles, in the order the rate card lists them — the order
here is authoritative and is never re-sorted.

- **`titles`** — Array of Strings. An array of all synonyms for the same job role.
  Must always be a string array. The first is the role's name and the rest are
  shown after it as alternatives; the calculator joins them all with `/`.
- **`code`** — String. A short code for the job title. Must be unique within the
  file — it is how the calculator and the tables identify a row to each other.
- **`subcategory`** — String _(optional)_. The code of one of the
  [`subcategories`](#subcategories--array-of-objects-optional) above. Used to group
  the role in the rates tables and the calculator. A role whose subcategory is
  missing or unknown still appears, ungrouped, at the end.
- **`labels`** — Object _(optional)_. Overrides the card's
  [`labels`](#labels--object-optional) for this role, with the same `min` and `rec`
  keys. In a table the first role of the section speaks for the legend, so roles
  sharing a table should share their labels.
- **`allowancePeriods`** — Object _(optional)_. Overrides the period of one or more
  allowances for this role in the calculator, as `{ <allowance code>: <period> }`
  (the painters' box rental is weekly where the dressing card's is daily).
- **`rates`** — Array of Objects. The rates belonging to this role, [below](#rolesrates--array-of-objects).

### `roles[].rates` — Array of Objects

A band left out here is a role the card does not rate at that budget at all, and
the table says _No data_. A band included with no figures and no note is one the
card leaves blank, and the table says _Not often in this band_.

- **`band`** — String. The code of one of the [`bands`](#bands--array-of-objects) above.
- **`min`** — Number or Null. The minimum rate. `null` if not included on rate card.
- **`rec`** — Number or Null. The recommended rate. `null` if not included on rate card.
- **`note`** — String _(optional)_. A text note. Takes the place of the recommended
  rate when that is `null`, or stands as the whole entry when both rates are
  `null`. It never replaces a figure that is there.
- **`align`** — String _(optional)_. The code of the band who's rate data should be
  copied, i.e. `tv4` is aligned to `mmp`. The named band's rate is used in full, so
  any figures on this rate itself are ignored.
- **`allowances`** — Object _(optional)_. The allowances for this band, [below](#rolesratesallowances--object-optional).

### `roles[].rates[].allowances` — Object _(optional)_

Keyed by allowance code from [`allowanceTypes`](#allowancetypes--array-of-objects-optional).
Allowances rarely vary by band, so a table shows one value per role and only splits
the cell where the bands disagree. Each value is an object:

- **`text`** — String _(optional)_. The allowance as the card prints it (`"£150"`,
  `"Negotiable"`, `"See Kit"`). Used on its own — a value with `text` ignores `min`
  and `rec`.
- **`min`** — Number _(optional)_. The minimum allowance, where the card gives a
  pair of figures rather than one cell.
- **`rec`** — Number _(optional)_. The recommended allowance of that pair.
