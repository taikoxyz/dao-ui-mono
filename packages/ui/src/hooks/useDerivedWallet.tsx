import { useState, useContext, createContext, type ReactNode, useEffect } from "react";
import { keccak256, toHex } from "viem";
import { computePublicKey } from "@/utils/encryption/asymmetric";
import { useAccount, useSignMessage } from "wagmi";
import { hexToUint8Array } from "@/utils/hex";
import { DETERMINISTIC_EMERGENCY_PAYLOAD } from "@/constants";
import { useAlerts } from "@/context/Alerts";

type KeyPair = {
  privateKey?: Uint8Array;
  publicKey?: Uint8Array;
};

type Result = KeyPair & {
  requestSignature: () => Promise<{ privateKey: Uint8Array; publicKey: Uint8Array }>;
};

const DerivedWalletContext = createContext<Result>({
  requestSignature: () => Promise.resolve({ publicKey: new Uint8Array(), privateKey: new Uint8Array() }),
});

export function UseDerivedWalletProvider({ children }: { children: ReactNode }) {
  const { signMessageAsync } = useSignMessage();
  const { addAlert } = useAlerts();
  const { address } = useAccount();
  const [keys, setKeys] = useState<KeyPair>({});

  useEffect(() => {
    setKeys({});
  }, [address]);

  const requestSignature = () => {
    addAlert(`Signing message`, {
      description: DETERMINISTIC_EMERGENCY_PAYLOAD,
      timeout: 10 * 1000,
    });

    const hash = keccak256(toHex(DETERMINISTIC_EMERGENCY_PAYLOAD));

    const renderHash = Array.from({ length: 4 }, (_, i) =>
      hash.slice(i * Math.floor(hash.length / 4), (i + 1) * Math.floor(hash.length / 4))
    ).join(" ");

    addAlert(`Message hash`, { description: renderHash, timeout: 10 * 1000 });
    return signMessageAsync({ message: DETERMINISTIC_EMERGENCY_PAYLOAD })
      .then((privateSignature) => {
        const derivedPrivateKey = keccak256(privateSignature);
        const publicKey = computePublicKey(hexToUint8Array(derivedPrivateKey));

        const value = {
          publicKey,
          privateKey: hexToUint8Array(derivedPrivateKey),
        };
        setKeys(value);
        return value;
      })
      .catch((err) => {
        if ((err as Error)?.message.includes("User rejected the request")) {
          addAlert("You canceled the signature");
          throw err;
        }

        addAlert("The signature could not be retrieved", { type: "error" });
        throw err;
      });
  };

  const value = {
    requestSignature,
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
  };

  return <DerivedWalletContext.Provider value={value}>{children}</DerivedWalletContext.Provider>;
}

export function useDerivedWallet() {
  return useContext(DerivedWalletContext);
}
