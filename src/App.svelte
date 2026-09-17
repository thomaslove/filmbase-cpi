<script lang="ts">
  import { tick } from "svelte";
  import InflationCalculator from "./lib/InflationCalculator.svelte";
  import RateCardCalculator from "./lib/RateCardCalculator.svelte";
  import RateCardTables from "./lib/RateCardTables.svelte";
  import { DEFAULT_API_BASE } from "./lib/apiBase";

  interface Props {
    department?: string;
    /** Mini mode: both calculators, but no promo callout and no rate cards below. */
    mini?: boolean;
    /** Folder holding the JSON data files; resolved by main.ts from the script's own URL. */
    apiBase?: string;
  }

  let { department = "art", mini = false, apiBase = DEFAULT_API_BASE }: Props = $props();

  // --- Debug: switch departments without editing the host page ---

  const DEPARTMENTS = ["art", "setdec", "props"];

  // On in development, and on a deployed build only when asked for with ?debug
  const showDebug =
    import.meta.env.DEV || (typeof location !== "undefined" && new URLSearchParams(location.search).has("debug"));

  let activeDepartment = $state(department);

  // Two tabs have to sit side by side on a phone, where "Rate Calculator" and
  // "Inflation Calculator" are too long to share the row -- on that width the
  // panel below says plainly enough which calculator it is
  const TABS = [
    { id: "rates", label: "Rate Calculator", short: "Rates", isNew: false },
    { id: "inflation", label: "Inflation Calculator", short: "Inflation", isNew: true },
  ] as const;

  type TabId = (typeof TABS)[number]["id"];

  let activeTab = $state<TabId>("rates");

  // Not persisted: hidden for this page view only, so it returns on next load
  let showCallout = $state(true);

  // Dismissing here too: once they have been taken to the tab, the pitch is spent
  async function goToInflation() {
    activeTab = "inflation";
    dismissCallout();
    // The callout (and the button inside it) is about to unmount, so move focus
    // onto the tab rather than letting it fall back to <body>
    await tick();
    document.getElementById("cpi-tab-inflation")?.focus();
  }

  function dismissCallout() {
    showCallout = false;
  }

  // Roving arrow-key navigation, as expected of a role="tablist"
  function onTabKeydown(e: KeyboardEvent, index: number) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + TABS.length) % TABS.length;
    activeTab = TABS[next].id;
    const el = e.currentTarget as HTMLElement;
    (el.parentElement?.children[next] as HTMLElement | undefined)?.focus();
  }
</script>

{#if showDebug}
  <div class="debug-bar">
    <span class="debug-tag">Debug</span>
    <label for="debug-department">Switch Rate Cards</label>
    <select id="debug-department" bind:value={activeDepartment}>
      {#each DEPARTMENTS as dept}
        <option value={dept}>{dept}</option>
      {/each}
    </select>
  </div>
{/if}

<main>
  <!-- The pitch for the inflation tab is page furniture, and mini is embedded
       somewhere with no room for it -->
  {#if showCallout && !mini}
    <aside class="callout" aria-labelledby="callout-title">
      <button type="button" class="callout-close" onclick={dismissCallout} aria-label="Dismiss">
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>

      <p class="callout-title" id="callout-title">
        <svg class="callout-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M13.5 1.5c.5 5.2 2.8 7.5 8 8-5.2.5-7.5 2.8-8 8-.5-5.2-2.8-7.5-8-8 5.2-.5 7.5-2.8 8-8z"
            fill="currentColor"
          />
          <path
            d="M5 14.5c.25 2.6 1.4 3.75 4 4-2.6.25-3.75 1.4-4 4-.25-2.6-1.4-3.75-4-4 2.6-.25 3.75-1.4 4-4z"
            fill="currentColor"
          />
        </svg>
        New Inflation Calculator
      </p>

      <div class="callout-row">
        <p class="callout-body">
          Enter a rate and when you agreed it, and see whether an offer has kept pace with inflation, or is quietly a
          pay cut.
        </p>

        <button type="button" class="callout-btn" onclick={goToInflation}>Check it out</button>
      </div>
    </aside>
  {/if}

  <div class="cpi-tabs" role="tablist" aria-label="Calculators">
    {#each TABS as tab, i}
      <button
        type="button"
        role="tab"
        id="cpi-tab-{tab.id}"
        class="cpi-tab"
        class:active={activeTab === tab.id}
        aria-selected={activeTab === tab.id}
        aria-controls="panel-{tab.id}"
        tabindex={activeTab === tab.id ? 0 : -1}
        onclick={() => (activeTab = tab.id)}
        onkeydown={(e) => onTabKeydown(e, i)}
      >
        <span class="cpi-tab-label-full">{tab.label}</span><span class="cpi-tab-label-short">{tab.short}</span>{#if tab.isNew}<span
            class="cpi-tab-badge"
            aria-hidden="true">New</span
          ><span class="visually-hidden">(new)</span>{/if}
      </button>
    {/each}
  </div>

  <!-- Both panels stay mounted and the inactive one is hidden, so switching
       tabs preserves each calculator's state instead of destroying it. -->
  <div
    id="panel-rates"
    class="panel"
    role="tabpanel"
    aria-labelledby="cpi-tab-rates"
    tabindex="-1"
    hidden={activeTab !== "rates"}
  >
    {#key activeDepartment}
      <RateCardCalculator department={activeDepartment} {apiBase} {mini} />
    {/key}
  </div>

  <div
    id="panel-inflation"
    class="panel"
    role="tabpanel"
    aria-labelledby="cpi-tab-inflation"
    tabindex="-1"
    hidden={activeTab !== "inflation"}
  >
    <InflationCalculator {apiBase} />
  </div>

  <!-- The full cards, below both calculators and outside the tab panels: they
       are reference material, not part of either tool. Mini is the calculators
       only, so it stops here. -->
  {#if !mini}
    {#key activeDepartment}
      <RateCardTables department={activeDepartment} {apiBase} />
    {/key}
  {/if}
</main>

<style>
  /* Test-only affordance: kept visibly apart from the page it sits above, and
     lined up with <main> rather than to its own width */
  .debug-bar {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    max-width: 900px;
    margin: 0 auto 1.25rem auto;
    padding: 0.75rem 1rem;
    background-color: #fdf6e3;
    border: 1px dashed #d8be6a;
    font-size: 12px;
    line-height: 1;
    color: #7a6420;
  }

  /* app.css sets Raleway on ".cpi-calc *" with !important, and the bar should
     not look like part of the page it is testing */
  :global(.cpi-calc) .debug-bar,
  :global(.cpi-calc) .debug-bar * {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace !important;
  }

  .debug-tag {
    display: block;
    padding: 4px 7px;
    background-color: #d8be6a;
    border-radius: 2px;
    color: #4a3c0d;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1;
    text-transform: uppercase;
  }

  :global(.cpi-calc) .debug-bar label {
    display: block;
    margin: 0;
    color: inherit;
    font-size: 12px;
    font-style: normal;
    line-height: 1;
    opacity: 0.85;
  }

  /* Outweighs the app-wide ".cpi-calc select" rules: the debug bar is not one
     of the calculator's own controls */
  :global(.cpi-calc) .debug-bar select {
    width: auto;
    min-width: 8rem;
    margin: 0;
    padding: 4px 8px;
    border: 1px solid #d8be6a;
    border-radius: 2px;
    background-color: #fff;
    color: inherit;
    font-family: inherit;
    font-size: 12px;
    line-height: 1.2;
    min-height: 0;
  }

  main {
    max-width: 900px;
    margin: 0px auto;
  }

  /* Introduces the newly added calculator; squared off to match the tabs/panel */
  .callout {
    position: relative;
    box-sizing: border-box;
    margin-bottom: 2rem;
    padding: 1.5rem;
    color: #fff;
    /* Blue bleeding into magenta-purple; the flat colour is the fallback and
       also what shows through where the two radial washes fade out */
    background-color: #2f1b66;
    background-image: radial-gradient(120% 140% at 3% 45%, rgba(124, 28, 104, 0.9) 0%, rgba(124, 28, 104, 0) 58%),
      radial-gradient(115% 150% at 99% 26%, rgba(24, 82, 150, 0.9) 0%, rgba(24, 82, 150, 0) 62%),
      linear-gradient(100deg, #4a1a5c 0%, #331a6e 46%, #17325f 100%);
  }

  /* The button is centred against the body copy alone, so they share a row and
     the title sits above it at full width */
  .callout-row {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .callout-title {
    display: flex;
    /* start, not center: the title wraps to two lines on narrow screens and the
       sparkle should sit against the first line, not the block's midpoint */
    align-items: flex-start;
    gap: 0.6rem;
    /* keeps a long title clear of the corner X */
    padding-right: 2rem;
    margin: 0 0 0.75rem 0;
    font-size: 1.0625rem;
    font-weight: 700;
    line-height: 1.35;
  }

  .callout-icon {
    flex: none;
    width: 22px;
    height: 22px;
    color: rgba(255, 255, 255, 0.85);
  }

  .callout-body {
    flex: 1 1 auto;
    min-width: 0;
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.92);
  }

  .callout-btn {
    flex: none;
    /* inline-flex + line-height 1: uppercase text has no descenders, so a 1.4
       line box leaves dead space underneath and the label rides high */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1.4rem;
    border: 1px solid rgba(255, 255, 255, 0.9);
    border-radius: 0;
    background-color: rgba(255, 255, 255, 0.1);
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
    color: #fff;
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease;
  }

  .callout-btn:hover {
    background-color: rgba(255, 255, 255, 0.22);
    border-color: #fff;
  }

  .callout-btn:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }

  .callout-close {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 0;
    background-color: transparent;
    color: rgba(255, 255, 255, 0.75);
    cursor: pointer;
    transition:
      color 0.2s ease,
      background-color 0.2s ease;
  }

  .callout-close svg {
    width: 14px;
    height: 14px;
  }

  .callout-close:hover {
    color: #fff;
    background-color: rgba(255, 255, 255, 0.16);
  }

  .callout-close:focus-visible {
    outline: 2px solid #fff;
    outline-offset: -2px;
  }

  /* Tabs sit directly on top of the panel; the active one merges into it */
  .cpi-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    margin: 0;
  }

  .cpi-tab {
    /* basis 0, so the two tabs split the row evenly rather than sizing to
       their labels -- the "New" badge made one of them wider */
    flex: 1 1 0;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-width: 112px;
    margin: 0;
    padding: 10px 20px;
    border: none;
    border-top: 3px solid transparent;
    border-radius: 0;
    background-color: #e4e4e8;
    color: #676767;
    font-size: 16px;
    font-weight: 600;
    line-height: 1.5;
    text-align: center;
    text-transform: uppercase;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background-color 0.25s ease,
      color 0.25s ease,
      border-color 0.25s ease;
  }

  /* Only one of the two labels is ever in the layout, so the hidden one is out
     of the accessibility tree too and the tab is announced once */
  .cpi-tab-label-short {
    display: none;
  }

  /* Flags the recently added calculator; uppercased by .cpi-tab's text-transform */
  .cpi-tab .cpi-tab-badge {
    flex: none;
    padding: 2px 6px;
    border-radius: 999px;
    background-color: #8e1b7e;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    line-height: 1.4;
  }

  @media (pointer: coarse) {
    .callout-btn {
      min-height: 44px;
    }

    .callout-close {
      width: 44px;
      height: 44px;
    }
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

  .cpi-tab:hover {
    background-color: #ededf0;
    color: #371e79;
  }

  .cpi-tab:focus-visible {
    outline: 2px solid #8e1b7e;
    outline-offset: -2px;
  }

  /* Selected tab takes the panel's colour so the two read as one surface */
  .cpi-tab.active {
    background-color: #f6f6f6;
    border-top-color: #371e79;
    color: #371e79;
    cursor: default;
  }

  /* Even 2rem gutter on all four sides; the intro block spaces itself below */
  .panel {
    background-color: #f6f6f6;
    padding: 2rem;
  }

  /* `hidden` must win over .panel's display, or the inactive panel stays visible */
  .panel[hidden] {
    display: none;
  }

  .panel:focus {
    outline: none;
  }

  @container cpi (max-width: 640px) {
    .callout {
      padding: 1.25rem;
    }

    /* Not enough width for copy and button side by side */
    .callout-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 1.25rem;
    }

    .callout-title {
      font-size: 1rem;
      gap: 0.5rem;
    }

    .callout-body {
      font-size: 0.875rem;
    }

    /* More above than beside: the tab strip sits directly on the panel, so the
       heading underneath needs room to clear it */
    .panel {
      padding: 2rem 1.25rem 1.25rem;
    }

    .cpi-tab {
      padding: 10px 12px;
      font-size: 15px;
      /* Keep the pill from crowding the two side-by-side tabs */
      gap: 0.4rem;
      /* The short labels have no floor to hold any more, and 112px each plus a
         badge overflowed the row on the narrowest phones */
      min-width: 0;
      /* Each tab takes its own label plus an even share of what is left over,
         rather than a flat half each. With the badge on one side only, halves
         left "Rates" swimming in slack while "Inflation" ran up against its
         edges; sharing the surplus instead gives the two the same breathing
         room and keeps the divide off-centre by only as much as the pill. */
      flex: 1 1 auto;
    }

    .cpi-tab-label-full {
      display: none;
    }

    .cpi-tab-label-short {
      display: inline;
    }

    .cpi-tab .cpi-tab-badge {
      padding: 1px 5px;
      font-size: 10px;
    }
  }

</style>
