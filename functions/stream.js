export async function onRequestGet({ request, env }) {
    const url = new URL(request.url);
    const filePath = url.searchParams.get("path");
    const rangeHeader = request.headers.get("range") || "";

    if (!filePath) {
        return new Response("Missing ?path parameter", { status: 400 });
    }

    const BOT_TOKEN = env.BOT_TOKEN;
    const telegramURL = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

    try {
        const response = await fetch(telegramURL, {
            headers: rangeHeader ? { Range: rangeHeader } : {},
        });

        const headers = new Headers(response.headers);
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Accept-Ranges", "bytes");

        return new Response(response.body, {
            status: response.status,
            headers,
        });
    } catch (err) {
        return new Response("Error fetching Telegram file: " + err.message, {
            status: 500,
        });
    }
}