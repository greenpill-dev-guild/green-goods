# Triage Eval: P3/P4 Enhancement Request

## Issue Report

**Title**: Add map view for gardens in the client app

**Reporter**: Community member via GitHub Discussions

**Body**:

It would be great to have a map view in the client app that shows gardens plotted on an interactive map based on their location coordinates. Right now the gardens list is a simple card grid sorted alphabetically, and there's no way to discover gardens near you.

**Proposed features**:

1. A toggle button on the garden list view to switch between "List" and "Map" modes
2. Map pins for each garden using their latitude/longitude from the garden metadata
3. Clicking a pin shows a popup with the garden name, description preview, and a "View Garden" link
4. Optional: use the device's geolocation API to center the map on the user's location
5. Cluster pins when zoomed out to avoid visual clutter

**Existing data**: Garden metadata already includes `location` as a string field (e.g., "Portland, OR" or "Berlin, Germany"). This would need to be geocoded to lat/lng coordinates, or the garden creation form could be updated to capture coordinates directly.

**Libraries considered**: Mapbox GL JS, Leaflet, or Google Maps. Mapbox has the best React integration with `react-map-gl`.

**Labels**: enhancement, client, ui, feature-request

## Expected Classification

### Classification
- **Severity**: `P4`
- **Type**: `enhancement`
- **Complexity**: `high`

### Affected Packages
- `client` (new map view component, garden list view toggle)
- `shared` (potentially: geocoding utility, garden location type extension)

### Rationale

This is P3/P4 because:
1. **No existing functionality is broken** — the garden list works correctly
2. **No user-facing degradation** — this is a net-new feature, not a fix
3. **High implementation complexity** — requires new dependency (map library), geocoding service integration, location data migration, and responsive mobile-first map UI
4. **No current user complaints** — this came from a feature suggestion, not a bug report
5. **Location data gap** — existing `location` field is a free-text string, not geocoded coordinates, adding migration complexity

### Expected Route
- Entry point: `/plan` with `react`, `frontend-design` skills
- This needs a design spec and architecture plan before any implementation
- Should consider: map library bundle size impact (Mapbox GL JS is ~200KB gzipped — may blow the 400KB JS budget), geocoding API costs, privacy implications of device geolocation

### Context for Next Agent
Feature request for a map view in the client garden list. Requires: (1) plan for map library selection considering bundle budget, (2) garden location data migration from free-text to coordinates, (3) responsive mobile-first map component, (4) geocoding service integration. Start with a plan — do not implement directly.

## Passing Criteria

- Severity MUST be `P3` or `P4` (not P2 — no existing functionality is degraded)
- Type MUST be `enhancement` or `feature`
- Complexity MUST be `high` (new dependency, data migration, multiple subsystems)
- Must identify `client` as the primary affected package
- Must route to `/plan` (not directly to implementation)
- Should NOT provide implementation guidance (triage is classification only)

## Common Failure Modes

- Classifying as P2 (confusing "would be nice" with "degraded experience")
- Classifying complexity as `medium` (underestimating the geocoding, data migration, and bundle impact)
- Providing implementation advice (choosing a map library, writing component code) instead of just classifying
- Missing the bundle size concern (400KB total JS budget is a real constraint)
- Routing to `/debug` or `/review` instead of `/plan`
