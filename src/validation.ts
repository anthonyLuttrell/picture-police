import {checkGoogleVision} from "./gvis.js";

export async function validateComment(value: any, context: any)
{
    console.debug(`Selected: ${value}`);
    const comment = await context.settings.get("LEAVE_COMMENT");
    console.debug(`comment value: ${comment}`);
    if (value === "true" && comment === "")
    {
        return "You must also enable a comment option.";
    }
    return undefined;
}

export async function validateApiKey(value: string|undefined)
{
    // TODO this is not working
    if (value === "")
    {
        return undefined
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