<script lang="ts">
  import { tick } from "svelte";
  import { cardFocus } from "./cardFocus.svelte";
  import { period as ratePeriod } from "./period.svelte";
  import {
    currency,
    dailyRate,
    fetchRates,
    issuingBranch,
    resolveRate,
    type Allowance,
    type Band,
    type Footnote,
    type RateData,
    type Role,
  } from "./rates";

  interface Props {
    department?: string;
    apiBase?: string;
  }

  let { department = "art", apiBase = "/resources/api" }: Props = $props();

  // --- State ---

  let rateData = $state<RateData | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  fetchRates(`${apiBase}/rates-${department}.json`)
    .then((data) => (rateData = data))
    .catch((e) => (error = e instanceof Error ? e.message : "Failed to load rate data"))
    .finally(() => (loading = false));

  // --- Card groups ---

  // The published cards split the bands into a film card and a TV card; the band
  // codes carry the split, so the grouping is declared once here rather than
  // being passed in per table as it was on the old markup.
  const GROUPS = [
    { id: "film", title: "Film Rate Card", inGroup: (code: string) => !code.startsWith("tv") },
    { id: "tv", title: "TV Rate Card", inGroup: (code: string) => code.startsWith("tv") },
  ];

  // Alias bands are alternative names for a column, not columns of their own
  let columnBands = $derived(rateData?.bands.filter((b) => !b.alias) ?? []);

  // A department without subcategories is one unnamed section per card; Props
  // splits into dressing / modellers / painters, each its own table.
  interface Section {
    key: string;
    name: string | null;
    roles: Role[];
    footnotes?: Footnote[];
  }

  let sections = $derived.by<Section[]>(() => {
    if (!rateData) return [];

    const groups = rateData.subcategories;
    if (!groups?.length) return [{ key: "all", name: null, roles: rateData.roles }];

    const sections: Section[] = groups
      .map((group) => ({
        key: group.code,
        name: group.name,
        roles: rateData!.roles.filter((r) => r.subcategory === group.code),
        footnotes: group.footnotes,
      }))
      .filter((s) => s.roles.length);

    // Anything whose subcategory is missing from the list still has to appear
    const known = new Set(groups.map((g) => g.code));
    const ungrouped = rateData.roles.filter((r) => !r.subcategory || !known.has(r.subcategory));
    if (ungrouped.length) sections.push({ key: "other", name: null, roles: ungrouped });

    return sections;
  });

  let cards = $derived(
    GROUPS.map((group) => ({
      ...group,
      bands: columnBands.filter((b) => group.inGroup(b.code)),
    })).filter((card) => card.bands.length),
  );

  let allowanceTypes = $derived(rateData?.allowanceTypes ?? []);

  // --- "Show on card", sent up from the calculator ---

  // Cards are closed until opened, by a click or by a request from above
  let openCards = $state<Record<string, boolean>>({});
  let focused = $state({ role: "", band: "" });
  let handledNonce = 0;

  // The band decides the card: a TV band is only ever on the TV card
  let focusedCard = $derived(cards.find((card) => card.bands.some((b) => b.code === focused.band)) ?? null);

  function rowId(cardId: string, roleCode: string): string {
    return `rate-row-${department}-${cardId}-${roleCode}`;
  }

  $effect(() => {
    const { role, band, nonce } = cardFocus;
    if (!nonce || nonce === handledNonce) return;

    // A cleared request (the calculator's reset) drops the highlight and leaves
    // any opened card where it is, rather than closing it under the reader
    if (!role || !band) {
      handledNonce = nonce;
      focused = { role: "", band: "" };
      return;
    }

    const card = cards.find((c) => c.bands.some((b) => b.code === band));
    if (!card) return; // data still loading; the next request will land

    handledNonce = nonce;
    focused = { role, band };
    openCards[card.id] = true;

    // The row only exists once the card has been opened and rendered
    tick().then(() => {
      const row = document.getElementById(rowId(card.id, role));
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
      // Keyboard users land on the row rather than back at the top of the page
      row?.focus({ preventScroll: true });
    });
  });


  // --- Helpers ---

  // Roles in a section share their min/rec wording (the Prop Painters' second
  // figure is a Standard, not a Recommended), so the section's first role speaks
  // for the table
  function legend(section: Section): string {
    const labels = labelsFor(section.roles[0]);
    return `${labels.min} / ${labels.rec}`;
  }

  // The data files abbreviate the range ("2025-26"); the heading spells both
  // years out, so next year's file needs no edit here
  function fullYears(published: string): string {
    const [from, to] = published.split("-");
    return to?.length === 2 ? `${from}-${from.slice(0, 2)}${to}` : published;
  }

  // The cells are narrow and these phrases repeat down whole columns. Table
  // only -- the calculator has the room for the card's full wording.
  function short(text: string): string {
    return text.replace(/\bNegotiable\b.*/g, "Neg.");
  }

  let periodNote = $derived(
    ratePeriod.weekly ? "Weekly rates." : "Daily rates, a fifth of the published weekly rate.",
  );

  function amount(weekly: number): string {
    return currency(ratePeriod.weekly ? weekly : dailyRate(weekly));
  }

  // The data writes periods lowercase ("weekly"), the cards write them as a
  // parenthetical; one spelling for band columns and allowance columns alike
  function periodLabel(period: string): string {
    return period.charAt(0).toUpperCase() + period.slice(1);
  }

  // Band names arrive as one string, "Major Motion Picture (£30M+)", but the
  // header sets the budget on its own line under the name
  function splitBand(name: string): { label: string; range: string } {
    const match = name.match(/^(.*?)\s*\((.*)\)$/);
    if (!match) return { label: name, range: "" };
    // "£3M < £8M per hr" is a column heading, not prose: the data keeps the
    // card's wording, the header abbreviates it
    const range = match[2].replace(/\s*per\s+(hr|hour)\b/gi, "/hr");
    return { label: match[1], range };
  }

  // The three Props cards each carry their own notes; Art and Set Dec have one
  // set for the department
  function footnotesFor(section: Section): Footnote[] {
    return section.footnotes ?? rateData?.footnotes ?? [];
  }

  function bandName(code: string): string {
    return rateData?.bands.find((b) => b.code === code)?.name ?? code;
  }

  function labelsFor(role: Role) {
    return {
      min: role.labels?.min ?? rateData?.labels?.min ?? "Minimum",
      rec: role.labels?.rec ?? rateData?.labels?.rec ?? "Recommended",
    };
  }

  // A role can be absent from a band entirely (several Prop Painters are), so
  // cells are looked up by band code and the gaps say so rather than shunting
  // the rest of the row under the wrong heading. A row that points at another
  // band is followed, so the cell shows the figures the card prints there.
  function rateFor(role: Role, band: Band) {
    return resolveRate(role, band.code);
  }

  // What follows a lone minimum, if anything: the row's own note, else the
  // card's convention
  function secondFigure(note: string | undefined): string {
    if (note) return short(note);
    return rateData?.secondFigureNegotiable ? "Neg." : "";
  }

  // Allowances do not vary by band within a card, so one column per allowance
  // type is enough; on the rare row where they do, both values are shown.
  function allowanceFor(role: Role, bands: Band[], code: string): Allowance[] {
    const seen = new Map<string, Allowance>();
    for (const band of bands) {
      const value = resolveRate(role, band.code)?.allowances?.[code];
      if (value) seen.set(JSON.stringify(value), value);
    }
    return [...seen.values()];
  }

  function hasAllowances(role: Role, bands: Band[]): boolean {
    return allowanceTypes.some((type) => allowanceFor(role, bands, type.code).length > 0);
  }

  // A section only gets the columns it uses: the Prop Painters card carries a
  // box rental and nothing else, so computer, phone and car would be three
  // columns of dashes.
  function allowanceTypesFor(section: Section) {
    return allowanceTypes.filter((type) =>
      section.roles.some((role) => allowanceFor(role, columnBands, type.code).length > 0),
    );
  }

</script>

{#snippet rateCell(role: Role, band: Band)}
  {@const rate = rateFor(role, band)}
  {@const isFocused = focused.role === role.code && focused.band === band.code}
  {#if !rate}
    <!-- No row at all for this band, which is not the same as a row that says
         the band is unusual: several Prop Painters stop before TV1/TV2 -->
    <td class="note" class:focused-cell={isFocused}>No data</td>
  {:else if rate.min !== null && rate.rec !== null}
    <td class:focused-cell={isFocused}>
      <span class="pair"
        ><span class="min">{amount(rate.min)}</span><span class="sep">/</span><strong class="rec"
          >{amount(rate.rec)}</strong
        ></span
      >
    </td>
  {:else if rate.min !== null}
    {@const second = secondFigure(rate.note)}
    <td class:focused-cell={isFocused}>
      {#if !second}
        <strong>{amount(rate.min)}</strong>
      {:else}
        <span class="pair"
          ><span class="min">{amount(rate.min)}</span><span class="sep">/</span><strong class="rec">{second}</strong
          ></span
        >
      {/if}
    </td>
  {:else if rate.rec !== null}
    <td class:focused-cell={isFocused}><strong>{amount(rate.rec)}</strong></td>
  {:else if rate.note}
    <!-- A row can carry both: the Action Prop Buyer's TV4 points at the film
         band, but its own note says what that band says, and says it plainly -->
    <td class="note" class:focused-cell={isFocused}>{short(rate.note)}</td>
  {:else if rate.align}
    <td class="note" class:focused-cell={isFocused}>See {bandName(rate.align)}</td>
  {:else}
    <td class="note" class:focused-cell={isFocused}>Not often in this band</td>
  {/if}
{/snippet}

{#snippet roleName(role: Role)}
  <span class="role-title">{role.titles[0]}</span>
  {#if role.titles.length > 1}
    <span class="role-alt">or {role.titles.slice(1).join(" / ")}</span>
  {/if}
{/snippet}

{#snippet allowanceCell(role: Role, bands: Band[], code: string)}
  {@const values = allowanceFor(role, bands, code)}
  {@const labels = labelsFor(role)}
  <td>
    {#each values as value, i}
      {#if i > 0}&nbsp;/&nbsp;{/if}
      {#if value.text}
        <span class:note={!value.text.startsWith("£") && value.text !== "—"}>{short(value.text)}</span>
      {:else}
        {#if value.min != null}{labels.min} {currency(value.min)}{/if}
        {#if value.min != null && value.rec != null}&nbsp;/&nbsp;{/if}
        {#if value.rec != null}{labels.rec} <strong>{currency(value.rec)}</strong>{/if}
      {/if}
    {:else}
      <!-- The role has no entry for this allowance, which the cards print as a
           dash rather than leaving blank -->
      <span class="empty">—</span>
    {/each}
  </td>
{/snippet}

{#if loading}
  <p>Loading rate cards…</p>
{:else if error}
  <p class="error-text">{error}</p>
{:else if rateData}
  <section class="rate-cards">
    <!-- BECTU and the department are both in the line below, so the heading
         carries only what the section is -->
    <div class="rate-cards-heading">
      <h2>Latest Rate cards ({fullYears(rateData.published)})</h2>

      <div class="segmented" role="group" aria-label="Rate period">
        <button
          type="button"
          class="segment"
          class:active={ratePeriod.weekly}
          aria-pressed={ratePeriod.weekly}
          onclick={() => (ratePeriod.weekly = true)}>Weekly</button
        >
        <button
          type="button"
          class="segment"
          class:active={!ratePeriod.weekly}
          aria-pressed={!ratePeriod.weekly}
          onclick={() => (ratePeriod.weekly = false)}>Daily</button
        >
      </div>
    </div>

    <p>As issued by the {issuingBranch(rateData)}</p>

    {#each cards as card (card.id)}
      <details class="rate-card" bind:open={openCards[card.id]}>
        <summary>{card.title}</summary>

        {#each sections as section (section.key)}
          {@const footnotes = footnotesFor(section)}
          <div class="rates-table-wrapper">
            <table class="rates-table">
              <thead>
                <tr>
                  <th scope="col">
                    {#if section.name}<span class="band-label">{section.name}</span>{/if}
                    <span class="period">({ratePeriod.weekly ? "Weekly" : "Daily"} rates)</span>
                  </th>
                  {#each card.bands as band (band.code)}
                    {@const parts = splitBand(band.name)}
                    <th scope="col">
                      <span class="band-label">{parts.label}</span>
                      {#if parts.range}<span class="band-range">{parts.range}</span>{/if}
                    </th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each section.roles as role (role.code)}
                  <tr
                    id={rowId(card.id, role.code)}
                    tabindex="-1"
                    class:focused={focusedCard?.id === card.id && focused.role === role.code}
                  >
                    <th scope="row">{@render roleName(role)}</th>
                    {#each card.bands as band (band.code)}
                      {@render rateCell(role, band)}
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>

            <div class="rates-table-footer">
              {#if footnotes.length}
                {#each footnotes as note}
                  {#if typeof note === "string"}
                    <p>{note}</p>
                  {:else}
                    <p>{#if note.marker}<span class="footnote-marker">{note.marker}</span>{/if} {note.text}</p>
                  {/if}
                {/each}
              {:else}
                <!-- No notes of its own: at least say what the pair of figures is -->
                <p>Figures shown as {legend(section)}. {periodNote}</p>
              {/if}
            </div>
          </div>
        {/each}
      </details>
    {/each}

    {#if allowanceTypes.length}
      <details class="rate-card">
        <summary>Box Rental Card</summary>

        {#each sections as section (section.key)}
          {@const roles = section.roles.filter((role) => hasAllowances(role, columnBands))}
          {@const types = allowanceTypesFor(section)}
          {#if roles.length}
            <div class="rates-table-wrapper">
              <table class="rates-table">
                <thead>
                  <tr>
                    <th scope="col">{section.name ?? ""}</th>
                    {#each types as type (type.code)}
                      <th scope="col">
                        <span class="band-label">{type.name}</span>
                        <span class="period">({periodLabel(type.period)})</span>
                      </th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  {#each roles as role (role.code)}
                    <tr>
                      <th scope="row">{@render roleName(role)}</th>
                      {#each types as type (type.code)}
                        {@render allowanceCell(role, columnBands, type.code)}
                      {/each}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        {/each}
      </details>
    {/if}

  </section>
{/if}

<style>
  .rate-cards {
    margin-top: 2rem;
  }

  .rate-cards-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .rate-cards-heading h2 {
    margin: 0;
  }

  /* Same control as the calculator's, so the two read as one page */
  .segmented {
    display: inline-flex;
    border: 1px solid #371e79;
  }

  .segment {
    margin: 0;
    padding: 6px 20px;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: #371e79;
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.5;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      color 0.2s ease;
  }

  .segment + .segment {
    border-left: 1px solid #371e79;
  }

  .segment:hover:not(.active) {
    background-color: rgba(55, 30, 121, 0.08);
  }

  .segment.active {
    background-color: #371e79;
    color: #fff;
    cursor: default;
  }

  /* Hairline between accordion rows */
  .rate-card {
    border-bottom: 1px solid rgba(0, 0, 0, 0.09);
  }

  /* +/- on the right in place of the default disclosure triangle */
  summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    cursor: pointer;
    padding: 1.25rem 0.5rem;
    font-size: 22px;
    line-height: 1.3;
    list-style: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary::after {
    content: "+";
    font-size: 1.6em;
    font-weight: 300;
    line-height: 1;
  }

  details[open] > summary::after {
    content: "\2212"; /* minus sign, not a hyphen */
  }

  .rates-table {
    /* Fixed layout so every band column is the same width whatever sits in it;
       the first column is pinned and the rest divide what is left equally */
    table-layout: fixed;
    min-width: 760px;
    color: #333333 !important;
    font-family: "raleway", sans-serif;
    font-size: 16px;
    line-height: 22px;
    overflow-x: auto;
    border-collapse: collapse;
  }

  .rates-table-footer p {
    font-size: 12px;
    margin-bottom: 0px !important;
  }

  .rates-table-footer p + p {
    margin-top: 6px;
  }

  .footnote-marker {
    font-weight: bold;
  }

  .rates-table td,
  .rates-table th {
    /* Transparent, not white: the gap between cells shows whatever the page is
       sitting on, the way the printed cards separate their colour blocks */
    padding: 10px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  .rates-table thead th {
    font-size: 17px;
    font-weight: bold;
    line-height: 24px;
    text-wrap: balance;
  }

  .rates-table tbody th {
    text-align: left;
    font-size: 16px;
    background-color: rgb(247, 247, 247);
    /* Anything still long enough to wrap breaks evenly rather than stranding a
       word on its own line */
    text-wrap: balance;
  }

  /* Where the calculator sent you: the row it came from, and the one cell */
  .rates-table tbody tr.focused th {
    background-color: #e7e2f3;
  }

  .rates-table tbody tr:focus {
    outline: none;
  }

  .rates-table td.focused-cell {
    outline: 2px solid #371e79;
    outline-offset: -2px;
  }

  .rates-table .role-title {
    display: block;
  }

  .rates-table .role-alt {
    display: block;
    color: #666;
    font-size: 13px;
    font-weight: normal;
    line-height: 18px;
  }

  .rates-table th:first-of-type {
    width: 260px;
  }

  .rates-table thead th:first-of-type {
    text-align: left;
  }

  /* Headers are one, two or three lines; sitting them on the bottom keeps the
     band names on one line rather than leaving the corner cell floating */
  .rates-table thead th {
    vertical-align: bottom;
  }

  .rates-table thead th:first-of-type .period {
    color: #666;
    font-size: 13px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .rates-table tbody tr td {
    text-align: center;
  }

  .rates-table tbody tr td:nth-child(2) {
    background-color: rgb(197, 144, 192, 0.2);
  }

  .rates-table tbody tr td:nth-child(3) {
    background-color: rgb(123, 111, 177, 0.2);
  }

  .rates-table tbody tr td:nth-child(4) {
    background-color: rgb(54, 96, 170, 0.2);
  }

  .rates-table tbody tr td:nth-child(5) {
    background-color: rgb(149, 189, 219, 0.2);
  }

  /* Sixth column only exists on the box rental card (Kit, after Software) */
  .rates-table tbody tr td:nth-child(6) {
    background-color: rgb(178, 160, 205, 0.2);
  }

  .rates-table thead th:nth-child(2) {
    background-color: rgb(197, 144, 192, 0.4);
  }

  .rates-table thead th:nth-child(3) {
    background-color: rgb(123, 111, 177, 0.4);
  }

  .rates-table thead th:nth-child(4) {
    background-color: rgb(54, 96, 170, 0.4);
  }

  .rates-table thead th:nth-child(5) {
    background-color: rgb(149, 189, 219, 0.4);
  }

  .rates-table thead th:nth-child(6) {
    background-color: rgb(178, 160, 205, 0.4);
  }

  /* "Negotiable", "See ...", "Not often in this band" -- not figures, and they
     repeat down whole columns, so they sit back from the rates */
  .rates-table .empty {
    color: #767676;
  }

  .rates-table .note {
    color: #767676;
    font-size: 14px;
    font-style: italic;
    /* Balances "As per / Props Dept" rather than stranding "Dept" */
    text-wrap: balance;
  }

  /* Minimum, slash, recommended in their own tracks: the separator holds one
     line down the column and the digits align either side of it */
  .rates-table td .pair {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: baseline;
    gap: 0 6px;
    font-variant-numeric: tabular-nums;
  }

  .rates-table td .pair .min {
    text-align: right;
  }

  .rates-table td .pair .rec {
    text-align: left;
  }

  /* Name, budget and period each on their own line */
  .rates-table thead th .band-label {
    display: block;
  }

  .rates-table thead th .band-range {
    display: block;
    font-size: 16px;
    font-weight: normal;
    line-height: 22px;
  }

  .rates-table thead th .period {
    display: block;
    font-size: 14px;
    font-weight: normal;
    line-height: 20px;
  }

  .rates-table-wrapper .rates-table {
    width: 100%;
  }

  details .rates-table-wrapper {
    margin: 20px 0px;
  }

  .rates-table-wrapper {
    overflow-x: scroll;
    overscroll-behavior-x: none;
  }

  .rates-table-wrapper .rates-table tr th:first-of-type {
    position: -webkit-sticky;
    position: sticky;
    left: 0;
  }

  .rates-table-wrapper .rates-table thead tr th:first-of-type {
    background-color: white;
  }

  .rates-table-wrapper .rates-table-footer {
    position: sticky;
    left: 0;
  }
</style>
