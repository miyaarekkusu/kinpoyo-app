# AI回数カウントの検証用：model-studio（Azure App Service Linux、変更禁止）と
# 同じLinux環境・同じgunicorn起動方式でMediaPipeを動かすためのコンテナ。
# Windowsローカルのvenv（C:\venvs\kinpoyo-backend-core）と結果を比較するために作成した
# （model-studio/backend/startup.shに書かれているaptパッケージ・gunicorn起動コマンドを踏襲）。
FROM python:3.12-slim

RUN apt-get update -qq && apt-get install -y --no-install-recommends \
    libxcb1 libxext6 libxrender1 libsm6 \
    libgl1 libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# model-studio（backend/startup.sh）と同じ起動コマンド。
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "--timeout", "600", "main:app"]
