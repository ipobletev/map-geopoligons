
export interface PathRequest {
    start_node: number | string;
    goal_node: number | string;
}

export interface PathResponse {
    path?: any[]; // List of node IDs or objects
    nodes?: any;  // Node details map
    path_details?: any; // Detailed implementation if backend provides it
}

export async function calculatePath(start: string | number, end: string | number): Promise<PathResponse> {
    try {
        const response = await fetch('/api/calculate-path', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ start_node: start, end_node: end }),
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'Failed to calculate path');
        }

        return await response.json();
    } catch (error) {
        console.error('Error calculating path:', error);
        throw error;
    }
}
