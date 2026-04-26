<script lang="ts">
  import svelteLogo from "./assets/svelte.svg";
  import viteLogo from "/vite.svg";
  import Counter from "./lib/Counter.svelte";

  import { CPI_DATA } from "./cpidata";

  function getCPI(month: number | string, year: number) {
    const key = `${year}-${month.toString().padStart(2, "0")}`;
    return CPI_DATA[key] || null;
  }

  function getLatestAvailableDate() {
    const dates = Object.keys(CPI_DATA).sort();
    const latest = dates[dates.length - 1];
    const [year, month] = latest.split("-").map(Number);
    return { year, month };
  }

  function getEarliestAvailableDate() {
    const dates = Object.keys(CPI_DATA).sort();
    const earliest = dates[0];
    const [year, month] = earliest.split("-").map(Number);
    return { year, month };
  }

  function isDateInFuture(selectedYear: number, selectedMonth: string | number): boolean {
    const latest = getLatestAvailableDate();

    if (selectedYear > latest.year) return true;

    if (selectedYear === latest.year) {
      // Handle "average" selection
      if (selectedMonth === "average" || selectedMonth === 0) {
        return false; // Average is always valid if year has any data
      }

      const monthNum = typeof selectedMonth === "string" ? parseInt(selectedMonth) : selectedMonth;
      return monthNum > latest.month;
    }

    return false;
  }

  function isDateTooEarly(selectedYear: number, selectedMonth: string | number): boolean {
    const earliest = getEarliestAvailableDate();

    if (selectedYear < earliest.year) return true;

    if (selectedYear === earliest.year) {
      // Handle "average" selection
      if (selectedMonth === "average" || selectedMonth === 0) {
        return false; // Average is always valid if year has any data
      }

      const monthNum = typeof selectedMonth === "string" ? parseInt(selectedMonth) : selectedMonth;
      return monthNum < earliest.month;
    }

    return false;
  }

  const now = new Date();
  const latest = getLatestAvailableDate();

  let month = $state(0);
  let year = $state(0);

  // let month = $state(latest.month.toString());
  // let year = $state(latest.year);
  let rate = $state(0);

  let toCPI = $derived(getCPI(latest.month, latest.year));
  let fromCPI = $derived(getCPI(month, year) ?? (isDateInFuture(year, month) ? toCPI : null));

  // Error states

  let dateNote = $derived.by(() => {
    if (month === 0 || year === 0) return null;
    if (isDateInFuture(year, month)) {
      return (
        "NB: Data is only available up to " +
        monthToText(latest.month.toString()) +
        " " +
        latest.year +
        ". Showing results as of that date."
      );
    }
    return null;
  });

  let dateError = $derived.by(() => {
    if (month === 0 || year === 0) return null;
    if (isDateTooEarly(year, month)) {
      const earliest = getEarliestAvailableDate();
      return (
        "Data not available for this date. Earliest data is from " +
        monthToText(earliest.month.toString()) +
        " " +
        earliest.year
      );
    }

    if (!fromCPI) {
      return "No CPI data available for the selected date";
    }

    return null;
  });

  let rateError = $derived.by(() => {
    if (rate < 0) {
      return "Rate must be a positive number";
    }
    if (rate > 1000000) {
      return "Rate seems unusually high - please check your input";
    }
    return null;
  });

  let hasErrors = $derived(dateError !== null || rateError !== null);

  let result = $derived.by(() => {
    if (hasErrors || !fromCPI || !toCPI || rate <= 0) {
      return 0;
    }
    return calculateInflation(rate, fromCPI, toCPI);
  });

  let yearlyInflationRate = $derived.by(() => {
    if (hasErrors || !fromCPI || !toCPI) {
      return 0;
    }
    return calculateYearlyInflationRate(year, month, latest.year, latest.month);
  });

  let totalInflationPercentage = $derived.by(() => {
    if (hasErrors || !fromCPI || !toCPI) {
      return 0;
    }
    return calculateTotalInflationPercentage(fromCPI, toCPI);
  });

  let timePeriodDescription = $derived.by(() => {
    return getTimePeriodDescription(year, month, latest.year, latest.month);
  });

  let showYearlyRate = $derived(shouldShowYearlyRate(year, latest.year));

  function monthToText(monthString: string) {
    let monthNum = parseInt(monthString);
    const months = [
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
    return months[monthNum - 1]; // -1 because your months are 1-12
  }

  function getAvailableDateRange() {
    const dates = Object.keys(CPI_DATA).sort();
    return {
      earliest: dates[0].split("-")[0],
      latest: dates[dates.length - 1].split("-")[0],
      count: dates.length,
    };
  }

  const dateRange = $state(getAvailableDateRange());

  function calculateInflation(amount: number, fromCPI: number, toCPI: number) {
    return Math.round((amount * toCPI) / fromCPI);
  }

  function calculateTotalInflationPercentage(fromCPI: number, toCPI: number): number {
    if (!fromCPI || !toCPI) return 0;

    // Calculate total percentage change
    const percentageChange = ((toCPI - fromCPI) / fromCPI) * 100;
    return percentageChange;
  }

  function calculateYearlyInflationRate(
    fromYear: number,
    fromMonth: string | number,
    toYear: number,
    toMonth: number,
  ): number {
    const fromCPI = getCPI(fromMonth, fromYear);
    const toCPI = getCPI(toMonth, toYear);

    if (!fromCPI || !toCPI) return 0;

    // Calculate total years between dates
    let yearsDiff = toYear - fromYear;

    // Adjust for months if not using "average"
    if (fromMonth !== "average" && fromMonth !== 0) {
      const fromMonthNum = typeof fromMonth === "string" ? parseInt(fromMonth) : fromMonth;
      const monthsDiff = toMonth - fromMonthNum;
      yearsDiff += monthsDiff / 12;
    }

    if (yearsDiff <= 0) return 0;

    // Calculate compound annual growth rate (CAGR)
    const totalGrowth = toCPI / fromCPI;
    const annualRate = Math.pow(totalGrowth, 1 / yearsDiff) - 1;

    return annualRate * 100; // Convert to percentage
  }

  function shouldShowYearlyRate(fromYear: number, toYear: number): boolean {
    return Math.abs(toYear - fromYear) > 1;
  }

  function getTimePeriodDescription(
    fromYear: number,
    fromMonth: string | number,
    toYear: number,
    toMonth: number,
  ): string {
    const yearsDiff = toYear - fromYear;

    if (yearsDiff === 0) {
      // Same year
      if (fromMonth === "average" || fromMonth === 0) {
        return "within the same year";
      }

      const fromMonthNum = typeof fromMonth === "string" ? parseInt(fromMonth) : fromMonth;
      const monthsDiff = toMonth - fromMonthNum;

      if (monthsDiff === 0) {
        return "within the same month";
      } else if (monthsDiff === 1) {
        return "over 1 month";
      } else {
        return `over ${monthsDiff} months`;
      }
    } else if (yearsDiff === 1) {
      return "over about 1 year";
    } else {
      return `over ${yearsDiff} years`;
    }
  }

  function currency(num: number) {
    return "£" + Math.round(num).toLocaleString("en-GB");
  }

  function isSameAsLatestDate(selectedYear: number, selectedMonth: string | number): boolean {
    if (selectedYear !== latest.year) return false;

    if (selectedMonth === "average" || selectedMonth === 0) return false;

    const monthNum = typeof selectedMonth === "string" ? parseInt(selectedMonth) : selectedMonth;
    return monthNum === latest.month;
  }

  function resetForm() {
    month = 0;
    year = 0;
    rate = 0;
  }
</script>

<main>
  <form id="yearForm">
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
            <!-- <option value="average">Average</option> -->
            <option value={0} disabled>Month</option>
            <option value={1}>January</option>
            <option value={2}>February</option>
            <option value={3}>March</option>
            <option value={4}>April</option>
            <option value={5}>May</option>
            <option value={6}>June</option>
            <option value={7}>July</option>
            <option value={8}>August</option>
            <option value={9}>September</option>
            <option value={10}>October</option>
            <option value={11}>November</option>
            <option value={12}>December</option>
          </select>

          <select id="year" name="year" bind:value={year} class="year-select" required>
            <option value={0} disabled>Year</option>
            {#each Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - i) as y}
              <option value={y}>{y}</option>
            {/each}
          </select>
        </div>

        <!-- <p class="small">If you don't know the exact date, make an estimate.</p> -->

        <!-- <div class="form-group">
        <input
          type="number"
          id="year"
          name="year"
          class="year-input"
          class:error={dateError}
          min={dateRange.earliest}
          max={latest.year}
          placeholder="YYYY"
          bind:value={year}
          oninput={handleYearInput}
          required
        />
      </div> -->

        {#if month !== 0 || year !== 0 || rate > 0}
          <div class="form-actions">
            <button type="button" class="reset-btn" onclick={resetForm}> Reset </button>
          </div>
        {/if}
      </div>

      <div class="result">
        <p class="form-label">Equivalent rate today</p>

        <p class="big-result">{rate > 0 && result > 0 && !hasErrors ? currency(result) : "£ —"}</p>

        {#if rate > 0 && !hasErrors && result > 0}
          <div class="answer">
            <p>
              <span
                >Taking inflation in to account, your rate of {currency(rate)} from {monthToText(month.toString())}
                {year} would be equivalent to {currency(result)} today.
                <i>Accepting anything less would be a pay cut in real terms.</i></span
              >
            </p>

            <p><strong>Change in value:</strong> {totalInflationPercentage.toFixed(1)}%</p>

            {#if dateNote}
              <p>{dateNote}</p>
            {/if}
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

  <!-- Error Messages -->

  <!-- Debug info (can be removed in production) -->
  <!-- <div class="debug-info">
    <h3>Debugging Info</h3>
    <p>Latest CPI: {toCPI} ({latest.year}-{latest.month.toString().padStart(2, "0")})</p>
    <p>Chosen CPI: {fromCPI || "N/A"} ({year}-{month})</p>
  </div> -->

  <div class="footer">
    <p class="small">
      The calculations are approximate and only give a rough guide to the buying power of the pound for goods and
      services purchased in the UK. <br />Consumer Price Index (CPI) data from the Office for National Statistics. Data
      updated through {monthToText(latest.month.toString())}
      {latest.year}.
    </p>
  </div>
</main>

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
</style>
