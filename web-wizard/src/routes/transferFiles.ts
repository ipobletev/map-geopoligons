
export interface TransferData {
    target_ip: string;
    target_user: string;
    target_path: string;
    files: {
        global_plan: boolean;
        map_image: boolean;
        map_yaml: boolean;
        latlon_yaml: boolean;
    };
    ssh_key_path?: string;
}

export async function transferFiles(data: TransferData): Promise<any> {
    try {
        const response = await fetch('/api/transfer-files', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (response.ok) {
            return result;
        } else {
            throw new Error(result.message || 'Transfer failed');
        }
    } catch (error) {
        console.error('Transfer error:', error);
        throw error;
    }
}
