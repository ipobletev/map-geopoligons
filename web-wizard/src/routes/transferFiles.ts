
export interface TransferData {
    host: string;
    port: number;
    username: string;
    password: string;
    files: Record<string, string>; // filename -> remote_path
}

export async function transferFiles(data: TransferData): Promise<any> {
    try {
        const response = await fetch('/api/v1/transfer-files', {
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
