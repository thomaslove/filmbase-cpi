<script lang="ts">
  import InflationCalculator from "./lib/InflationCalculator.svelte";
  import RateCardCalculator from "./lib/RateCardCalculator.svelte";

  let activeTab = $state<"rates" | "inflation">("rates");
</script>

<main>
  <nav class="tabs">
    <button class="tab" class:active={activeTab === "rates"} onclick={() => (activeTab = "rates")}>
      Rate Calculator
    </button>
    <button class="tab" class:active={activeTab === "inflation"} onclick={() => (activeTab = "inflation")}>
      Inflation Calculator
    </button>
  </nav>

  {#if activeTab === "rates"}
    <RateCardCalculator department="art" />
  {:else}
    <InflationCalculator />
  {/if}
</main>

<style>
  main {
    max-width: 800px;
    margin: 0px auto;
  }

  .tabs {
    display: flex;
    gap: 0;
    margin-bottom: 2rem;
    border-bottom: 2px solid #dee2e6;
  }

  .tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    padding: 0.75rem 1.25rem;
    font-size: 1rem;
    cursor: pointer;
    color: #6c757d;
    transition: all 0.15s ease;
  }

  .tab:hover {
    color: #495057;
  }

  .tab.active {
    color: inherit;
    border-bottom-color: currentColor;
    font-weight: 600;
  }
</style>
