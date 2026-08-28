<script lang="ts">
  import { CPI_DATA } from "../cpidata";

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

  const latest = getLatestAvailableDate();

  let month = $state(0);
  let year = $state(0);
  let rate = $state(0);

  let showDateInfo = $state(false);

  // --- CPI lookups ---

  function getCPI(month: number, year: number): number | null {
    const key = `${year}-${month.toString().padStart(2, "0")}`;
    return CPI_DATA[key] || null;
  }

  function getLatestAvailableDate() {
    const dates = Object.keys(CPI_DATA).sort();
    const [year, month] = dates[dates.length - 1].split("-").map(Number);
    return { year, month };
  }

  // --- Derived values ---

  let toCPI = $derived(getCPI(latest.month, latest.year));
  let fromCPI = $derived(getCPI(month, year));

  let dateError = $derived.by(() => {
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

  const years = Array.from({ length: 11 }, (_, i) => latest.year - i).filter(
    (y) => y < latest.year || latest.month > 1,
  );
</script>

<form id="yearForm" onsubmit={(e) => e.preventDefault()}>
  <h2>Inflation Calculator</h2>
  <p>Fill in the fields below to work out what your rate is worth today compared to when you did your last deal.</p>

  <div class="form-wrapper">
    <div class="form">
      <div>
        <p class="form-label">I negotiated a rate of</p>
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
            <option value={monthVal} disabled={year === latest.year && monthVal >= latest.month}>
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

      {#if month !== 0 || year !== 0 || rate > 0}
        <div class="form-actions">
          <button type="button" class="reset-btn" onclick={resetForm}>Reset</button>
        </div>
      {/if}
    </div>

    <div class="result">
      <p class="form-label">
        Equivalent rate as of
        <span class="data-date">
          {monthName(latest.month)}
          {latest.year}<button
            class="info-toggle"
            onclick={() => (showDateInfo = !showDateInfo)}
            aria-label="Why this date?">ⓘ</button
          >
        </span>
      </p>

      {#if showDateInfo}
        <p class="info-text">
          CPI data from the ONS is published with a delay. {monthName(latest.month)}
          {latest.year} is the most recent data available.
        </p>
      {/if}

      <p class="big-result">{rate > 0 && result > 0 && !hasErrors ? currency(result) : "£ —"}</p>

      {#if rate > 0 && !hasErrors && result > 0}
        <div class="answer">
          <p>
            <span>
              Taking inflation into account, your rate of {currency(rate)} from {monthName(month)}
              {year} would be equivalent to {currency(result)} today.
              <i>Accepting anything less would be a pay cut in real terms.</i>
            </span>
          </p>

          <p><strong>Change in value:</strong> {totalInflationPercentage.toFixed(1)}%</p>
        </div>
      {:else if hasErrors}
        {#if dateError}
          <p class="error-text">{dateError}</p>
        {:else}
          <p class="error-text">Please fix the errors above to see the result</p>
        {/if}
      {/if}
    </div>
  </div>
</form>

<div class="footer">
  <p class="small">
    The calculations are approximate and only give a rough guide to the buying power of the pound for goods and services
    purchased in the UK. <br />Consumer Price Index (CPI) data from the Office for National Statistics. Data updated
    through {monthName(latest.month)}
    {latest.year}, inflation data is not currently available beyond this date.
  </p>
</div>

<style>
  .big-result {
    font-size: 2rem;
    margin: 0 0 1rem 0;
  }

  .form-wrapper {
    display: flex;
  }

  .form-wrapper .form,
  .form-wrapper .result {
    flex: 1;
  }

  .form {
    display: flex;
    gap: 0.5rem;
    flex-direction: column;
    align-items: start;
    margin-right: 2rem;
    padding-right: 2rem;
    border-right: 1px solid white;
  }

  .form,
  .form input,
  .form select {
    font-size: 1.25rem;
  }

  .small {
    font-size: 0.75rem;
    margin: 0;
  }

  .error-text {
    color: #c33;
    font-style: italic;
  }

  .error {
    border-color: #f44 !important;
    background-color: #fef !important;
  }

  .form-actions {
    margin-top: 1rem;
  }

  .form-label {
    font-size: 1.25rem;
    margin: 0 0 1rem 0;
  }

  .reset-btn {
    background-color: #f8f9fa;
    border: 1px solid #dee2e6;
    color: #6c757d;
    padding: 0.375rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s ease;
  }

  .reset-btn:hover {
    background-color: #e9ecef;
    border-color: #adb5bd;
    color: #495057;
  }

  .reset-btn:active {
    background-color: #dee2e6;
    transform: translateY(1px);
  }

  main {
    max-width: 800px;
  }

  .footer {
    margin-top: 2rem;
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

  .info-text {
    font-size: 0.8rem;
    margin: 0 0 1rem 0;
    opacity: 0.8;
  }
</style>
