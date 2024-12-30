import {
  PUB_DELEGATION_WALL_CONTRACT_ADDRESS,
  PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS,
  PUB_MULTISIG_PLUGIN_ADDRESS,
  PUB_EMERGENCY_MULTISIG_PLUGIN_ADDRESS,
  PUB_ENCRYPTION_REGISTRY_CONTRACT_ADDRESS,
} from "@/constants";
import { IconType } from "@aragon/ods";

export type PluginItem = {
  /** The URL fragment after /plugins */
  id: string;
  /** The name of the folder within `/plugins` */
  folderName: string;
  /** Title on menu */
  title: string;
  icon?: IconType;
  pluginAddress: string;
  hiddenIfNotSigner?: boolean;
  hideFromMenu?: boolean;
};

export const plugins: PluginItem[] = [
  //  /*
  {
    id: "community-proposals",
    folderName: "optimistic-proposals",
    title: "Proposals",
    // icon: IconType.APP_MEMBERS,
    pluginAddress: PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS,
  },
  {
    id: "taiko-council",
    folderName: "multisig",
    title: "Draft Proposals",
    // icon: IconType.BLOCKCHAIN_BLOCKCHAIN,
    pluginAddress: PUB_MULTISIG_PLUGIN_ADDRESS,
    hiddenIfNotSigner: true,
    hideFromMenu: true
  },
  {
    id: "emergency-council",
    folderName: "emergency-multisig",
    title: "Emergency Proposals",
    // icon: IconType.BLOCKCHAIN_BLOCKCHAIN,
    pluginAddress: PUB_EMERGENCY_MULTISIG_PLUGIN_ADDRESS,
    hiddenIfNotSigner: true,
    hideFromMenu: true
  },
  {
    id: "security-council",
    folderName: "security-council",
    title: "Security Council",
    // icon: IconType.BLOCKCHAIN_BLOCKCHAIN,
    pluginAddress: PUB_ENCRYPTION_REGISTRY_CONTRACT_ADDRESS,
    hiddenIfNotSigner: true,
  } /*
  {
    id: "members",
    folderName: "members",
    title: "Members",
    // icon: IconType.BLOCKCHAIN_BLOCKCHAIN,
    pluginAddress: PUB_DELEGATION_WALL_CONTRACT_ADDRESS,
  },*/,
  {
    id: "delegates",
    folderName: "delegates",
    title: "Delegates",
    // icon: IconType.BLOCKCHAIN_BLOCKCHAIN,
    pluginAddress: PUB_DELEGATION_WALL_CONTRACT_ADDRESS,
  },
  //*/

  /*
  {
    id: "community-proposals",
    folderName: "optimistic-proposals",
    title: "Proposals",
    // icon: IconType.APP_MEMBERS,
    pluginAddress: PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS,
  },
  {
    id: "taiko-council",
    folderName: "multisig",
    title: "Draft Proposals",
    // icon: IconType.BLOCKCHAIN_BLOCKCHAIN,
    pluginAddress: PUB_MULTISIG_PLUGIN_ADDRESS,
    hiddenIfNotSigner: true,
  },
  {
    id: "security-council",
    folderName: "emergency-multisig",
    title: "Emergency Proposals",
    // icon: IconType.BLOCKCHAIN_BLOCKCHAIN,
    pluginAddress: PUB_EMERGENCY_MULTISIG_PLUGIN_ADDRESS,
    hiddenIfNotSigner: true,
  },
  {
    id: "members",
    folderName: "members",
    title: "Delegates",
    // icon: IconType.BLOCKCHAIN_BLOCKCHAIN,
    pluginAddress: PUB_DELEGATION_WALL_CONTRACT_ADDRESS,
  },
  {
    id: "members",
    folderName: "members",
    title: "Security Council",
    // icon: IconType.BLOCKCHAIN_BLOCKCHAIN,
    pluginAddress: PUB_DELEGATION_WALL_CONTRACT_ADDRESS,
  },
  */
];
