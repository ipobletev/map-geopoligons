
export interface GraphNode {
    id: number;
    label: string;
    type: string;
}

export async function fetchGraphNodes(): Promise<GraphNode[]> {
    try {
        const response = await fetch('/api/graph-nodes');
        if (!response.ok) {
            throw new Error('Failed to fetch graph nodes');
        }
        const data = await response.json();
        return data.nodes || [];
    } catch (error) {
        console.error('Error fetching graph nodes:', error);
        throw error;
    }
}
