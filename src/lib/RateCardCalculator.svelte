<script lang="ts">
  // --- Types ---

  interface Band {
    name: string;
    code: string;
    alias?: boolean;
  }

  interface Rate {
    band: string;
    min: number | null;
    rec: number | null;
    align?: string;
    note?: string;
  }

  interface Role {
    titles: string[];
    code: string;
    subcategory?: string;
    rates: Rate[];
  }

  interface RateData {
    published: string;
    source: string | { url: string; subcategory: string }[];
    department: string;
    bands: Band[];
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
    title: string;
    code: string;
    subcategory?: string;
  }

  let roleOptions = $derived.by(() => {
    if (!rateData) return [];
    const options: RoleOption[] = [];
    for (const role of rateData.roles) {
      for (const title of role.titles) {
        options.push({
          title,
          code: role.code,
          subcategory: role.subcategory,
        });
      }
    }
    return options.sort((a, b) => a.title.localeCompare(b.title));
  });

  let selectableBands = $derived(rateData?.bands.filter((b) => !b.alias) ?? []);

  // --- Derived: format labels ---

  let labels = $derived({
    min: rateData?.labels?.min ?? "Minimum",
    rec: rateData?.labels?.rec ?? "Recommended",
  });

  // --- Derived: calculate result ---

  let resultRate = $derived.by(() => {
    if (!rateData || !selectedBand || !selectedRole) return null;

    const roleOption = roleOptions.find((r) => r.code === selectedRole);
    if (!roleOption) return null;

    const role = rateData.roles.find((r) => r.code === roleOption.code);
    if (!role) return null;

    // Modellers override: single rate card across all bands
    let bandCode = roleOption.subcategory === "modellers" ? "mod" : selectedBand;

    let rate = role.rates.find((r) => r.band === bandCode);
    if (!rate) return null;

    // Follow align references
    if (rate.align) {
      rate = role.rates.find((r) => r.band === rate!.align) ?? null;
    }

    return rate;
  });

  let isModeller = $derived.by(() => {
    const roleOption = roleOptions.find((r) => r.code === selectedRole);
    return roleOption?.subcategory === "modellers";
  });

  let hasResult = $derived(resultRate !== null && (resultRate.min !== null || resultRate.rec !== null));
  let hasNoRates = $derived(resultRate !== null && resultRate.min === null && resultRate.rec === null);

  // --- Helpers ---

  function currency(num: number): string {
    return "£" + num.toLocaleString("en-GB");
  }

  function dailyRate(weekly: number): number {
    return Math.floor(weekly / 5);
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

{#if loading}
  <p>Loading rate data…</p>
{:else if error}
  <p class="error-text">{error}</p>
{:else if rateData}
  <form id="rateCardForm" onsubmit={(e) => e.preventDefault()}>
    <h2>Rate Calculator {rateData.published}</h2>
    <p>Use our quick tool to look up BECTU rate card rates, or browse the full rate cards below.</p>

    <div class="form-wrapper">
      <div class="form">
        <div>
          <p class="form-label">My role is</p>
        </div>

        <div class="form-group">
          <select bind:value={selectedRole} class="role-select" required>
            <option value="" disabled>Select a role</option>
            {#each roleOptions as option}
              <option value={option.code}>{option.title}</option>
            {/each}
          </select>
        </div>

        <div>
          <p class="form-label">on a</p>
        </div>

        <div class="form-group">
          <select bind:value={selectedBand} class="band-select" required>
            <option value="" disabled>Select a band</option>
            {#each selectableBands as band}
              <option value={band.code}>{band.name}</option>
            {/each}
          </select>
        </div>

        <div class="form-actions">
          {#if hasResult}
            <button type="button" class="toggle-btn" onclick={() => (isWeeklyRates = !isWeeklyRates)}>
              Switch to {isWeeklyRates ? "daily" : "weekly"} rates
            </button>
          {/if}

          {#if selectedRole}
            <button type="button" class="reset-btn" onclick={resetForm}>Reset</button>
          {/if}
        </div>
      </div>

      <div class="result">
        <p class="form-label">
          {isWeeklyRates ? "Weekly" : "Daily"} rate
        </p>

        {#if !selectedRole || !selectedBand}
          <p class="big-result">£ —</p>
          <p class="prompt-text">Select a role and band to see rates.</p>
        {:else if hasResult && resultRate}
          <div class="rates-display">
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

          {#if isModeller}
            <p class="info-text">Prop modellers have issued a single rate card covering all Film & TV bands.</p>
          {/if}
        {:else if hasNoRates}
          <p class="big-result">£ —</p>
          <p class="prompt-text">
            {resultRate?.note ?? "Not commonly found in this band."}
          </p>
        {/if}
      </div>
    </div>
  </form>

  <div class="footer">
    <p class="small">
      NB: TV Drama budget bands are per hour episode.
      {sourceCredit}
      {#if typeof rateData.source === "string"}
        The rate card can be downloaded <a href={rateData.source} target="_blank">directly from their website</a>.
      {:else if Array.isArray(rateData.source)}
        {#each rateData.source as src}
          <a href={src.url} target="_blank">{src.subcategory} rate card (external link)</a>
        {/each}
      {/if}
    </p>
  </div>
{/if}

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
  .form select {
    font-size: 1.25rem;
  }

  .form-label {
    font-size: 1.25rem;
    margin: 0 0 0.5rem 0;
  }

  .form-actions {
    margin-top: 1rem;
    display: flex;
    gap: 0.5rem;
  }

  .role-select,
  .band-select {
    width: 100%;
    max-width: 400px;
  }

  .rates-display {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .rate-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .rate-label {
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.7;
  }

  .rate-value {
    font-size: 2rem;
    font-weight: bold;
  }

  .rate-value.note {
    font-size: 1rem;
    font-weight: normal;
    font-style: italic;
  }

  .prompt-text {
    opacity: 0.7;
    font-style: italic;
  }

  .info-text {
    font-size: 0.8rem;
    margin: 0.5rem 0 0 0;
    opacity: 0.8;
    font-style: italic;
  }

  .error-text {
    color: #c33;
    font-style: italic;
  }

  .small {
    font-size: 0.75rem;
    margin: 0;
  }

  .reset-btn,
  .toggle-btn {
    background-color: #f8f9fa;
    border: 1px solid #dee2e6;
    color: #6c757d;
    padding: 0.375rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s ease;
  }

  .reset-btn:hover,
  .toggle-btn:hover {
    background-color: #e9ecef;
    border-color: #adb5bd;
    color: #495057;
  }

  .reset-btn:active,
  .toggle-btn:active {
    background-color: #dee2e6;
    transform: translateY(1px);
  }

  .footer {
    margin-top: 2rem;
  }
</style>
