import type { SVGProps } from 'react';
import type { IllustrationObjectType } from './illustrationObjectType';
export interface IIllustrationObjectProps extends SVGProps<SVGSVGElement> {
    /**
     * Illustration object to render.
     */
    object: IllustrationObjectType;
}
export declare const IllustrationObject: React.FC<IIllustrationObjectProps>;
