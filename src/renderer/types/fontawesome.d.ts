declare module '@fortawesome/react-fontawesome' {
  import { ComponentType } from 'react';
  
  export interface FontAwesomeIconProps {
    icon: any;
    className?: string;
    style?: React.CSSProperties;
    title?: string;
    spin?: boolean;
    pulse?: boolean;
    fixedWidth?: boolean;
    inverse?: boolean;
    flip?: 'horizontal' | 'vertical' | 'both';
    rotation?: 90 | 180 | 270;
    transform?: string | object;
    mask?: any;
    symbol?: string | boolean;
    listItem?: boolean;
    size?: 'xs' | 'sm' | 'lg' | 'xl' | '2x' | '3x' | '4x' | '5x' | '6x' | '7x' | '8x' | '9x' | '10x' | '1x' | '2xs' | '3xs';
    color?: string;
    pull?: 'left' | 'right';
    border?: boolean;
    [key: string]: any;
  }

  export const FontAwesomeIcon: ComponentType<FontAwesomeIconProps>;
}

declare module '@fortawesome/fontawesome-svg-core' {
  export interface IconDefinition {
    icon: [number, number, string[], string, string];
    iconName: string;
    prefix: string;
    width: number;
    height: number;
    ligatures: string[];
    unicode: string;
    svgPathData: string;
  }

  export interface IconPack {
    [key: string]: IconDefinition;
  }

  export interface Library {
    add(...definitions: IconDefinition[]): void;
    add(...packs: IconPack[]): void;
  }

  export const library: Library;
  export const config: {
    familyPrefix: string;
    replacementClass: string;
    autoAddCss: boolean;
    autoReplaceSvg: boolean;
    observeMutations: boolean;
    keepOriginalSource: boolean;
    measurePerformance: boolean;
    showMissingIcons: boolean;
  };
}

declare module '@fortawesome/free-solid-svg-icons' {
  import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
  
  export const faHome: IconDefinition;
  export const faGlobe: IconDefinition;
  export const faServer: IconDefinition;
  export const faRobot: IconDefinition;
  export const faList: IconDefinition;
  export const faPlus: IconDefinition;
  export const faCheck: IconDefinition;
  export const faFlask: IconDefinition;
  export const faTrash: IconDefinition;
  export const faTimes: IconDefinition;
  export const faClock: IconDefinition;
  export const faKey: IconDefinition;
  export const faBuilding: IconDefinition;
  export const faEdit: IconDefinition;
  export const faCalendarAlt: IconDefinition;
  export const faRocket: IconDefinition;
  export const faCode: IconDefinition;
  // Add more icons as needed
}

declare module '@fortawesome/free-regular-svg-icons' {
  import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
  
  // Add regular icons as needed
}

declare module '@fortawesome/free-brands-svg-icons' {
  import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
  
  // Add brand icons as needed
}
