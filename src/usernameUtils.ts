/**
 * Tokenizes a username into its constituent parts based on:
 * - Hyphens and underscores
 * - CamelCase transitions
 * - Numeric boundaries
 *
 * Example: "MyReallyCoolUsername-88" -> ["my", "really", "cool", "username", "88"]
 */
export function tokenizeUsername(username: string): string[] {
    // 1. Replace separators with spaces
    let clean = username.replace(/[-_]/g, ' ');

    // 2. Insert space before capital letters (CamelCase)
    // Look for (lowercase)(Uppercase) and insert space
    clean = clean.replace(/([a-z])([A-Z])/g, '$1 $2');

    // 3. Insert space between letters and numbers
    clean = clean.replace(/([a-zA-Z])([0-9])/g, '$1 $2');
    clean = clean.replace(/([0-9])([a-zA-Z])/g, '$1 $2');

    // 4. Split by whitespace and filter empty strings
    const tokens = clean.split(/\s+/).filter(t => t.length > 0);

    // 5. Convert to lowercase
    return tokens.map(t => t.toLowerCase());
}

/**
 * Calculates a confidence score (0-100) that the target username exists
 * within the provided text (page content or URL).
 *
 * Scoring Rules:
 * - 100%: Exact match (case insensitive).
 * - 90%: Variation match (ignoring separators like hyphens/underscores).
 * - 80%: High partial match (most tokens found).
 * - 50%: Low partial match (some tokens found).
 * - 0%: No match.
 */
export function calculateConfidence(targetUsername: string, textToSearch: string): number {
    if (!textToSearch || !targetUsername) return 0;

    const targetLower = targetUsername.toLowerCase();
    const textLower = textToSearch.toLowerCase();

    // 100% - Exact match (case-insensitive check is sufficient as we lowercased both)
    // We check if the text *contains* the username exactly (surrounded by boundaries preferred but simple includes is a good start for "found on page")
    // Use regex to ensure word boundaries if possible, but for URLs plain includes might be safer.
    // Let's stick to simple inclusion for "found on page".
    if (textLower.includes(targetLower)) {
        return 100;
    }

    // 90% - Match ignoring separators (hyphens, underscores)
    const targetClean = targetLower.replace(/[-_]/g, '');
    const textClean = textLower.replace(/[-_]/g, '');
    if (textClean.includes(targetClean)) {
        return 90;
    }

    // Token Analysis for Partial Matches
    const tokens = tokenizeUsername(targetUsername);
    if (tokens.length === 0) return 0;

    let foundCount = 0;
    for (const token of tokens) {
        if (textLower.includes(token)) {
            foundCount++;
        }
    }

    const percentageFound = foundCount / tokens.length;

    // 80% - "Found the username, but it was missing some part"
    // Let's say if > 66% of tokens are found (e.g. 3 out of 4)
    if (percentageFound > 0.66) {
        return 80;
    }

    // 50% - "Found only part of the username"
    // If at least one token is found (and it's not a super common generic word? we won't filter stop words for now)
    if (foundCount > 0) {
        return 50;
    }

    return 0;
}
