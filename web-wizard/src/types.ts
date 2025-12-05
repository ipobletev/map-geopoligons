export type StepKey =
    | 'objective'
    | 'geofence'
    | 'home'
    | 'road'
    | 'transit_road'
    | 'obstacles'
    | 'tall_obstacle';

export interface Step {
    key: StepKey;
    label: string;
    description: string;
    drawMode: 'marker' | 'polygon' | 'polyline' | 'any';
}

export const WIZARD_STEPS: Step[] = [
    {
        key: 'objective',
        label: 'Objetivo',
        description: 'Lugares donde el objetivo tiene que alcanzar por medio de las calles.',
        drawMode: 'marker' // Only Points
    },
    {
        key: 'geofence',
        label: 'Geofence',
        description: 'El margen de actuación del robot. Cualquier polígono u objetivo fuera de esto no se tomará.',
        drawMode: 'polygon'
    },
    {
        key: 'home',
        label: 'Home',
        description: 'Inicio del robot.',
        drawMode: 'polyline'
    },
    {
        key: 'road',
        label: 'Calle',
        description: 'El robot pasará por las calles hacia los objetivos cercanos.',
        drawMode: 'polyline' // Or polygon if wide
    },
    {
        key: 'transit_road',
        label: 'Calle de Tránsito',
        description: 'El robot solo pasará por esta calle y no irá a por objetivos.',
        drawMode: 'polyline'
    },
    {
        key: 'obstacles',
        label: 'Obstáculos',
        description: 'Polígono que no permite el paso.',
        drawMode: 'polygon'
    },
    {
        key: 'tall_obstacle',
        label: 'Obstáculos Altos',
        description: 'Polígono que no permite el paso (alto).',
        drawMode: 'polygon'
    }
];
