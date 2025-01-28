import classNames from 'classnames';
import type { HTMLAttributes } from 'react';

export interface ICardProps extends HTMLAttributes<HTMLDivElement> {}

export const Card: React.FC<ICardProps> = ({children, ...props}) => {
    const { className, ...otherProps } = props;

    return <div className={classNames('rounded-xl bg-neutral-0', className)} {...otherProps}>
        {children}
        </div>;
};
