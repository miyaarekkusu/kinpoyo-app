"""DeepSeek API（OpenAI互換）呼び出しラッパー。requestsで直接POSTする
（OpenAI SDK等の追加依存は増やさない）。
"""
import requests

from app.core.config import settings

DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"


def generate_review_text(prompt: str) -> tuple[str, int, int]:
    """(生成されたレビュー文, prompt_tokens, completion_tokens) を返す。
    APIキー未設定時はRuntimeErrorを送出する（呼び出し側でHTTPExceptionに変換）。
    """
    if not settings.DEEPSEEK_API_KEY:
        raise RuntimeError("DEEPSEEK_API_KEYが設定されていません")
    response = requests.post(
        DEEPSEEK_API_URL,
        headers={
            "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": DEEPSEEK_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
        },
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    text = data["choices"][0]["message"]["content"]
    usage = data.get("usage", {})
    return text, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0)
