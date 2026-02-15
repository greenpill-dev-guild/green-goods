/**
 * useRolePermissions Hook Tests
 * @vitest-environment jsdom
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useRolePermissions } from "../../../hooks/roles/useRolePermissions";

describe("useRolePermissions", () => {
  it("returns empty permissions when no role is provided", () => {
    const { result } = renderHook(() => useRolePermissions());

    expect(result.current).toEqual({
      canSubmitWork: false,
      canApproveWork: false,
      canCreateAssessment: false,
      canManageRoles: false,
      canManageGarden: false,
    });
  });

  it("returns gardener permissions", () => {
    const { result } = renderHook(() => useRolePermissions("gardener"));

    expect(result.current).toEqual({
      canSubmitWork: true,
      canApproveWork: false,
      canCreateAssessment: false,
      canManageRoles: false,
      canManageGarden: false,
    });
  });

  it("returns evaluator permissions", () => {
    const { result } = renderHook(() => useRolePermissions("evaluator"));

    expect(result.current).toEqual({
      canSubmitWork: false,
      canApproveWork: true,
      canCreateAssessment: true,
      canManageRoles: false,
      canManageGarden: false,
    });
  });

  it("returns operator permissions", () => {
    const { result } = renderHook(() => useRolePermissions("operator"));

    expect(result.current).toEqual({
      canSubmitWork: true,
      canApproveWork: true,
      canCreateAssessment: true,
      canManageRoles: true,
      canManageGarden: false,
    });
  });

  it("returns owner permissions", () => {
    const { result } = renderHook(() => useRolePermissions("owner"));

    expect(result.current).toEqual({
      canSubmitWork: true,
      canApproveWork: true,
      canCreateAssessment: true,
      canManageRoles: true,
      canManageGarden: true,
    });
  });

  it("combines permissions for multiple roles", () => {
    const { result } = renderHook(() => useRolePermissions(["gardener", "evaluator"]));

    expect(result.current).toEqual({
      canSubmitWork: true,
      canApproveWork: true,
      canCreateAssessment: true,
      canManageRoles: false,
      canManageGarden: false,
    });
  });
});
