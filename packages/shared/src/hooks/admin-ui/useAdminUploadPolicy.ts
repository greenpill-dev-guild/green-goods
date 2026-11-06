import { createContext, useContext } from "react";

type AuthorizeAdminUpload = () => Promise<boolean>;

export const AdminUploadPolicyContext = createContext<AuthorizeAdminUpload | null>(null);

const unavailable: AuthorizeAdminUpload = async () => false;

/** Returns false when the member skips or cancels the required agreement. */
export function useAdminUploadPolicy(): AuthorizeAdminUpload {
  return useContext(AdminUploadPolicyContext) ?? unavailable;
}
