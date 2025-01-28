import type { HTMLAttributes } from 'react';
import type { IllustrationObjectType } from '../illustrationObject';
import type { IllustrationHumanAccessory, IllustrationHumanBody, IllustrationHumanExpression, IllustrationHumanHairs, IllustrationHumanSunglasses } from './illustrationHumanType';
export interface IIllustrationHumanProps extends HTMLAttributes<HTMLDivElement> {
    /**
     * Body of the illustration human.
     */
    body: IllustrationHumanBody;
    /**
     * Expression of the illustration human.
     */
    expression: IllustrationHumanExpression;
    /**
     * Hairs of the illustration human.
     */
    hairs?: IllustrationHumanHairs;
    /**
     * Sunglasses of the illustration human.
     */
    sunglasses?: IllustrationHumanSunglasses;
    /**
     * Accessory of the illustration human.
     */
    accessory?: IllustrationHumanAccessory;
    /**
     * Object to be displayed.
     */
    object?: IllustrationObjectType;
    /**
     * Position of the object.
     * @default left
     */
    objectPosition?: 'right' | 'left';
}
export declare const IllustrationHuman: React.FC<IIllustrationHumanProps>;
