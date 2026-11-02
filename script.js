async function ask() {
    const input = document.getElementById("q");
    const chat = document.getElementById("chat");
    const button = document.getElementById("ask-button");
    const question = input.value.trim();

    if (!question) {
        alert("请先输入问题！");
        input.focus();
        return;
    }

    chat.textContent += `学生：${question}\n\n`;
    input.value = "";
    button.disabled = true;
    button.textContent = "查询中…";

    try {
        const response = await fetch("http://127.0.0.1:8000/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `服务器错误：${response.status}`);
        }

        chat.textContent += `助手：${data.answer}\n\n`;
    } catch (error) {
        chat.textContent += `系统提示：${error.message}\n请确认 Python 后端已启动。\n\n`;
        console.error("请求政策助手失败：", error);
    } finally {
        button.disabled = false;
        button.textContent = "查询";
        input.focus();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("q");
    if (input) {
        input.addEventListener("keydown", event => {
            if (event.key === "Enter") ask();
        });
    }
});
