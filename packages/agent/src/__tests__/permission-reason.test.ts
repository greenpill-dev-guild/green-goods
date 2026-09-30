import { describe, expect, it } from "vitest";
import { publicPermissionReason } from "../handlers/permission-reason";

describe("publicPermissionReason", () => {
  it("localizes safe permission reasons", () => {
    expect(publicPermissionReason("es", "Address is not a steward for this garden")).toBe(
      "Esta dirección no es steward de este jardín."
    );
    expect(publicPermissionReason("pt", "Garden contract not found at this address")).toBe(
      "Contrato do jardim não encontrado neste endereço."
    );
  });

  it("keeps unsafe permission reasons generic", () => {
    expect(publicPermissionReason("en", "Verification failed: RPC upstream token secret")).toBe(
      "You don't have permission for this action."
    );
  });
});
