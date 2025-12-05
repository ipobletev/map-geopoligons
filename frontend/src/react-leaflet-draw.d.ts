declare module 'react-leaflet-draw' {
    import { FC } from 'react';

    export interface EditControlProps {
        position?: string;
        onCreated?: (e: any) => void;
        onEdited?: (e: any) => void;
        onDeleted?: (e: any) => void;
        onMounted?: (drawControl: any) => void;
        onEditStart?: (e: any) => void;
        onEditStop?: (e: any) => void;
        onDeleteStart?: (e: any) => void;
        onDeleteStop?: (e: any) => void;
        draw?: {
            polyline?: boolean | any;
            polygon?: boolean | any;
            rectangle?: boolean | any;
            circle?: boolean | any;
            marker?: boolean | any;
            circlemarker?: boolean | any;
        };
        edit?: {
            edit?: boolean | any;
            remove?: boolean | any;
            poly?: boolean | any;
            allowIntersection?: boolean;
        };
    }

    export const EditControl: FC<EditControlProps>;
}
