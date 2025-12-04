export async function normalizeKey(rawKey: string | null | undefined): Promise<string | null> {

    if (!rawKey) return null;

    let key = rawKey.trim().toUpperCase();

    if (!key.startsWith('{{')) {
        key = key.startsWith('{') ? '{' + key : '{{' + key;
    }

    if (!key.endsWith('}}')) {
        key = key.endsWith('}') ? key + '}' : key + '}}';
    }

    return key;
    
}
