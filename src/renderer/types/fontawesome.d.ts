declare module '@fortawesome/react-fontawesome' {
  import { ComponentType, CSSProperties } from 'react';
  
  export interface FontAwesomeIconProps {
    icon: any;
    className?: string;
    style?: CSSProperties;
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
  
  // Navigation icons
  export const faHome: IconDefinition;
  export const faGlobe: IconDefinition;
  export const faServer: IconDefinition;
  export const faRobot: IconDefinition;
  export const faList: IconDefinition;
  
  // Action icons
  export const faPlus: IconDefinition;
  export const faCheck: IconDefinition;
  export const faTimes: IconDefinition;
  export const faEdit: IconDefinition;
  export const faTrash: IconDefinition;
  export const faClock: IconDefinition;
  export const faEye: IconDefinition;
  export const faEyeSlash: IconDefinition;
  
  // Feature icons
  export const faFlask: IconDefinition;
  export const faKey: IconDefinition;
  export const faBuilding: IconDefinition;
  export const faCalendarAlt: IconDefinition;
  export const faRocket: IconDefinition;
  export const faCode: IconDefinition;
  
  // Status icons
  export const faSpinner: IconDefinition;
  export const faCircleCheck: IconDefinition;
  export const faCircleXmark: IconDefinition;
  export const faTriangleExclamation: IconDefinition;
  export const faExclamationTriangle: IconDefinition;
  export const faInfoCircle: IconDefinition;
  export const faCheckCircle: IconDefinition;
  export const faTimesCircle: IconDefinition;
  
  // File and folder icons
  export const faFolder: IconDefinition;
  export const faFolderOpen: IconDefinition;
  export const faFile: IconDefinition;
  export const faFileAlt: IconDefinition;
  export const faFileImage: IconDefinition;
  export const faFileCode: IconDefinition;
  
  // UI icons
  export const faCog: IconDefinition;
  export const faSettings: IconDefinition;
  export const faUser: IconDefinition;
  export const faUsers: IconDefinition;
  export const faSearch: IconDefinition;
  export const faFilter: IconDefinition;
  export const faSort: IconDefinition;
  export const faArrowUp: IconDefinition;
  export const faArrowDown: IconDefinition;
  export const faArrowLeft: IconDefinition;
  export const faArrowRight: IconDefinition;
  export const faChevronUp: IconDefinition;
  export const faChevronDown: IconDefinition;
  export const faChevronLeft: IconDefinition;
  export const faChevronRight: IconDefinition;
  
  // Communication icons
  export const faEnvelope: IconDefinition;
  export const faPhone: IconDefinition;
  export const faComment: IconDefinition;
  export const faComments: IconDefinition;
  export const faShare: IconDefinition;
  export const faLink: IconDefinition;
  
  // Media icons
  export const faPlay: IconDefinition;
  export const faPause: IconDefinition;
  export const faStop: IconDefinition;
  export const faVolumeUp: IconDefinition;
  export const faVolumeDown: IconDefinition;
  export const faVolumeMute: IconDefinition;
  export const faImage: IconDefinition;
  export const faVideo: IconDefinition;
  export const faMusic: IconDefinition;
  
  // Network and connectivity icons
  export const faWifi: IconDefinition;
  export const faSignal: IconDefinition;
  export const faCloud: IconDefinition;
  export const faCloudUpload: IconDefinition;
  export const faCloudDownload: IconDefinition;
  export const faSync: IconDefinition;
  export const faSyncAlt: IconDefinition;
  
  // Security icons
  export const faShieldAlt: IconDefinition;
  export const faLock: IconDefinition;
  export const faUnlock: IconDefinition;
  
  // Development and technical icons
  export const faTerminal: IconDefinition;
  export const faCodeBranch: IconDefinition;
  export const faBug: IconDefinition;
  export const faWrench: IconDefinition;
  export const faHammer: IconDefinition;
  export const faToolbox: IconDefinition;
  export const faDatabase: IconDefinition;
  
  // Additional utility icons
  export const faChartBar: IconDefinition;
  export const faExternalLinkAlt: IconDefinition;
  export const faQuestion: IconDefinition;
  export const faRefresh: IconDefinition;
  export const faDownload: IconDefinition;
  export const faMagic: IconDefinition;
  export const faUpload: IconDefinition;
  export const faCopy: IconDefinition;
  export const faSave: IconDefinition;
  export const faHistory: IconDefinition;
  
  // Homepage Editor specific icons
  export const faMonitor: IconDefinition;
  export const faLaptop: IconDefinition;
  export const faPaperPlane: IconDefinition;
  export const faLightbulb: IconDefinition;
}

declare module '@fortawesome/free-regular-svg-icons' {
  // Add regular icons as needed
  // Icons will be of type IconDefinition from '@fortawesome/fontawesome-svg-core'
}

declare module '@fortawesome/free-brands-svg-icons' {
  import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
  
  // Brand icons
  export const faWordpress: IconDefinition;
}
