import { type ICompositeAddress, type IWeb3ComponentProps } from '../../types';
export interface IWalletProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, IWeb3ComponentProps {
    /**
     * The connected user details.
     */
    user?: ICompositeAddress;
}
export declare const Wallet: React.FC<IWalletProps>;
