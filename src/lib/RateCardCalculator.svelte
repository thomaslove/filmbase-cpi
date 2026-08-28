<script lang="ts">
  // --- Types ---

  interface Band {
    name: string;
    code: string;
    alias?: boolean;
  }

  // An allowance is either one card cell ("£15+", "Negotiable") or, as with the
  // painters' box rental, a minimum/standard pair like the rates themselves.
  interface Allowance {
    text?: string;
    min?: number;
    rec?: number;
  }

  interface Rate {
    band: string;
    min: number | null;
    rec: number | null;
    align?: string;
    note?: string;
    allowances?: Record<string, Allowance>;
  }

  interface Role {
    titles: string[];
    code: string;
    subcategory?: string;
    labels?: { min?: string; rec?: string };
    allowancePeriods?: Record<string, string>;
    rates: Rate[];
  }

  interface RateData {
    published: string;
    source: string | { url: string; subcategory: string }[];
    department: string;
    bands: Band[];
    subcategories?: { code: string; name: string }[];
    allowanceTypes?: { code: string; name: string; period: string }[];
    roles: Role[];
    labels?: { min?: string; rec?: string };
  }

  // --- Props ---

  interface Props {
    department?: string;
    apiBase?: string;
  }

  let { department = "art", apiBase = "/resources/api" }: Props = $props();

  // --- State ---

  let rateData = $state<RateData | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let selectedBand = $state("");
  let selectedRole = $state("");
  let isWeeklyRates = $state(true);

  // --- Fetch data ---

  const endpoint = `${apiBase}/rates-${department}.json`;

  async function fetchRateData() {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`Failed to load rate data (${res.status})`);
      rateData = await res.json();
      selectedBand = "";
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load rate data";
    } finally {
      loading = false;
    }
  }

  fetchRateData();

  // --- Derived: build role options from data ---

  interface RoleOption {
    id: string;
    title: string;
    code: string;
    subcategory?: string;
    labels?: { min?: string; rec?: string };
    allowancePeriods?: Record<string, string>;
    heading?: boolean;
  }

  // A role's alternative names are one row on the rate card, so they stay one
  // option, labelled the way the card labels the row.
  function toOption(role: Role): RoleOption {
    return {
      id: role.code,
      title: role.titles.join(" / "),
      code: role.code,
      subcategory: role.subcategory,
      labels: role.labels,
      allowancePeriods: role.allowancePeriods,
    };
  }

  // Roles are listed in the order they appear in the rate card itself, so the
  // data file's order is authoritative — never re-sorted here. A department with
  // subcategories (Props: dressing, modellers, painters) lists each one as a
  // block in the order declared, headed by a non-selectable label. The first
  // block runs straight on from the placeholder, unheaded.
  let roleOptions = $derived.by(() => {
    if (!rateData) return [];

    const all: RoleOption[] = rateData.roles.map(toOption);

    const groups = rateData.subcategories;
    if (!groups?.length) return all;

    const options: RoleOption[] = [];
    for (const [i, group] of groups.entries()) {
      const members = all.filter((o) => o.subcategory === group.code);
      if (!members.length) continue;
      if (i > 0) {
        options.push({ id: `heading::${group.code}`, title: group.name, code: "", heading: true });
      }
      options.push(...members);
    }

    // Anything whose subcategory is missing from the list still has to appear
    const grouped = new Set(groups.map((g) => g.code));
    options.push(...all.filter((o) => !o.subcategory || !grouped.has(o.subcategory)));

    return options;
  });

  let selectableBands = $derived(rateData?.bands.filter((b) => !b.alias) ?? []);

  let selectedRoleOption = $derived(roleOptions.find((r) => r.id === selectedRole) ?? null);

  // --- Derived: format labels ---

  // A department can mix rate-card formats (e.g. Props: a single recommended
  // dressing rate, but minimum/standard pairs for modellers and painters),
  // so a role may override the department-wide labels.
  let labels = $derived({
    min: selectedRoleOption?.labels?.min ?? rateData?.labels?.min ?? "Minimum",
    rec: selectedRoleOption?.labels?.rec ?? rateData?.labels?.rec ?? "Recommended",
  });

  // --- Derived: calculate result ---

  let resultRate = $derived.by(() => {
    const roleOption = selectedRoleOption;
    if (!rateData || !selectedBand || !roleOption) return null;

    const role = rateData.roles.find((r) => r.code === roleOption.code);
    if (!role) return null;

    let rate: Rate | null = role.rates.find((r) => r.band === selectedBand) ?? null;

    // Follow align references, guarding against missing targets and align cycles
    const visited = new Set<string>();
    while (rate?.align && !visited.has(rate.band)) {
      visited.add(rate.band);
      const target = role.rates.find((r) => r.band === rate!.align) ?? null;
      if (!target) break;
      rate = target;
    }

    return rate;
  });

  let hasResult = $derived(rateItemCount > 0);
  let rateItemCount = $derived(
    resultRate === null ? 0 : (resultRate.min !== null ? 1 : 0) + (resultRate.rec !== null || resultRate.note ? 1 : 0),
  );

  // Allowances are listed in the order the card lists its columns, and each
  // keeps its own period — a role may override it (the painters' box rental is
  // weekly where the dressing card's is daily).
  let allowanceRows = $derived.by(() => {
    const types = rateData?.allowanceTypes ?? [];

    // Before a role is picked the columns still show, so the panel does not
    // change shape once there is something to put in them
    if (!selectedRole || !selectedBand) {
      return types.map((type) => ({ name: type.name, period: type.period, value: undefined }));
    }

    const allowances = resultRate?.allowances;
    if (!allowances) return [];

    return types
      .filter((type) => allowances[type.code])
      .map((type) => ({
        name: type.name,
        period: selectedRoleOption?.allowancePeriods?.[type.code] ?? type.period,
        value: allowances[type.code],
      }));
  });

  // --- Helpers ---

  function currency(num: number): string {
    return (
      "£" +
      num.toLocaleString("en-GB", {
        minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
      })
    );
  }

  function dailyRate(weekly: number): number {
    // Round up: these are minimums, so a daily rate must never fall below weekly / 5
    return Math.ceil(weekly / 5);
  }

  function resetForm() {
    selectedBand = "";
    selectedRole = "";
    isWeeklyRates = true;
  }

  // --- Source credit ---

  let sourceCredit = $derived.by(() => {
    if (!rateData) return "";
    if (Array.isArray(rateData.source)) {
      const depts = rateData.source.map((s) => s.subcategory).join(" & ");
      return `Rates are as per the ${rateData.published} BECTU ${depts} Departments Rate Cards.`;
    }
    return `Rates are as per the ${rateData.published} BECTU ${rateData.department} Department Rate Card which was formulated by the BECTU ${rateData.department} Department Branch.`;
  });
</script>

{#snippet allowanceItems(name: string, period: string, value: Allowance | undefined)}
  {#if !value}
    <div class="rate-item">
      <span class="rate-label">{name}<span class="allowance-period">({period})</span></span>
      <span class="rate-value placeholder">£ —</span>
    </div>
  {:else if value.text}
    <div class="rate-item">
      <span class="rate-label">{name}<span class="allowance-period">({period})</span></span>
      <span class="rate-value" class:note={!value.text.startsWith("£")}>{value.text}</span>
    </div>
  {:else}
    {#if value.min != null}
      <div class="rate-item">
        <span class="rate-label">{labels.min} {name}<span class="allowance-period">({period})</span></span>
        <span class="rate-value">{currency(value.min)}</span>
      </div>
    {/if}
    {#if value.rec != null}
      <div class="rate-item">
        <span class="rate-label">{labels.rec} {name}<span class="allowance-period">({period})</span></span>
        <span class="rate-value">{currency(value.rec)}</span>
      </div>
    {/if}
  {/if}
{/snippet}

{#if loading}
  <p>Loading rate data…</p>
{:else if error}
  <p class="error-text">{error}</p>
{:else if rateData}
  <form id="rateCardForm" onsubmit={(e) => e.preventDefault()}>
    <h2>{rateData.department} Rate Calculator {rateData.published}</h2>
    <p>Use our quick tool to look up BECTU rate card rates, or browse the full rate cards below.</p>

    <div class="form-wrapper">
      <div class="form">
        <div>
          <label class="form-label" for="role">My role is</label>
        </div>

        <div class="form-group">
          <select id="role" bind:value={selectedRole} class="role-select" required>
            <option value="" disabled>Select a role</option>
            {#each roleOptions as option (option.id)}
              {#if option.heading}
                <option value={option.id} disabled class="role-heading">{option.title}</option>
              {:else}
                <option value={option.id}>{option.title}</option>
              {/if}
            {/each}
          </select>
        </div>

        <div>
          <label class="form-label" for="band">on a</label>
        </div>

        <div class="form-group">
          <select id="band" bind:value={selectedBand} class="band-select" required>
            <option value="" disabled>Select a band</option>
            {#each selectableBands as band (band.code)}
              <option value={band.code}>{band.name}</option>
            {/each}
          </select>
        </div>

        <div class="form-actions">
          <button
            type="button"
            class="calculator-button calculator-reset reset-btn"
            disabled={!selectedRole && !selectedBand}
            onclick={resetForm}>Reset</button
          >
        </div>
      </div>

      <div class="result">
        <div class="result-heading">
          <p class="form-label result-label" id="rate-period-label">Rate</p>

          <div class="segmented" role="group" aria-labelledby="rate-period-label">
            <button
              type="button"
              class="segment"
              class:active={isWeeklyRates}
              aria-pressed={isWeeklyRates}
              onclick={() => (isWeeklyRates = true)}>Weekly</button
            >
            <button
              type="button"
              class="segment"
              class:active={!isWeeklyRates}
              aria-pressed={!isWeeklyRates}
              onclick={() => (isWeeklyRates = false)}>Daily</button
            >
          </div>
        </div>

        <div class="result-body">
          {#if !selectedRole || !selectedBand}
            <p class="big-result">£ —</p>
            <p class="prompt-text">Select a role and band to see rates.</p>
          {:else if hasResult && resultRate}
            <div class="rates-display" class:single={rateItemCount < 2}>
              {#if resultRate.min !== null}
                <div class="rate-item">
                  <span class="rate-label">{labels.min}</span>
                  <span class="rate-value">
                    {currency(isWeeklyRates ? resultRate.min : dailyRate(resultRate.min))}
                  </span>
                </div>
              {/if}

              {#if resultRate.rec !== null}
                <div class="rate-item">
                  <span class="rate-label">{labels.rec}</span>
                  <span class="rate-value">
                    {currency(isWeeklyRates ? resultRate.rec : dailyRate(resultRate.rec))}
                  </span>
                </div>
              {:else if resultRate.note}
                <div class="rate-item">
                  <span class="rate-label">{labels.rec}</span>
                  <span class="rate-value note">{resultRate.note}</span>
                </div>
              {/if}
            </div>
          {:else}
            <div class="rates-display single">
              <div class="rate-item">
                <span class="rate-label">{labels.rec}</span>
                <span class="rate-value note unavailable">No published rate for this band</span>
              </div>
            </div>
          {/if}

          <!-- Allowances keep their own period, so the weekly/daily toggle above
               does not apply to them and they are headed separately -->
          {#if allowanceRows.length}
            <p class="form-label result-label allowances-label">Allowances</p>
            <div class="rates-display allowances">
              {#each allowanceRows as row (row.name)}
                {@render allowanceItems(row.name, row.period, row.value)}
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </form>

  <div class="footer">
    <p class="small">
      NB: TV Drama budget bands are per hour episode.
      {sourceCredit}
      {#if typeof rateData.source === "string"}
        The rate card can be downloaded <a href={rateData.source} target="_blank" rel="noopener"
          >directly from their website</a
        >.
      {:else if Array.isArray(rateData.source)}
        {#each rateData.source as src, i}
          {i > 0 ? " and " : " "}<a href={src.url} target="_blank" rel="noopener"
            >{src.subcategory} rate card<span class="external-arrow" aria-hidden="true">↗</span><span
              class="visually-hidden">{" "}(external link)</span
            ></a
          >{i === rateData.source.length - 1 ? "." : ""}
        {/each}
      {/if}
    </p>
  </div>
{/if}

<style>
  /* Centred intro block above the form */
  form > h2,
  form > h2 + p {
    text-align: center;
  }

  form > h2 {
    margin: 0 0 0.5rem 0;
  }

  form > h2 + p {
    text-align: center;
    width: 100%;
    margin: 0 0 2rem 0;
    /* max-width: 62ch; */
    /* margin: 0 auto 2rem auto; */
  }

  /* Same size as .rate-value so the placeholder and a real figure sit on one rhythm */
  .big-result {
    font-size: 2rem;
    line-height: 1.2;
    margin: 0 0 0.5rem 0;
  }

  .form-wrapper {
    display: flex;
  }

  /* basis 0 + min-width 0 => the columns split by their grow factors alone,
     whatever they hold. The result column takes the larger share so the rates
     and the four allowances each stay on one row, while the form column keeps
     enough width for the longest role names. */
  .form-wrapper .form,
  .form-wrapper .result {
    min-width: 0;
  }

  .form-wrapper .form {
    flex: 2 1 0;
  }

  .form-wrapper .result {
    flex: 3 1 0;
  }

  /* Matching inner gutters keep the divider centred and the text blocks equal */
  .form-wrapper .form {
    padding-right: 2rem;
  }

  .form-wrapper .result {
    display: flex;
    flex-direction: column;
    padding-left: 2rem;
  }

  .form {
    display: flex;
    gap: 0.5rem;
    flex-direction: column;
    /* The result column is the taller of the two, so centre the controls
       against it rather than leaving them stranded at the top */
    justify-content: center;
    /* stretch so the controls fill the column instead of hugging their text */
    align-items: stretch;
    border-right: 1px solid #c1c1c1;
  }

  /* Controls themselves are sized by #calculator input/select in app.css */
  .form {
    font-size: 1.25rem;
  }

  p.form-label {
    font-size: 1.25rem;
    margin: 0 0 0.5rem 0;
  }

  /* Sits directly under the controls it resets */
  .form-actions {
    padding-top: 1.25rem;
    display: flex;
    gap: 0.5rem;
  }

  /* The control sits on the heading's line, pushed to the right edge */
  .result-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .result-heading .result-label {
    margin-bottom: 0;
  }

  /* Two halves of one control, so they share a border rather than each having
     their own -- the filled half is the period currently shown */
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

  .form-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* flex-basis 0 keeps every control the same width regardless of its content */
  .form-group select {
    flex: 1 1 0;
    min-width: 0;
  }

  .result-body {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    padding: 0.5rem 0;
  }

  /* A fixed column grid, so figures line up in the same places whether a role
     has one rate or two -- and so the allowances below line up under them */
  .rates-display {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.25rem 2.5rem;
  }

  /* One figure fills the row rather than sitting in a half-empty grid */
  .rates-display.single {
    grid-template-columns: minmax(0, 1fr);
  }

  .rate-item {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .rate-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    line-height: 1.4;
    opacity: 0.65;
    /* Keeps the two figures on a shared baseline when one label wraps and the other does not */
    min-height: 2.1em;
  }

  .rate-value {
    font-size: 2rem;
    line-height: 1.2;
    font-weight: normal;
    /* Equal-width digits stop the columns jittering as the figures change */
    font-variant-numeric: tabular-nums;
  }

  .rate-value.placeholder {
    opacity: 0.5;
  }

  /* Set at the same size as a figure -- it stands in for one */
  .rate-value.note {
    line-height: 1.35;
    font-weight: normal;
    font-style: italic;
    /* Wrap on to even lines ("Negotiable based / on portfolio") rather than
       leaving one word stranded on the last line */
    text-wrap: balance;
  }

  /* A sentence rather than a word, so it is not set at figure size */
  .rate-value.unavailable {
    font-size: 1rem;
  }

  .prompt-text {
    max-width: 34ch;
    margin: 0;
    opacity: 0.7;
    font-style: italic;
    text-wrap: balance;
  }

  /* Element + class, to outweigh the shared p.form-label margin reset */
  p.allowances-label {
    margin-top: 2.75rem;
  }

  /* Allowances sit below the headline figures, so they read a step quieter --
     and small enough that four of them stay on one row */
  /* auto-fit rather than a fixed four, so a role with fewer allowances gives
     each one a wider column instead of squeezing its label into a quarter */
  .allowances {
    /* The floor is in rem, not ch: ch resolves against this element's 16px font
       rather than the 12px labels, which made the tracks far wider than their
       contents need and pushed the fourth allowance on to a second row */
    grid-template-columns: repeat(auto-fit, minmax(4rem, 1fr));
    gap: 0.75rem 1rem;
  }

  /* "Negotiable" is set smaller than a figure, so every allowance value shares
     one line box and is centred in it -- otherwise the word floats above the
     numbers sitting beside it */
  .allowances .rate-value {
    display: flex;
    align-items: center;
    min-height: 1.5rem;
    margin-top: auto;
    font-size: 1.25rem;
  }

  /* Allowance figures are already small, so a word beside them is set smaller
     again rather than matching them outright */
  .allowances .rate-value.note {
    font-size: 0.8rem;
  }

  /* Period drops to its own line so the name is not broken up by it */
  .allowance-period {
    display: block;
  }

  .allowances .rate-label {
    min-height: 3.4em;
  }

  .role-heading {
    font-weight: 700;
  }

  .error-text {
    color: #c33;
    font-style: italic;
  }

  .small {
    font-size: 0.75rem;
    margin: 0;
  }

  /* Marks the link as leaving the site; the arrow is decorative, so the wording
     it replaced is kept for screen readers rather than dropped */
  .external-arrow {
    margin-left: 0.15em;
    font-size: 1.2rem;
    line-height: 1;
    text-decoration: none;
    /* display: inline-block; */
    display: none;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .footer {
    margin-top: 2rem;
    text-align: center;
  }

  /* --- Responsive --- */

  /* Below this the two columns are too narrow to read, so stack them and turn
     the vertical divider into a horizontal one */
  @media (max-width: 640px) {
    .form-wrapper {
      flex-direction: column;
    }

    .form-wrapper .form {
      border-right: none;
      border-bottom: 1px solid #c1c1c1;
      padding-right: 0;
      padding-bottom: 1.5rem;
    }

    .form-wrapper .result {
      padding-left: 0;
      padding-top: 1.5rem;
    }

    /* The hard break in the intro leaves a stranded short line when narrow */
    form > h2 + p br {
      display: none;
    }

    form > h2 + p {
      margin-bottom: 1.5rem;
    }
  }

  /* Too narrow for two figures abreast: one rate per row, allowances two up */
  @media (max-width: 380px) {
    .rates-display {
      grid-template-columns: minmax(0, 1fr);
    }

    .allowances {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .rate-label,
    .allowances .rate-label {
      min-height: 0;
    }
  }

  @media (max-width: 640px) {
    .form-actions {
      flex-wrap: wrap;
    }

    .form-actions .calculator-button {
      flex: 1 1 auto;
    }
  }
</style>
