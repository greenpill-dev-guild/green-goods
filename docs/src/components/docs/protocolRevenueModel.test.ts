import assert from "node:assert/strict";
import {describe, test} from "node:test";
import {
  calculateRevenueSummary,
  computeTotalExpenses,
  getPresetInputs,
  getScenarioFromSearch,
  monteCarloProjection,
  projectRevenue,
  serializeScenarioToSearch,
  type RevenueExplorerInputs,
} from "./protocolRevenueModel";

function zeroInputs(): RevenueExplorerInputs {
  return {
    gardensPerYear: 0,
    gardenFee: 0,
    reportsPerYear: 0,
    reportFee: 0,
    cookieJarsPerYear: 0,
    cookieJarCreateFee: 0,
    cookieJarDepositVolume: 0,
    cookieJarTakeRate: 0,
    vaultTvl: 0,
    vaultApy: 0,
    yieldTakeRate: 0,
    hypercertMintsPerYear: 0,
    hypercertMintFee: 0,
    hypercertSalesVolume: 0,
    hypercertTakeRate: 0,
    grantsContracts: 0,
    licensing: 0,
    revnetRevenue: 0,
    protocolPrincipal: 0,
    principalApy: 0,
    teamCompensation: 0,
    infrastructure: 0,
    gasSponsorship: 0,
    legalCompliance: 0,
    operational: 0,
    operatorIncentives: 0,
    gardenerIncentives: 0,
    startingTreasury: 0,
    retroObligation: 0,
    retroCashPercent: 0,
    tokenSupply: 0,
    contributorAllocationPercent: 0,
    operatorAllocationPercent: 0,
    gardenerAllocationPercent: 0,
    revenueMultiple: 0,
  };
}

describe("protocolRevenueModel", () => {
  test("calculates annual revenue totals and break-even requirements", () => {
    const inputs = getPresetInputs("bootstrap");
    const summary = calculateRevenueSummary(inputs);

    assert.equal(summary.totalAnnualRevenue, 156910);
    assert.equal(summary.yieldFeeRevenue, 240);
    assert.equal(summary.endowmentYieldRevenue, 1250);
    assert.ok(Math.abs(summary.requiredTvl - 8333333.3333) < 0.001);
    assert.equal(summary.requiredPrincipal, 2000000);
    assert.equal(summary.stage.id, "bootstrap");
    // Expense breakdown sums to old targetAnnualOpex
    assert.equal(summary.totalExpenses, 100000);
  });

  test("serializes only non-default scenario values", () => {
    const inputs = getPresetInputs("hybrid");
    inputs.vaultTvl = 175000;
    inputs.grantsContracts = 0;

    const search = serializeScenarioToSearch("hybrid", inputs);

    assert.ok(search.includes("preset=hybrid"));
    assert.ok(search.includes("vaultTvl=175000"));
    assert.ok(search.includes("grantsContracts=0"));
    assert.ok(!search.includes("reportFee="));
  });

  test("restores scenario state from query params", () => {
    const scenario = getScenarioFromSearch("?preset=protocol-scale&vaultApy=8.5&licensing=120000");

    assert.equal(scenario.presetId, "protocol-scale");
    assert.equal(scenario.inputs.vaultApy, 8.5);
    assert.equal(scenario.inputs.licensing, 120000);
    assert.equal(scenario.inputs.gardenFee, 75);
  });

  test("provides a zero-state insight instead of rendering an empty insight panel", () => {
    const summary = calculateRevenueSummary(zeroInputs());
    assert.equal(summary.insights[0]?.title, "No revenue modeled");
  });

  // ── Expense and runway ──

  describe("expenses and runway", () => {
    test("computeTotalExpenses sums all 7 expense fields", () => {
      const inputs = getPresetInputs("bootstrap");
      assert.equal(computeTotalExpenses(inputs), 100000);

      const hybrid = getPresetInputs("hybrid");
      assert.equal(computeTotalExpenses(hybrid), 180000);

      const scale = getPresetInputs("protocol-scale");
      assert.equal(computeTotalExpenses(scale), 350000);
    });

    test("positive margin → infinite runway and positive savings", () => {
      const inputs = zeroInputs();
      inputs.grantsContracts = 200000;
      inputs.teamCompensation = 100000;
      inputs.startingTreasury = 50000;

      const summary = calculateRevenueSummary(inputs);

      assert.equal(summary.netMargin, 100000);
      assert.equal(summary.monthlySavings, 100000 / 12);
      assert.equal(summary.monthlyBurn, 0);
      assert.equal(summary.runwayMonths, Number.POSITIVE_INFINITY);
    });

    test("negative margin → finite runway and positive burn", () => {
      const inputs = zeroInputs();
      inputs.grantsContracts = 50000;
      inputs.teamCompensation = 100000;
      inputs.startingTreasury = 120000;

      const summary = calculateRevenueSummary(inputs);

      assert.equal(summary.netMargin, -50000);
      assert.equal(summary.monthlyBurn, 50000 / 12);
      assert.equal(summary.monthlySavings, 0);
      // runway = 120000 / (50000/12) = 28.8 months
      assert.ok(Math.abs(summary.runwayMonths - 28.8) < 0.01);
    });

    test("retro cash drain reduces treasury and runway", () => {
      const inputs = zeroInputs();
      inputs.grantsContracts = 50000;
      inputs.teamCompensation = 100000;
      inputs.startingTreasury = 120000;
      inputs.retroObligation = 80000;
      inputs.retroCashPercent = 50;
      // retro cash drain = 40000, adjusted treasury = 80000

      const summary = calculateRevenueSummary(inputs);

      assert.equal(summary.retroCashDrain, 40000);
      // treasury after 1yr = (120k - 40k) + (-50k) = 30k
      assert.equal(summary.treasuryAfterOneYear, 30000);
      // runway = 80000 / (50000/12) = 19.2 months
      assert.ok(Math.abs(summary.runwayMonths - 19.2) < 0.01);
    });
  });

  // ── Token upside ──

  describe("token upside", () => {
    test("token price scales linearly with revenue multiple", () => {
      const inputs = zeroInputs();
      inputs.grantsContracts = 100000;
      inputs.tokenSupply = 1000000;
      inputs.revenueMultiple = 10;

      const summary = calculateRevenueSummary(inputs);

      // valuation = 100k * 10 = 1M, price = 1M / 1M = $1
      assert.equal(summary.impliedValuation, 1000000);
      assert.equal(summary.tokenPrice, 1);
    });

    test("zero token supply → token price is 0", () => {
      const inputs = zeroInputs();
      inputs.grantsContracts = 100000;
      inputs.tokenSupply = 0;
      inputs.revenueMultiple = 10;

      const summary = calculateRevenueSummary(inputs);
      assert.equal(summary.tokenPrice, 0);
    });

    test("token price doubles when revenue multiple doubles", () => {
      const inputs = zeroInputs();
      inputs.grantsContracts = 100000;
      inputs.tokenSupply = 1000000;

      inputs.revenueMultiple = 5;
      const summary5 = calculateRevenueSummary(inputs);

      inputs.revenueMultiple = 10;
      const summary10 = calculateRevenueSummary(inputs);

      assert.equal(summary10.tokenPrice, summary5.tokenPrice * 2);
    });
  });

  // ── Stage classification ──

  describe("classifyStage", () => {
    test("grants >= 45% of revenue → bootstrap", () => {
      const inputs = zeroInputs();
      inputs.grantsContracts = 90000;
      inputs.gardensPerYear = 10;
      inputs.gardenFee = 100;
      inputs.teamCompensation = 100000;
      const summary = calculateRevenueSummary(inputs);
      assert.equal(summary.stage.id, "bootstrap");
    });

    test("offchain > onchain and coverage < 1 → bootstrap", () => {
      const inputs = zeroInputs();
      inputs.grantsContracts = 30000;
      inputs.licensing = 20000;
      inputs.gardensPerYear = 10;
      inputs.gardenFee = 100;
      inputs.teamCompensation = 100000;
      const summary = calculateRevenueSummary(inputs);
      assert.equal(summary.stage.id, "bootstrap");
    });

    test("onchain >= 85% of expenses, grants < 25%, coverage >= 1 → protocol-scale", () => {
      const inputs = zeroInputs();
      inputs.vaultTvl = 2000000;
      inputs.vaultApy = 8;
      inputs.yieldTakeRate = 15;
      inputs.hypercertSalesVolume = 1000000;
      inputs.hypercertTakeRate = 8;
      inputs.gardensPerYear = 100;
      inputs.gardenFee = 200;
      inputs.grantsContracts = 5000;
      inputs.teamCompensation = 100000;
      const summary = calculateRevenueSummary(inputs);
      assert.equal(summary.stage.id, "protocol-scale");
    });

    test("high coverage but grants >= 25% → hybrid", () => {
      const inputs = zeroInputs();
      inputs.vaultTvl = 1000000;
      inputs.vaultApy = 8;
      inputs.yieldTakeRate = 15;
      inputs.gardensPerYear = 50;
      inputs.gardenFee = 200;
      inputs.grantsContracts = 12000;
      inputs.teamCompensation = 30000;
      const summary = calculateRevenueSummary(inputs);
      assert.equal(summary.stage.id, "hybrid");
    });

    test("balanced onchain and offchain with coverage >= 1 → hybrid", () => {
      const inputs = zeroInputs();
      inputs.vaultTvl = 500000;
      inputs.vaultApy = 6;
      inputs.yieldTakeRate = 20;
      inputs.gardensPerYear = 30;
      inputs.gardenFee = 100;
      inputs.grantsContracts = 5000;
      inputs.licensing = 3000;
      inputs.teamCompensation = 15000;
      const summary = calculateRevenueSummary(inputs);
      assert.equal(summary.stage.id, "hybrid");
    });

    test("zero revenue with expenses → hybrid (fallthrough)", () => {
      const inputs = zeroInputs();
      inputs.teamCompensation = 100000;
      const summary = calculateRevenueSummary(inputs);
      assert.equal(summary.stage.id, "hybrid");
    });
  });

  // ── Projection ──

  describe("projectRevenue", () => {
    test("year 1 with zero growth matches single-point snapshot", () => {
      const inputs = getPresetInputs("bootstrap");
      const snapshot = calculateRevenueSummary(inputs);
      const projection = projectRevenue(inputs, {annualGrowthRate: 0, years: 1});

      assert.equal(projection.length, 1);
      assert.equal(projection[0].year, 1);
      assert.equal(projection[0].totalAnnualRevenue, snapshot.totalAnnualRevenue);
      assert.equal(projection[0].totalExpenses, snapshot.totalExpenses);
    });

    test("zero growth produces identical values across all years", () => {
      const inputs = getPresetInputs("hybrid");
      const projection = projectRevenue(inputs, {annualGrowthRate: 0, years: 5});

      assert.equal(projection.length, 5);
      const baseline = projection[0].totalAnnualRevenue;
      for (const yearData of projection) {
        assert.equal(yearData.totalAnnualRevenue, baseline);
      }
    });

    test("volume-driven streams scale with growth while fees stay fixed", () => {
      const inputs = getPresetInputs("bootstrap");
      const projection = projectRevenue(inputs, {annualGrowthRate: 100, years: 3});

      assert.equal(projection[0].streams["garden-fees"], 200);
      assert.equal(projection[1].streams["garden-fees"], 400);
      assert.equal(projection[2].streams["garden-fees"], 800);
    });

    test("expenses stay fixed across projection years", () => {
      const inputs = getPresetInputs("bootstrap");
      const projection = projectRevenue(inputs, {annualGrowthRate: 50, years: 5});

      for (const yearData of projection) {
        assert.equal(yearData.totalExpenses, 100000);
      }
    });

    test("output array length matches config.years", () => {
      const inputs = getPresetInputs("protocol-scale");
      const projection = projectRevenue(inputs, {annualGrowthRate: 10, years: 7});

      assert.equal(projection.length, 7);
      assert.equal(projection[0].year, 1);
      assert.equal(projection[6].year, 7);
    });
  });

  // ── Monte Carlo ──

  describe("monteCarloProjection", () => {
    test("returns correct number of year bands", () => {
      const inputs = getPresetInputs("bootstrap");
      const bands = monteCarloProjection(inputs, {
        annualGrowthRate: 15,
        volatility: 10,
        years: 5,
        simulations: 50,
      });

      assert.equal(bands.length, 5);
      assert.equal(bands[0].year, 1);
      assert.equal(bands[4].year, 5);
    });

    test("percentiles are ordered: p10 <= p25 <= p50 <= p75 <= p90", () => {
      const inputs = getPresetInputs("hybrid");
      const bands = monteCarloProjection(inputs, {
        annualGrowthRate: 15,
        volatility: 15,
        years: 5,
        simulations: 100,
      });

      for (const band of bands) {
        assert.ok(band.p10 <= band.p25, `Y${band.year}: p10 > p25`);
        assert.ok(band.p25 <= band.p50, `Y${band.year}: p25 > p50`);
        assert.ok(band.p50 <= band.p75, `Y${band.year}: p50 > p75`);
        assert.ok(band.p75 <= band.p90, `Y${band.year}: p75 > p90`);
      }
    });

    test("year 1 is deterministic (all percentiles equal)", () => {
      const inputs = getPresetInputs("bootstrap");
      const bands = monteCarloProjection(inputs, {
        annualGrowthRate: 20,
        volatility: 25,
        years: 3,
        simulations: 100,
      });

      assert.equal(bands[0].p10, bands[0].p90);
      assert.equal(bands[0].p50, bands[0].p10);
    });

    test("bands widen over time with non-zero volatility", () => {
      const inputs = getPresetInputs("hybrid");
      const bands = monteCarloProjection(inputs, {
        annualGrowthRate: 15,
        volatility: 20,
        years: 5,
        simulations: 200,
      });

      const spread2 = bands[1].p90 - bands[1].p10;
      const spread5 = bands[4].p90 - bands[4].p10;
      assert.ok(spread5 > spread2, `Y5 spread should exceed Y2 spread`);
    });

    test("zero volatility produces identical percentiles per year", () => {
      const inputs = getPresetInputs("protocol-scale");
      const bands = monteCarloProjection(inputs, {
        annualGrowthRate: 10,
        volatility: 0,
        years: 5,
        simulations: 50,
      });

      for (const band of bands) {
        assert.equal(band.p10, band.p90, `Y${band.year} should have zero spread`);
      }
    });
  });
});
