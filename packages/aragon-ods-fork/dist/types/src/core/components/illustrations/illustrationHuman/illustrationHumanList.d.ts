import type { SVGProps } from 'react';
import type { IllustrationHumanAccessory, IllustrationHumanBody, IllustrationHumanExpression, IllustrationHumanHairs, IllustrationHumanSunglasses } from './illustrationHumanType';
type IllustrationHumanComponent = React.FC<SVGProps<SVGSVGElement>>;
export declare const illustrationHumanAccessoryList: Record<IllustrationHumanAccessory, IllustrationHumanComponent>;
export declare const illustrationHumanSunglassesList: Record<IllustrationHumanSunglasses, IllustrationHumanComponent>;
export declare const illustrationHumanBodyList: Record<IllustrationHumanBody, IllustrationHumanComponent>;
export declare const illustrationHumanExpressionList: Record<IllustrationHumanExpression, IllustrationHumanComponent>;
export declare const illustrationHumanHairsList: Record<IllustrationHumanHairs, IllustrationHumanComponent>;
export {};
