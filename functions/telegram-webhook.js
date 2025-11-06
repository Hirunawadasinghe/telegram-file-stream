export async function onRequestPost({ request, env }) {
    const body = await request.json();

    // Basic verification: check if it's a message with a document/video/audio/photo
    const message = body.message || body.edited_message;
    if (!message) {
        return new Response("No message", { status: 200 });
    }

    const chatId = message.chat.id;
    let fileId = null;

    // Detect the file type sent
    if (message.document) fileId = message.document.file_id;
    else if (message.video) fileId = message.video.file_id;
    else if (message.audio) fileId = message.audio.file_id;
    else if (message.photo) {
        // Get the largest photo size
        const photos = message.photo;
        fileId = photos[photos.length - 1].file_id;
    }

    if (!fileId) {
        await sendMessage(env.BOT_TOKEN, chatId, "Send me a file, video, or photo.");
        return new Response("No file found", { status: 200 });
    }

    // Get file info from Telegram
    const fileInfo = await getFileInfo(env.BOT_TOKEN, fileId);
    if (!fileInfo.ok) {
        await sendMessage(env.BOT_TOKEN, chatId, "Failed to get file info.");
        return new Response("Failed to get file info", { status: 200 });
    }

    const filePath = fileInfo.result.file_path;
    const streamURL = `https://telegram-file-stream.pages.dev/stream?path=${encodeURIComponent(filePath)}`;

    await sendMessage(
        env.BOT_TOKEN,
        chatId,
        `Here’s your streaming link:\n${streamURL}`
    );

    return new Response("OK", { status: 200 });
}

// Helper: send Telegram message
async function sendMessage(token, chatId, text) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
    });
}

// Helper: get file info
async function getFileInfo(token, fileId) {
    const url = `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`;
    const res = await fetch(url);
    return res.json();
}
