addEventListener("fetch", event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    if (request.method !== "POST") {
        return new Response("This endpoint only accepts POST requests", { status: 405 });
    }

    const BOT_TOKEN = env.BOT_TOKEN;
    const PAGE_URL = "https://telegram-file-stream.pages.dev"; // Your Cloudflare Page URL

    const update = await request.json();

    // 1. Extract chat_id and file_id
    const message = update.message;
    if (!message || !message.chat) {
        return new Response("No message data", { status: 200 });
    }

    const chatId = message.chat.id;
    let fileId = null;

    // Telegram may send different file types
    if (message.document) {
        fileId = message.document.file_id;
    } else if (message.video) {
        fileId = message.video.file_id;
    } else if (message.audio) {
        fileId = message.audio.file_id;
    } else if (message.photo) {
        // Take the largest photo size
        const photoArray = message.photo;
        fileId = photoArray[photoArray.length - 1].file_id;
    }

    if (!fileId) {
        await sendMessage(BOT_TOKEN, chatId, "Please send me a document, video, or audio file.");
        return new Response("No file detected", { status: 200 });
    }

    // 2. Get the Telegram file path
    const fileInfo = await getFilePath(BOT_TOKEN, fileId);
    if (!fileInfo || !fileInfo.file_path) {
        await sendMessage(BOT_TOKEN, chatId, "Unable to get file info from Telegram.");
        return new Response("Failed to fetch file info", { status: 200 });
    }

    const filePath = fileInfo.file_path;
    const streamLink = `${PAGE_URL}/stream?path=${encodeURIComponent(filePath)}`;

    // 3. Reply with the link
    const reply = `✅ Your file is ready!\n\n🎬 Stream it here:\n${streamLink}`;
    await sendMessage(BOT_TOKEN, chatId, reply);

    return new Response("OK", { status: 200 });
}

// Helper: Get Telegram file path
async function getFilePath(token, fileId) {
    const url = `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.ok) return null;
    return data.result;
}

// Helper: Send Telegram message
async function sendMessage(token, chatId, text) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
    });
}
