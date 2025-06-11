import { encodeAbiParameters, isAddressEqual, keccak256, toHex } from "viem";
import { EncryptedProposalMetadata } from "../utils/types";
import { hexToUint8Array } from "@/utils/hex";
import { encryptProposal, encryptSymmetricKey } from "@/utils/encryption";
import type { ProposalMetadata, RawAction } from "@/utils/types";
import { RawActionListAbi } from "../artifacts/RawActionListAbi";
import { getContentCid } from "@/utils/ipfs";
import { useApproverWalletList } from "@/plugins/security-council/hooks/useSignerList";
import { useEncryptionAccounts } from "@/plugins/security-council/hooks/useEncryptionAccounts";

export function useEncryptedData() {
  const {
    data: encryptionRecipients, // Filtering out former members
    isLoading: isLoadingSigners,
    error: signerListError,
  } = useApproverWalletList();
  const { data: encryptionAccounts, isLoading: isLoadingPubKeys } = useEncryptionAccounts();

  const encryptProposalData = async (privateMetadata: ProposalMetadata, actions: RawAction[]) => {
    const actionsBytes = encodeAbiParameters(RawActionListAbi, [actions]);
    if (isLoadingPubKeys || isLoadingSigners || !encryptionRecipients) {
    throw new Error("The list of signers is not available yet");
} else if (signerListError){
      throw signerListError;
    }

    // Encrypt data and generate an ephemeral symkey
    const strMetadata = JSON.stringify(privateMetadata);
    const { encrypted: cipherData, symmetricKey } = encryptProposal(strMetadata, hexToUint8Array(actionsBytes));

    // Only those who are on the signerList (encryptionRecipients)
    const encryptionPubKeys: Uint8Array[] = [];
    if (encryptionAccounts) {
      for (const recipient of encryptionRecipients) {
        const account = encryptionAccounts.find(
          (a) => isAddressEqual(a.owner, recipient) || isAddressEqual(a.appointedAgent, recipient)
        );
        if (!account) continue;

        encryptionPubKeys.push(hexToUint8Array(account.publicKey));
      }
    }

    // Encrypting the symmetric key so that each individual member can recover it
    const encryptedSymKeys = encryptSymmetricKey(symmetricKey, encryptionPubKeys);

    // Hash the raw actions
    const hashedActions = keccak256(actionsBytes);

    // Compute the CiD of the private metadata and hash it
    const metadataUri = await getContentCid(strMetadata);
    const hashedMetadataUri = keccak256(toHex(metadataUri));

    // Result
    const payload: EncryptedProposalMetadata = {
      encrypted: {
        metadata: cipherData.metadata,
        actions: cipherData.actions,
        symmetricKeys: encryptedSymKeys.map((k) => toHex(k)),
      },
    };
    const hashed = {
      actions: hashedActions,
      metadataUri: hashedMetadataUri,
    };
    return {
      payload,
      hashed,
    };
  };

  return {
    encryptProposalData,
  };
}
