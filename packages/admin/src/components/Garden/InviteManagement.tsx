import { useGardenInvites } from "@green-goods/shared/hooks/garden";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { AddressDisplay } from "@/components/UI/AddressDisplay";
import { CreateInviteModal } from "./CreateInviteModal";

interface InviteManagementProps {
  gardenAddress: string;
}

export function InviteManagement({ gardenAddress }: InviteManagementProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { invites, isLoading, revokeInvite, isRevoking } = useGardenInvites(gardenAddress);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const activeInvites = (invites || []).filter((inv) => !inv.used);
  const usedInvites = (invites || []).filter((inv) => inv.used);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-text-strong">Garden Invitations</h3>
          <p className="mt-1 text-sm text-text-soft">
            Create and manage invite codes for new gardeners to join.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Invite
        </button>
      </div>

      {/* Active Invites */}
      <div>
        <h4 className="text-sm font-medium text-text-sub mb-3">
          Active Invites ({activeInvites.length})
        </h4>
        {activeInvites.length === 0 ? (
          <div className="text-center py-8 bg-bg-weak rounded-lg border-2 border-dashed border-stroke-sub">
            <svg
              className="mx-auto h-12 w-12 text-text-disabled"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <p className="mt-2 text-sm text-text-soft">No active invites</p>
            <p className="text-xs text-text-soft">Create an invite code to onboard new gardeners</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeInvites.map((invite) => (
              <div key={invite.id} className="bg-bg-white border border-stroke-soft rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-lighter text-success-dark">
                        Active
                      </span>
                      <span className="text-xs text-text-soft">
                        Created{" "}
                        {formatDistanceToNow(new Date(invite.createdAt * 1000), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-medium text-text-soft">Code:</span>
                        <code className="text-xs bg-bg-soft px-2 py-1 rounded font-mono">
                          {invite.id}
                        </code>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-text-sub">
                        <span>Creator:</span>
                        <AddressDisplay address={invite.creator} />
                      </div>
                      <div className="text-xs text-text-sub">
                        Expires: {new Date(Number(invite.expiry) * 1000).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => revokeInvite(invite.id)}
                    disabled={isRevoking}
                    className="ml-4 inline-flex items-center px-3 py-1.5 border border-error-light text-xs font-medium rounded text-error-dark bg-bg-white hover:bg-error-lighter focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-error-base disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Used Invites */}
      {usedInvites.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-text-sub mb-3">
            Used Invites ({usedInvites.length})
          </h4>
          <div className="space-y-3">
            {usedInvites.map((invite) => (
              <div
                key={invite.id}
                className="bg-bg-weak/50 border border-stroke-soft rounded-lg p-4 opacity-75"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-bg-soft text-text-strong">
                        Used
                      </span>
                      <span className="text-xs text-text-soft">
                        {invite.usedAt &&
                          formatDistanceToNow(new Date(invite.usedAt * 1000), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-medium text-text-soft">Code:</span>
                        <code className="text-xs bg-bg-soft px-2 py-1 rounded font-mono">
                          {invite.id}
                        </code>
                      </div>
                      {invite.usedBy && (
                        <div className="flex items-center space-x-2 text-xs text-text-sub">
                          <span>Used by:</span>
                          <AddressDisplay address={invite.usedBy} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Invite Modal */}
      <CreateInviteModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        gardenAddress={gardenAddress}
      />
    </div>
  );
}
