export interface ParsedContent {
    title: string;
    content: string;
    excerpt: string;
    tags: string[];
    categories: string[];
    seoTitle: string;
    metaDescription: string;
    markers: ImageMarker[];
    // images are optional because the ai may not have generated images yet
    images?: Image[];
}

export interface ImageMarker {
    description: string;
    placement: string;
    uuid: string;
}

export interface Image {
    uuid: string;
    description: string;
    // may be null if ai has not generated an image yet
    altText: string | null;
    caption: string | null;
    placement: string;
    // wordpress is optional because the image may not have been uploaded to wordpress yet
    wordpress?: {
        id: string;
        url: string;
    };
}