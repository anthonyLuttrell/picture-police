// TODO implement this interface
// interface VisionResult
// {
//     fullMatchingImages?: { url: string }[];
//     partialMatchingImages?: { url: string }[];
//     pagesWithMatchingImages?: { url: string; fullMatchingImages?: any[]; partialMatchingImages?: any[] }[];
// }

export async function checkGoogleVision(imgUrl: string, apiKey: string)
{
    const apiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

    const body =
        {
            requests: [
                {
                    image: {source: {imageUri: imgUrl}},
                    features: [{type: 'WEB_DETECTION', maxResults: 20}]
                }
            ]
        };

    try
    {
        const response = await fetch(apiUrl,
            {
                method: 'POST',
                body: JSON.stringify(body),
                headers: {'Content-Type': 'application/json'}
            });

        const data = await response.json();
        return data.responses[0].webDetection;
    }
    catch (e)
    {
        console.error("WEB_DETECTION ERROR");
        return null;
    }
}