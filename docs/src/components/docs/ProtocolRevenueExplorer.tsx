import {lazy, Suspense, useEffect, useMemo, useRef, useState} from "react";
import styles from "./ProtocolRevenueExplorer.module.css";
import {
  calculateRevenueSummary,
  computeTotalExpenses,
  getPresetInputs,
  getScenarioFromSearch,
  INPUT_SECTIONS,
  monteCarloProjection,
  projectRevenue,
  type RevenueFieldKey,
  type RevenuePresetId,
  REVENUE_PRESETS,
  serializeScenarioToSearch,
} from "./protocolRevenueModel";

const RevenueProjectionChart = lazy(() =>
  import("./RevenueProjectionChart").then((m) => ({default: m.RevenueProjectionChart})),
);

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const compactMoneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const STREAM_COLORS = [
  "#2f8f5b",
  "#6ab47b",
  "#9fc676",
  "#d7bb69",
  "#d28d46",
  "#9cb7e7",
  "#c98ec9",
  "#60716b",
  "#8e8c86",
  "#4c8bd8",
  "#c46358",
];

type DisplayMode = "annual" | "monthly";

const PRESET_IDS: RevenuePresetId[] = ["bootstrap", "hybrid", "protocol-scale"];

export function ProtocolRevenueExplorer() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const initialScenario = useMemo(() => getScenarioFromSearch(window.location.search), []);
  const initialGrowth = useMemo(() => {
    const raw = new URLSearchParams(window.location.search).get("growth");
    return raw !== null && Number.isFinite(Number(raw)) ? Number(raw) : 15;
  }, []);
  const [presetId, setPresetId] = useState<RevenuePresetId>(initialScenario.presetId);
  const [inputs, setInputs] = useState(initialScenario.inputs);
  const [growthRate, setGrowthRate] = useState(initialGrowth);
  const [volatility, setVolatility] = useState(10);
  const [copyLabel, setCopyLabel] = useState("Copy link");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("annual");

  const divisor = displayMode === "monthly" ? 12 : 1;
  const periodLabel = displayMode === "monthly" ? "/ mo" : "/ yr";

  const summary = useMemo(() => calculateRevenueSummary(inputs), [inputs]);
  const visibleStreams = useMemo(
    () => summary.streams.filter((stream) => stream.amount > 0),
    [summary.streams],
  );
  const projectionData = useMemo(
    () => projectRevenue(inputs, {annualGrowthRate: growthRate, years: 5}),
    [inputs, growthRate],
  );
  const mcBands = useMemo(
    () =>
      volatility > 0
        ? monteCarloProjection(inputs, {
            annualGrowthRate: growthRate,
            volatility,
            years: 5,
            simulations: 300,
          })
        : undefined,
    [inputs, growthRate, volatility],
  );

  const presetSummaries = useMemo(
    () =>
      PRESET_IDS.map((id) => ({
        id,
        label: REVENUE_PRESETS[id].label,
        summary: calculateRevenueSummary(getPresetInputs(id)),
      })),
    [],
  );

  // Token upside per stage — uses current token params but each stage's revenue
  const upsideByStage = useMemo(() => {
    return PRESET_IDS.map((id) => {
      const stageInputs = getPresetInputs(id);
      const stageSummary = calculateRevenueSummary(stageInputs);
      const valuation = stageSummary.totalAnnualRevenue * inputs.revenueMultiple;
      const price = inputs.tokenSupply > 0 ? valuation / inputs.tokenSupply : 0;
      return {
        id,
        label: REVENUE_PRESETS[id].label,
        valuation,
        price,
        contributorValue: price * inputs.tokenSupply * (inputs.contributorAllocationPercent / 100),
        operatorValue: price * inputs.tokenSupply * (inputs.operatorAllocationPercent / 100),
        gardenerValue: price * inputs.tokenSupply * (inputs.gardenerAllocationPercent / 100),
      };
    });
  }, [inputs.revenueMultiple, inputs.tokenSupply, inputs.contributorAllocationPercent, inputs.operatorAllocationPercent, inputs.gardenerAllocationPercent]);

  useEffect(() => {
    const nextSearch = serializeScenarioToSearch(presetId, inputs);
    const params = new URLSearchParams(nextSearch);
    if (growthRate !== 15) params.set("growth", String(growthRate));
    if (volatility !== 10) params.set("vol", String(volatility));
    const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
  }, [inputs, presetId, growthRate, volatility]);

  useEffect(() => {
    if (copyLabel === "Copy link") return undefined;
    const timeout = window.setTimeout(() => setCopyLabel("Copy link"), 1800);
    return () => window.clearTimeout(timeout);
  }, [copyLabel]);

  const splitRows = [
    {label: "Onchain", value: summary.onchainRevenue, color: "#2f8f5b"},
    {label: "Offchain", value: summary.offchainRevenue, color: "#8e8c86"},
  ].filter((row) => row.value > 0);

  const handlePresetChange = (nextPresetId: RevenuePresetId) => {
    setPresetId(nextPresetId);
    setInputs(getPresetInputs(nextPresetId));
  };

  const handleInputChange = (key: RevenueFieldKey, value: string) => {
    const parsed = Number(value);
    setInputs((current) => ({
      ...current,
      [key]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
    }));
  };

  const handleReset = () => setInputs(getPresetInputs(presetId));

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyLabel("Copied!");
    } catch {
      setCopyLabel("Unavailable");
    }
  };

  const handleExport = async () => {
    const payload = {
      preset: presetId,
      inputs,
      growthRate,
      volatility,
      computed: {
        totalAnnualRevenue: summary.totalAnnualRevenue,
        totalExpenses: summary.totalExpenses,
        netMargin: summary.netMargin,
        onchainRevenue: summary.onchainRevenue,
        offchainRevenue: summary.offchainRevenue,
        coverageRatio: summary.coverageRatio,
        runwayMonths: summary.runwayMonths,
        treasuryAfterOneYear: summary.treasuryAfterOneYear,
        retroCashDrain: summary.retroCashDrain,
        requiredTvl: summary.requiredTvl,
        requiredPrincipal: summary.requiredPrincipal,
        impliedValuation: summary.impliedValuation,
        tokenPrice: summary.tokenPrice,
        stage: summary.stage.id,
      },
      exportedAt: new Date().toISOString(),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopyLabel("JSON copied!");
    } catch {
      setCopyLabel("Unavailable");
    }
  };

  const openDialog = () => dialogRef.current?.showModal();
  const closeDialog = () => dialogRef.current?.close();
  const fmt = (v: number) => formatMoney(v / divisor);
  const fmtCap = (v: number) => formatCapital(v / divisor);

  const renderPresetPills = () => (
    <div className={styles.presetPills} role="radiogroup" aria-label="Scenario presets">
      {Object.values(REVENUE_PRESETS).map((preset) => (
        <button
          key={preset.id}
          type="button"
          role="radio"
          aria-checked={preset.id === presetId}
          className={`${styles.pill} ${preset.id === presetId ? styles.pillActive : ""}`}
          onClick={() => handlePresetChange(preset.id)}
          title={preset.description}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );

  const renderMixBar = () =>
    visibleStreams.length > 0 ? (
      <div className={styles.mixBar} aria-hidden="true">
        {visibleStreams.map((stream, index) => (
          <div
            key={stream.key}
            className={styles.mixSegment}
            style={{
              width: `${(stream.amount / summary.totalAnnualRevenue) * 100}%`,
              background: STREAM_COLORS[index % STREAM_COLORS.length],
            }}
            title={`${stream.label}: ${fmt(stream.amount)}`}
          />
        ))}
      </div>
    ) : null;

  const renderDisplayToggle = () => (
    <div className={styles.displayToggle} role="radiogroup" aria-label="Display period">
      <button
        type="button"
        role="radio"
        aria-checked={displayMode === "annual"}
        className={`${styles.toggleBtn} ${displayMode === "annual" ? styles.toggleActive : ""}`}
        onClick={() => setDisplayMode("annual")}
      >
        Annual
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={displayMode === "monthly"}
        className={`${styles.toggleBtn} ${displayMode === "monthly" ? styles.toggleActive : ""}`}
        onClick={() => setDisplayMode("monthly")}
      >
        Monthly
      </button>
    </div>
  );

  return (
    <div className={styles.shell}>
      {/* ─── Inline Summary Card (Glance Layer) ─── */}
      <section className={styles.inlineCard} aria-label="Revenue scenario summary">
        <div className={styles.inlineTop}>
          {renderPresetPills()}
          <button type="button" className={styles.openButton} onClick={openDialog}>
            Open explorer
          </button>
        </div>

        <div className={styles.inlineBody}>
          <div className={styles.inlineHero}>
            <span className={styles.stageBadgeInline}>{summary.stage.label}</span>
            <span className={styles.inlineRevenue}>
              {fmt(summary.totalAnnualRevenue)}
            </span>
            <span className={styles.inlineRevenueLabel}>revenue {periodLabel}</span>
          </div>

          <div className={styles.inlineKpis}>
            <div className={styles.inlineKpi}>
              <span className={styles.inlineKpiLabel}>Net margin</span>
              <span className={`${styles.inlineKpiValue} ${summary.netMargin >= 0 ? styles.marginPositive : styles.marginNegative}`}>
                {fmt(summary.netMargin)}
              </span>
            </div>
            <div className={styles.inlineKpi}>
              <span className={styles.inlineKpiLabel}>Coverage</span>
              <span className={styles.inlineKpiValue}>
                {percentFormatter.format(summary.coverageRatio)}
              </span>
            </div>
            <div className={styles.inlineKpi}>
              <span className={styles.inlineKpiLabel}>Runway</span>
              <span className={styles.inlineKpiValue}>
                {Number.isFinite(summary.runwayMonths) ? `${Math.round(summary.runwayMonths)}mo` : "∞"}
              </span>
            </div>
            <div className={styles.inlineKpi}>
              <span className={styles.inlineKpiLabel}>Token price</span>
              <span className={styles.inlineKpiValue}>
                {summary.tokenPrice > 0 ? `$${summary.tokenPrice.toFixed(4)}` : "—"}
              </span>
            </div>
          </div>
        </div>

        {renderMixBar()}

        {visibleStreams.length > 0 && (
          <div className={styles.inlineLegend}>
            {visibleStreams.map((stream, index) => (
              <span key={stream.key} className={styles.legendItem}>
                <span
                  className={styles.legendDot}
                  style={{background: STREAM_COLORS[index % STREAM_COLORS.length]}}
                />
                {stream.label}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ─── Full Explorer Dialog (Deep Dive / Z4 Layer) ─── */}
      <dialog ref={dialogRef} className={styles.dialog} aria-label="Protocol Revenue Explorer">
        <div className={styles.dialogShell}>
          <header className={styles.dialogToolbar}>
            {renderPresetPills()}
            <div className={styles.toolbarActions}>
              {renderDisplayToggle()}
              <button type="button" className={styles.toolbarBtn} onClick={handleReset}>
                Reset
              </button>
              <button type="button" className={styles.toolbarBtn} onClick={handleCopyLink}>
                {copyLabel}
              </button>
              <button type="button" className={styles.toolbarBtn} onClick={handleExport}>
                Export
              </button>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={closeDialog}
                aria-label="Close explorer"
              >
                ✕
              </button>
            </div>
          </header>

          <div className={styles.dialogBody}>
            <section className={styles.inputPane} aria-label="Revenue assumptions">
              {INPUT_SECTIONS.map((section) => (
                <div key={section.title} className={styles.inputSection}>
                  <h3 className={styles.inputSectionTitle}>{section.title}</h3>
                  <div className={styles.compactGrid}>
                    {section.fields.map((field) => (
                      <label
                        key={field.key}
                        className={styles.compactField}
                        title={field.description}
                      >
                        <span className={styles.compactLabel}>{field.label}</span>
                        <span className={styles.compactControl}>
                          {field.prefix ? (
                            <span className={styles.compactAffix}>{field.prefix}</span>
                          ) : null}
                          <input
                            className={`${styles.compactInput} ${field.prefix ? styles.hasPrefix : ""} ${field.suffix ? styles.hasSuffix : ""}`}
                            type="number"
                            min={field.min ?? 0}
                            step={field.step}
                            value={inputs[field.key]}
                            onChange={(e) => handleInputChange(field.key, e.target.value)}
                          />
                          {field.suffix ? (
                            <span className={`${styles.compactAffix} ${styles.compactSuffix}`}>
                              {field.suffix}
                            </span>
                          ) : null}
                        </span>
                        {field.max != null && (
                          <input
                            className={styles.slider}
                            type="range"
                            min={field.min ?? 0}
                            max={field.max}
                            step={field.step}
                            value={inputs[field.key]}
                            onChange={(e) => handleInputChange(field.key, e.target.value)}
                            aria-label={`${field.label} slider`}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            <aside className={styles.resultPane} aria-label="Scenario outputs">
              {/* Summary panel */}
              <div className={styles.summaryPanel}>
                <div className={styles.stageBadge}>{summary.stage.label}</div>
                <h3 className={styles.summaryHeading}>
                  {fmt(summary.totalAnnualRevenue)}
                  <span className={styles.summaryPeriod}>{periodLabel}</span>
                </h3>
                <p className={styles.summarySubhead}>{summary.stage.description}</p>

                <div className={styles.kpiGrid}>
                  <div className={styles.kpi}>
                    <span className={styles.kpiLabel}>Coverage</span>
                    <span className={styles.kpiValue}>
                      {percentFormatter.format(summary.coverageRatio)}
                    </span>
                  </div>
                  <div className={styles.kpi}>
                    <span className={styles.kpiLabel}>Yield take</span>
                    <span className={styles.kpiValue}>
                      {fmt(summary.yieldFeeRevenue)}
                    </span>
                  </div>
                  <div className={styles.kpi}>
                    <span className={styles.kpiLabel}>Required TVL</span>
                    <span className={styles.kpiValue}>
                      {formatCapital(summary.requiredTvl)}
                    </span>
                  </div>
                  <div className={styles.kpi}>
                    <span className={styles.kpiLabel}>Required principal</span>
                    <span className={styles.kpiValue}>
                      {formatCapital(summary.requiredPrincipal)}
                    </span>
                  </div>
                </div>

                {summary.coverageRatio < 1 && summary.totalAnnualRevenue > 0 && (
                  <div className={styles.breakeven}>
                    Break-even at{" "}
                    <strong>{formatCapital(summary.requiredTvl)}</strong> TVL (yield-only)
                    {" or "}
                    <strong>{formatCapital(summary.requiredPrincipal)}</strong> principal (endowment-only)
                  </div>
                )}
              </div>

              {/* Runway panel */}
              <div className={styles.panel}>
                <h3 className={styles.panelTitle}>Runway & treasury</h3>
                <div className={styles.runwayGrid}>
                  <div className={styles.runwayItem}>
                    <span className={styles.runwayLabel}>Net margin</span>
                    <span className={`${styles.runwayValue} ${summary.netMargin >= 0 ? styles.marginPositive : styles.marginNegative}`}>
                      {fmt(summary.netMargin)} {periodLabel}
                    </span>
                  </div>
                  <div className={styles.runwayItem}>
                    <span className={styles.runwayLabel}>
                      {summary.netMargin >= 0 ? "Monthly savings" : "Monthly burn"}
                    </span>
                    <span className={`${styles.runwayValue} ${summary.netMargin >= 0 ? styles.marginPositive : styles.marginNegative}`}>
                      {formatMoney(summary.netMargin >= 0 ? summary.monthlySavings : summary.monthlyBurn)}
                    </span>
                  </div>
                  <div className={styles.runwayItem}>
                    <span className={styles.runwayLabel}>Runway</span>
                    <span className={styles.runwayValue}>
                      {Number.isFinite(summary.runwayMonths)
                        ? `${Math.round(summary.runwayMonths)} months`
                        : "Sustainable"}
                    </span>
                  </div>
                  <div className={styles.runwayItem}>
                    <span className={styles.runwayLabel}>Treasury after 1yr</span>
                    <span className={`${styles.runwayValue} ${summary.treasuryAfterOneYear >= 0 ? styles.marginPositive : styles.marginNegative}`}>
                      {formatMoney(summary.treasuryAfterOneYear)}
                    </span>
                  </div>
                  {summary.retroCashDrain > 0 && (
                    <div className={styles.runwayItem}>
                      <span className={styles.runwayLabel}>Retro cash drain</span>
                      <span className={`${styles.runwayValue} ${styles.marginNegative}`}>
                        -{formatMoney(summary.retroCashDrain)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Preset comparison */}
              <div className={styles.panel}>
                <h3 className={styles.panelTitle}>Preset comparison</h3>
                <div className={styles.comparisonGrid}>
                  {presetSummaries.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`${styles.comparisonCell} ${p.id === presetId ? styles.comparisonActive : ""}`}
                      onClick={() => handlePresetChange(p.id)}
                    >
                      <span className={styles.comparisonLabel}>{p.label}</span>
                      <span className={styles.comparisonRevenue}>
                        {fmt(p.summary.totalAnnualRevenue)}
                      </span>
                      <span className={styles.comparisonMeta}>
                        {percentFormatter.format(p.summary.coverageRatio)} coverage
                      </span>
                      <span className={styles.comparisonMeta}>
                        {percentFormatter.format(
                          p.summary.totalAnnualRevenue > 0
                            ? p.summary.onchainRevenue / p.summary.totalAnnualRevenue
                            : 0,
                        )}{" "}
                        onchain
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Projection chart */}
              <div className={styles.panel}>
                <h3 className={styles.panelTitle}>Revenue projection</h3>
                <div className={styles.projectionControls}>
                  <label className={styles.compactField} title="Compound annual growth applied to volumes and counts">
                    <span className={styles.compactLabel}>Growth</span>
                    <span className={styles.compactControl}>
                      <input
                        className={`${styles.compactInput} ${styles.hasSuffix}`}
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={growthRate}
                        onChange={(e) =>
                          setGrowthRate(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                        }
                      />
                      <span className={`${styles.compactAffix} ${styles.compactSuffix}`}>%</span>
                    </span>
                    <input
                      className={styles.slider}
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={growthRate}
                      onChange={(e) => setGrowthRate(Number(e.target.value))}
                      aria-label="Growth rate slider"
                    />
                  </label>
                  <label className={styles.compactField} title="Standard deviation of annual growth for Monte Carlo simulation">
                    <span className={styles.compactLabel}>Volatility</span>
                    <span className={styles.compactControl}>
                      <input
                        className={`${styles.compactInput} ${styles.hasSuffix}`}
                        type="number"
                        min={0}
                        max={50}
                        step={1}
                        value={volatility}
                        onChange={(e) =>
                          setVolatility(Math.min(50, Math.max(0, Number(e.target.value) || 0)))
                        }
                      />
                      <span className={`${styles.compactAffix} ${styles.compactSuffix}`}>%</span>
                    </span>
                    <input
                      className={styles.slider}
                      type="range"
                      min={0}
                      max={50}
                      step={1}
                      value={volatility}
                      onChange={(e) => setVolatility(Number(e.target.value))}
                      aria-label="Volatility slider"
                    />
                  </label>
                </div>
                <div className={styles.chartContainer}>
                  <Suspense fallback={null}>
                    <RevenueProjectionChart
                      projectionData={projectionData}
                      visibleStreams={visibleStreams}
                      streamColors={STREAM_COLORS}
                      bands={mcBands}
                      totalExpenses={summary.totalExpenses}
                    />
                  </Suspense>
                </div>
              </div>

              {/* Revenue mix */}
              <div className={styles.panel}>
                <h3 className={styles.panelTitle}>Revenue mix</h3>
                {renderMixBar()}
                {visibleStreams.length > 0 ? (
                  <div className={styles.streamList}>
                    {visibleStreams.map((stream, index) => (
                      <div key={stream.key} className={styles.streamRow}>
                        <span className={styles.streamLabel}>
                          <span
                            className={styles.legendDot}
                            style={{
                              background: STREAM_COLORS[index % STREAM_COLORS.length],
                            }}
                          />
                          {stream.label}
                        </span>
                        <span className={styles.streamValue}>
                          {fmt(stream.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.emptyRow}>
                    Set at least one stream to see the breakdown.
                  </p>
                )}
              </div>

              {splitRows.length > 0 && (
                <div className={styles.panel}>
                  <h3 className={styles.panelTitle}>Onchain vs offchain</h3>
                  <div className={styles.splitList}>
                    {splitRows.map((row) => (
                      <div key={row.label} className={styles.splitRow}>
                        <div className={styles.splitMeta}>
                          <span>{row.label}</span>
                          <span>
                            {fmt(row.value)}{" "}
                            {summary.totalAnnualRevenue > 0
                              ? `(${percentFormatter.format(row.value / summary.totalAnnualRevenue)})`
                              : ""}
                          </span>
                        </div>
                        <div className={styles.splitTrack} aria-hidden="true">
                          <div
                            className={styles.splitFill}
                            style={{
                              width: `${summary.totalAnnualRevenue > 0 ? (row.value / summary.totalAnnualRevenue) * 100 : 0}%`,
                              background: row.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Token upside */}
              {inputs.tokenSupply > 0 && inputs.revenueMultiple > 0 && (
                <div className={styles.panel}>
                  <h3 className={styles.panelTitle}>Token upside by stage</h3>
                  <div className={styles.upsideGrid}>
                    <div className={styles.upsideHeader} />
                    {upsideByStage.map((s) => (
                      <div key={s.id} className={styles.upsideHeader}>{s.label}</div>
                    ))}
                    <div className={styles.upsideRowLabel}>Contributor</div>
                    {upsideByStage.map((s) => (
                      <div key={s.id} className={styles.upsideCell}>
                        {formatCapital(s.contributorValue)}
                      </div>
                    ))}
                    <div className={styles.upsideRowLabel}>Operator</div>
                    {upsideByStage.map((s) => (
                      <div key={s.id} className={styles.upsideCell}>
                        {formatCapital(s.operatorValue)}
                      </div>
                    ))}
                    <div className={styles.upsideRowLabel}>Gardener</div>
                    {upsideByStage.map((s) => (
                      <div key={s.id} className={styles.upsideCell}>
                        {formatCapital(s.gardenerValue)}
                      </div>
                    ))}
                    <div className={styles.upsideRowLabel}>Token price</div>
                    {upsideByStage.map((s) => (
                      <div key={s.id} className={styles.upsideCell}>
                        ${s.price.toFixed(4)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {summary.insights.length > 0 && (
                <details className={styles.panel}>
                  <summary className={styles.panelTitle}>Insights</summary>
                  <div className={styles.insightList}>
                    {summary.insights.map((insight) => (
                      <p key={insight.title} className={styles.insightCompact}>
                        <strong>{insight.title}</strong> — {insight.body}
                      </p>
                    ))}
                  </div>
                </details>
              )}
            </aside>
          </div>
        </div>
      </dialog>
    </div>
  );
}

function formatMoney(value: number): string {
  return moneyFormatter.format(value);
}

function formatCapital(value: number): string {
  if (!Number.isFinite(value)) return "N/A";
  return value >= 1000000 ? compactMoneyFormatter.format(value) : moneyFormatter.format(value);
}
