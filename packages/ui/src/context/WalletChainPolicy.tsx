import React, { createContext, useContext, useMemo, useState } from "react";

export interface WalletChainPolicyContextProps {
  allowedSecondaryChainIds: number[];
  setAllowedSecondaryChainIds: (chainIds: number[]) => void;
}

const WalletChainPolicyContext = createContext<WalletChainPolicyContextProps | undefined>(undefined);

export const WalletChainPolicyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allowedSecondaryChainIds, setAllowedSecondaryChainIds] = useState<number[]>([]);

  const value = useMemo(
    () => ({ allowedSecondaryChainIds, setAllowedSecondaryChainIds }),
    [allowedSecondaryChainIds]
  );

  return <WalletChainPolicyContext.Provider value={value}>{children}</WalletChainPolicyContext.Provider>;
};

export const useWalletChainPolicy = () => {
  const context = useContext(WalletChainPolicyContext);

  if (!context) {
    throw new Error("useWalletChainPolicy must be used inside the WalletChainPolicyProvider");
  }

  return context;
};
