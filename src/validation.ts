import {checkGoogleVision} from "./gvis.js";

export async function validateApiKey(value: string|undefined)
{
    if (value === "")
    {
        return "No API key provided.";
    }

    const result = await checkGoogleVision(
        "https://www.redditstatic.com/desktop2x/img/favicon/android-icon-192x192.png",
        value as string
    );

    if (!result)
    {
        return "The API key provided appears to be invalid or billing is not enabled.";
    }

    return undefined;
}