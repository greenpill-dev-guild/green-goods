import React from "react";
import toast from "react-hot-toast";

interface TextAddressProps {
  address: string;
  ens?: string;
  className?: string;
  canCopy?: boolean;
}

export const TextAddress: React.FC<TextAddressProps> = ({
  address,
  ens,
  className,
  canCopy,
}) => {
  function handleCopy(e: React.MouseEvent<HTMLHeadingElement, MouseEvent>) {
    if (!canCopy) return;

    e.stopPropagation();
    navigator.clipboard.writeText(address);
    toast.success("Address Copied to clipboard");
  }

  return (
    <span className={className} onClick={handleCopy}>
      {ens ? ens : address.slice(0, 5)}...{address.slice(-3)}
    </span>
  );
};
