<script lang="ts">
  // --- Props ---

  interface Props {
    apiBase?: string;
  }

  let { apiBase = "/resources/api" }: Props = $props();

  const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  let month = $state(0);
  let year = $state(0);
  let rate = $state(0);

  let showDateInfo = $state(false);

  // --- State ---

  // Metadata fields are for whoever maintains the JSON; only `data` is read here
  interface CpiData {
    title?: string;
    source?: string;
    data: Record<string, number>;
  }

  let cpiData = $state<CpiData | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // --- Fetch data ---

  const endpoint = `${apiBase}/cpi.json`;

  async function fetchCpiData() {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`Failed to load CPI data (${res.status})`);
      const json = await res.json();
      if (!json?.data || typeof json.data !== "object") {
        throw new Error('CPI data file is missing its "data" section');
      }
      cpiData = json;
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load CPI data";
    } finally {
      loading = false;
    }
  }

  fetchCpiData();

  // --- CPI lookups ---

  function getCPI(month: number, year: number): number | null {
    if (!cpiData) return null;
    const key = `${year}-${month.toString().padStart(2, "0")}`;
    return cpiData.data[key] ?? null;
  }

  // --- Derived values ---

  let latest = $derived.by(() => {
    if (!cpiData) return null;
    const dates = Object.keys(cpiData.data).sort();
    if (dates.length === 0) return null;
    const [year, month] = dates[dates.length - 1].split("-").map(Number);
    return { year, month };
  });

  let toCPI = $derived(latest ? getCPI(latest.month, latest.year) : null);
  let fromCPI = $derived(getCPI(month, year));

  let dateError = $derived.by(() => {
    if (!latest) return null;
    if (month === 0 || year === 0) return null;
    if (year > latest.year || (year === latest.year && month >= latest.month)) {
      return "Your rate is already in today's money. Pick an earlier date to see its real value over time.";
    }
    if (!getCPI(month, year)) {
      return "No CPI data available for the selected date.";
    }
    return null;
  });

  let rateError = $derived.by(() => {
    if (rate < 0) return "Rate must be a positive number";
    if (rate > 1_000_000) return "Rate seems unusually high — please check your input";
    return null;
  });

  let hasErrors = $derived(dateError !== null || rateError !== null);

  let result = $derived.by(() => {
    if (hasErrors || !fromCPI || !toCPI || rate <= 0) return 0;
    return Math.round((rate * toCPI) / fromCPI);
  });

  let totalInflationPercentage = $derived.by(() => {
    if (hasErrors || !fromCPI || !toCPI) return 0;
    return ((toCPI - fromCPI) / fromCPI) * 100;
  });

  // --- Helpers ---

  function monthName(m: number): string {
    return MONTH_NAMES[m - 1];
  }

  function currency(num: number): string {
    return "£" + Math.round(num).toLocaleString("en-GB");
  }

  function resetForm() {
    month = 0;
    year = 0;
    rate = 0;
  }

  // --- Constants for dropdowns ---

  let years = $derived.by(() => {
    if (!latest) return [];
    const { year: latestYear, month: latestMonth } = latest;
    // Back to 2000 rather than a rolling ten years: the CPI series runs from
    // 1988, and rates quoted from twenty years ago still come up
    const EARLIEST = 2000;
    return Array.from({ length: latestYear - EARLIEST + 1 }, (_, i) => latestYear - i).filter(
      (y) => y < latestYear || latestMonth > 1,
    );
  });
</script>

{#if loading}
  <p>Loading inflation data…</p>
{:else if error}
  <p class="error-text">{error}</p>
{:else if latest}
  {@const latestDate = latest}
  <form id="yearForm" onsubmit={(e) => e.preventDefault()}>
    <h2>Inflation Calculator</h2>
    <p>Work out what your rate is worth today compared to when you did your last deal.</p>

    <div class="form-wrapper">
      <div class="form">
        <div>
          <label class="form-label" for="rate">I negotiated a rate of</label>
        </div>

        <div class="form-group">
          £ <input
            type="number"
            id="rate"
            name="rate"
            class:error={rateError}
            min="0"
            step="1"
            bind:value={rate}
            required
          />
        </div>

        <div class="form-group">
          <span>in </span>

          <select id="month" name="month" bind:value={month} class="month-select" required>
            <option value={0} disabled>Month</option>
            {#each MONTH_NAMES as name, i}
              {@const monthVal = i + 1}
              <option value={monthVal} disabled={year === latestDate.year && monthVal >= latestDate.month}>
                {name}
              </option>
            {/each}
          </select>

          <select id="year" name="year" bind:value={year} class="year-select" required>
            <option value={0} disabled>Year</option>
            {#each years as y}
              <option value={y}>{y}</option>
            {/each}
          </select>
        </div>

        <div class="form-actions">
          <button
            type="button"
            class="reset-btn"
            disabled={month === 0 && year === 0 && rate <= 0}
            onclick={resetForm}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
            Reset
          </button>
        </div>
      </div>

      <div class="result">
        <p class="form-label">
          Equivalent rate as of
          <span class="data-date">
            {monthName(latestDate.month)}
            {latestDate.year}<button
              class="info-toggle"
              onclick={() => (showDateInfo = !showDateInfo)}
              aria-label="Why this date?">ⓘ</button
            >
          </span>
        </p>

        {#if showDateInfo}
          <p class="info-text">
            CPI data from the ONS is published with a delay. {monthName(latestDate.month)}
            {latestDate.year} is the most recent data available.
          </p>
        {/if}

        <div class="result-body">
          <p class="big-result">{rate > 0 && result > 0 && !hasErrors ? currency(result) : "£ —"}</p>

          {#if rate > 0 && !hasErrors && result > 0}
            <div class="answer">
              <p>
                Taking inflation into account, your rate of {currency(rate)} from {monthName(month)}
                {year} would be equivalent to {currency(result)} today.
                <i>Accepting anything less would be a pay cut in real terms.</i>
              </p>

              <p class="change"><strong>Change in value:</strong> {totalInflationPercentage.toFixed(1)}%</p>
            </div>
          {:else if hasErrors}
            {#if dateError}
              <p class="error-text">{dateError}</p>
            {:else}
              <p class="error-text">Please fix the errors above to see the result</p>
            {/if}
          {:else}
            <p class="prompt-text">Enter a rate and date to see what it is worth today.</p>
          {/if}
        </div>
      </div>
    </div>
  </form>

  <div class="footer">
    <p class="small">
      NB: The calculations give a guide to the buying power of the pound for goods and services purchased in the UK.<br
      />
      Consumer Price Index (CPI) data from the Office for National Statistics.
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

  /* Matches .big-result / .rate-value on the rate card so both tabs share a rhythm */
  .big-result {
    font-size: 2rem;
    line-height: 1.2;
    margin: 0 0 0.5rem 0;
    /* Equal-width digits stop the figure jittering as the input changes */
    font-variant-numeric: tabular-nums;
  }

  .form-wrapper {
    display: flex;
  }

  /* basis 0 + min-width 0 => both columns are exactly half, whatever they hold */
  .form-wrapper .form,
  .form-wrapper .result {
    flex: 1 1 0;
    min-width: 0;
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

  /* Fills the space between the heading and the pinned Reset, and centres the
     figure in it so the column does not read as top-heavy with a void below */
  .result-body {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0.5rem 0;
  }

  .form {
    display: flex;
    gap: 0.5rem;
    flex-direction: column;
    /* stretch so the controls fill the column instead of hugging their text */
    align-items: stretch;
    border-right: 1px solid #c1c1c1;
  }

  /* Controls themselves are sized by #calculator input/select in app.css */
  .form {
    font-size: 1.25rem;
  }

  .form-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* flex-basis 0 keeps every control the same width regardless of its content */
  .form-group input,
  .form-group select {
    flex: 1 1 0;
    min-width: 0;
  }

  .small {
    font-size: 0.75rem;
    margin: 0;
  }

  .error-text {
    max-width: 40ch;
    margin: 0;
    color: #c33;
    font-style: italic;
    text-wrap: balance;
  }

  .prompt-text {
    max-width: 34ch;
    margin: 0;
    opacity: 0.7;
    font-style: italic;
    text-wrap: balance;
  }

  .answer p {
    max-width: 46ch;
    margin: 0 0 0.5rem 0;
  }

  .answer .change {
    margin-bottom: 0;
  }

  .error {
    border-color: #f44 !important;
    background-color: #fef !important;
  }

  /* Undoing the form is a quieter action than the controls it clears, so this
     is a plain icon and label rather than a filled button -- the rules below
     also unpick the app-wide button chrome (border, radius, grey fill) */
  .reset-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    padding: 6px 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: #371e79;
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.5;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
    cursor: pointer;
    transition: color 0.2s ease;
  }

  /* The icon carries the meaning, so it is sized against the label rather than
     fixed in px, and never shrinks when the row is tight */
  .reset-btn svg {
    width: 1.125em;
    height: 1.125em;
    flex: none;
  }

  .reset-btn:hover:not(:disabled),
  .reset-btn:focus-visible:not(:disabled) {
    border-color: transparent;
    color: #8e1b7e;
  }

  .reset-btn:disabled {
    border-color: transparent;
    background: transparent;
    opacity: 0.4;
    cursor: not-allowed;
  }

  .form-actions {
    /* auto margin pins the row to the bottom of its column, as on the rate card */
    margin-top: auto;
    padding-top: 1rem;
    display: flex;
    gap: 0.5rem;
  }

  p.form-label {
    font-size: 1.25rem;
    margin: 0 0 0.5rem 0;
  }

  .footer {
    margin-top: 2rem;
    text-align: center;
  }

  .data-date {
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 3px;
  }

  .info-toggle {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.875rem;
    padding: 0 0.15rem;
    color: inherit;
    opacity: 0.7;
    margin-left: 0.25rem;
  }

  .info-toggle:hover {
    opacity: 1;
  }

  /* A 14px glyph is not a tappable target on touch */
  @media (pointer: coarse) {
    .info-toggle {
      min-width: 32px;
      min-height: 32px;
    }
  }

  .info-text {
    font-size: 0.8rem;
    max-width: 40ch;
    margin: 0.5rem 0 0 0;
    opacity: 0.8;
    text-wrap: balance;
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

  @media (max-width: 480px) {
    /* Month + year side by side clip their longest options at this width, so
       give each its own full-width row and let "in" head them */
    .form-group {
      flex-wrap: wrap;
    }

    .form-group > span {
      flex: 1 0 100%;
    }

    .form-group select {
      flex: 1 1 100%;
    }
  }
</style>
