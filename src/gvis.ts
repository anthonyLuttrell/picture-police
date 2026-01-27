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
        // const pagesWithMatchingImages = data.responses[0].webDetection.pagesWithMatchingImages;
        // for (const page of pagesWithMatchingImages)
        // {
        //     console.debug(JSON.stringify(page, null, 2));
        // }
        // console.debug(`WEB_DETECTION result:\n\n${JSON.stringify(data.responses[0].webDetection.pagesWithMatchingImages, null, 2)}`);
        return data.responses[0].webDetection;
    }
    catch (e)
    {
        console.error("WEB_DETECTION ERROR");
        return null;
    }
}