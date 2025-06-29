<script lang="ts">
  import svelteLogo from "./assets/svelte.svg";
  import viteLogo from "/vite.svg";
  import Counter from "./lib/Counter.svelte";

  import { CPI_DATA } from "./cpidata.js";

  function getCPI(month: number | string, year: number) {
    // If month is 0 or "average", calculate average for the year
    if (month === 0 || month === "average") {
      const monthlyValues = [];

      // Get CPI data for all 12 months of the year
      for (let m = 1; m <= 12; m++) {
        const key = `${year}-${m.toString().padStart(2, "0")}`;
        const value = CPI_DATA[key];

        if (typeof value === "number") {
          monthlyValues.push(value);
        }
      }

      // Return average if we have data, otherwise null
      if (monthlyValues.length > 0) {
        const average = monthlyValues.reduce((sum, val) => sum + val, 0) / monthlyValues.length;
        return average;
      }

      return null;
    }

    // Original logic for specific months
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

  let month = $state(latest.month.toString());
  let year = $state(latest.year);
  let rate = $state(0);

  let toCPI = $derived(getCPI(latest.month, latest.year));
  let fromCPI = $derived(getCPI(month, year));

  // Error states
  let dateError = $derived.by(() => {
    if (isDateInFuture(year, month)) {
      return (
        "Future dates are not available. Latest data is from " +
        monthToText(latest.month.toString()) +
        " " +
        latest.year
      );
    }

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

  let nudgeMessage = $derived.by(() => {
    if (isSameAsLatestDate(year, month)) {
      return "💡 Now choose a date in the past to see how inflation has affected your rate over time.";
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
    toMonth: number
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
    toMonth: number
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

  // Constrain year input to available range
  function handleYearInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const inputYear = parseInt(target.value);

    if (inputYear > latest.year) {
      year = latest.year;
      target.value = latest.year.toString();
    } else if (inputYear < parseInt(dateRange.earliest)) {
      year = parseInt(dateRange.earliest);
      target.value = dateRange.earliest;
    }
  }

  // Auto-adjust month if year changes and current month becomes invalid
  $effect(() => {
    if (isDateInFuture(year, month) && month !== "average") {
      if (year === latest.year) {
        month = latest.month.toString();
      }
    }
  });

  function resetForm() {
    month = latest.month.toString();
    year = latest.year;
    rate = 0;
  }
</script>

<main>
  <form id="yearForm">
    <h2>What is your rate worth today?</h2>
    <p>Enter a past rate to see its inflation-adjusted value today.</p>
    <p class="small">If you don't know the exact month, select average.</p>
    <div class="form-wrapper">
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

      <div>
        <p>in</p>
      </div>

      <div class="form-group">
        <select id="month" name="month" bind:value={month} class="month-select" required>
          <option value="average">Average</option>
          <option value="1">January</option>
          <option value="2">February</option>
          <option value="3">March</option>
          <option value="4">April</option>
          <option value="5">May</option>
          <option value="6">June</option>
          <option value="7">July</option>
          <option value="8">August</option>
          <option value="9">September</option>
          <option value="10">October</option>
          <option value="11">November</option>
          <option value="12">December</option>
        </select>
      </div>

      <div class="form-group">
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
          on:input={handleYearInput}
          required
        />
      </div>
    </div>

    <div class="result">
      {#if rate > 0 && !hasErrors && result > 0 && !nudgeMessage}
        <div class="answer">
          <p>
            Your rate of {currency(rate)} from
            {#if month !== "average"}
              {monthToText(month)}
            {:else}
              average for
            {/if}
            {year} would be equivalent to {currency(result)} in today's money.
          </p>

          <p><i>Put simply: this is what you'd need to charge today to maintain the same standard of living.</i></p>

          {#if showYearlyRate}
            <div class="inflation-details">
              <h3>Inflation Breakdown</h3>
              <p class="total-inflation">
                <strong>Total inflation {timePeriodDescription}:</strong>
                {totalInflationPercentage >= 0 ? "+" : ""}{totalInflationPercentage.toFixed(1)}%
              </p>
              <p class="yearly-rate">
                <strong>Average yearly inflation:</strong>
                {yearlyInflationRate.toFixed(1) >= 0 ? "+" : ""}{yearlyInflationRate.toFixed(1)}% per year
              </p>
            </div>
          {:else}
            <div class="inflation-details">
              <h3>Inflation Breakdown</h3>

              <p class="total-inflation">
                <strong>Total inflation {timePeriodDescription}:</strong>
                {totalInflationPercentage >= 0 ? "+" : ""}{totalInflationPercentage.toFixed(1)}%
              </p>
            </div>
          {/if}
        </div>
      {:else if hasErrors}
        <p class="error-text">Please fix the errors above to see the result</p>
      {:else if rate > 0 && !hasErrors && result > 0 && nudgeMessage}
        <div class="nudge-message">
          {nudgeMessage}
        </div>
      {/if}
    </div>

    {#if rate > 0 || !hasErrors}
      <div class="form-actions">
        <button type="button" class="reset-btn" on:click={resetForm}> Reset </button>
      </div>
    {/if}
  </form>

  <!-- Error Messages -->

  <!-- Debug info (can be removed in production) -->
  <div class="debug-info">
    <h3>Debugging Info</h3>
    <p>Latest CPI: {toCPI} ({latest.year}-{latest.month.toString().padStart(2, "0")})</p>
    <p>Chosen CPI: {fromCPI || "N/A"} ({year}-{month})</p>
  </div>

  <div class="footer">
    <p class="small">
      The calculations are approximate and only give a rough guide to the buying power of the pound for goods and
      services purchased in the UK.
    </p>

    <p class="small">
      Consumer Price Index (CPI) data from the Office for National Statistics. Data updated through {monthToText(
        latest.month
      )}
      {latest.year}.
    </p>
  </div>
</main>

<style>
  .nudge-message {
    background-color: #fff8dc;
    border: 1px solid #f0e68c;
    padding: 0.5rem;
    margin: 0.5rem 0;
    border-radius: 4px;
    color: #8b7355;
    font-style: italic;
    /* max-width: 500px; */
  }
  h3 {
    margin-top: 0;
  }
  .form-wrapper {
    display: flex;
    align-items: center;
    gap: 1rem;
    justify-content: center;
  }

  .small {
    font-size: 0.75rem;
  }

  .error-message {
    background-color: #fee;
    border: 1px solid #fcc;
    padding: 0.5rem;
    margin: 0.5rem 0;
    border-radius: 4px;
    color: #c33;
  }

  .error-text {
    color: #c33;
    font-style: italic;
  }

  .error {
    border-color: #f44 !important;
    background-color: #fef !important;
  }

  .debug-info {
    background-color: #f8f9fa;
    padding: 0.5rem;
    margin: 0.5rem 0;
    border-radius: 4px;
    font-size: 0.875rem;
    color: #666;
    margin-top: 2rem;
  }

  .debug-info p {
    margin: 0.25rem 0;
  }

  .inflation-details {
    margin: 0.75rem 0 0.5rem 0;
    padding: 0.5rem;
    background-color: #f0f8ff;
    border-left: 3px solid #4a90e2;
    border-radius: 0 4px 4px 0;
    color: #2c5aa0;
  }

  .yearly-rate {
    margin: 0;
    color: #2c5aa0;
    font-size: 0.9rem;
  }

  .total-inflation {
    margin: 0 0 0.25rem 0;
    color: #2c5aa0;
    font-size: 0.9rem;
  }

  .form-actions {
    margin-top: 1rem;
    display: flex;
    justify-content: center;
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

  .logo {
    height: 6em;
    padding: 1.5em;
    will-change: filter;
    transition: filter 300ms;
  }
  .logo:hover {
    filter: drop-shadow(0 0 2em #646cffaa);
  }
  .logo.svelte:hover {
    filter: drop-shadow(0 0 2em #ff3e00aa);
  }
  .read-the-docs {
    color: #888;
  }
</style>
