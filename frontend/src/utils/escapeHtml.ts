const CHARACTER_ENTITY_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

export function escapeHtml(value: string) {
    return value.replace(/[&<>'"]/g, (character) => CHARACTER_ENTITY_MAP[character] ?? character);
}
