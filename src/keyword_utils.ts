/**
 * Checks if the post content contains any of the specified keywords within the defined scope.
 *
 * @param {string} title - The title of the post.
 * @param {string | undefined} body - The body of the post (if any).
 * @param {string[]} keywords - An array of keywords to search for.
 * @param {string} scope - The scope of the search: "title", "body", or "both".
 * @return {boolean} True if a keyword is found, false otherwise.
 */
export function checkPostKeywords(
    title: string,
    body: string | undefined,
    keywords: string[],
    scope: string
): boolean
{
    if (!keywords || keywords.length === 0)
    {
        return false;
    }

    // Normalize keywords
    const normalizedKeywords = keywords
        .map(k => k.trim().toLowerCase())
        .filter(k => k.length > 0);

    if (normalizedKeywords.length === 0)
    {
        return false;
    }

    const normalizedTitle = title.toLowerCase();
    const normalizedBody = (body || "").toLowerCase();

    const check = (text: string) => normalizedKeywords.some(keyword => text.includes(keyword));

    if (scope === "title")
    {
        return check(normalizedTitle);
    }
    else if (scope === "body")
    {
        return check(normalizedBody);
    }
    else
    {
        // Default to checking both for "both" or any unknown value
        return check(normalizedTitle) || check(normalizedBody);
    }
}
