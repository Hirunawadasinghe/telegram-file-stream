export async function onRequestGet(context) {
    const { request, env } = context;
    const BOT_TOKEN = env.BOT_TOKEN;
    const PAGE_URL = "https://telegram-file-stream.pages.dev"; // Your Cloudflare Page URL

    const update = await request.json();

    const message = update.message;
    if (!message || !message.chat) {
        return new Response("No message data", { status: 200 });
    }

    const chatId = message.chat.id;
    let fileId = null;

    if (message.document) {
        fileId = message.document.file_id;
    } else if (message.video) {
        fileId = message.video.file_id;
    } else if (message.audio) {
        fileId = message.audio.file_id;
    } else if (message.photo) {
        const photoArray = message.photo;
        fileId = photoArray[photoArray.length - 1].file_id;
    }

    if (!fileId) {
        await sendMessage(BOT_TOKEN, chatId, "Please send me a document, video, or audio file.");
        return new Response("No file detected", { status: 200 });
    }

    const fileInfo = await getFilePath(BOT_TOKEN, fileId);
    if (!fileInfo || !fileInfo.file_path) {
        await sendMessage(BOT_TOKEN, chatId, "Unable to get file info from Telegram.");
        return new Response("Failed to fetch file info", { status: 200 });
    }

    const filePath = fileInfo.file_path;
    const streamLink = `${PAGE_URL}/stream?path=${encodeURIComponent(filePath)}`;

    const reply = `✅ Your file is ready!\n\n🎬 Stream it here:\n${streamLink}`;
    await sendMessage(BOT_TOKEN, chatId, reply);

    return new Response("OK", { status: 200 });
}

async function getFilePath(token, fileId) {
    const url = `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.ok) return null;
    return data.result;
}

async function sendMessage(token, chatId, text) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
    });
}


