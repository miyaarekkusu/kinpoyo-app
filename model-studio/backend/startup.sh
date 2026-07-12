#!/bin/bash
set -e

# OpenCV (pulled in by mediapipe via opencv-contrib-python) needs X11/GL libs
# that are not present in the App Service Linux Python image.
if ! ldconfig -p | grep -q "libxcb.so.1"; then
    apt-get update -qq
    apt-get install -y --no-install-recommends \
        libxcb1 libxext6 libxrender1 libsm6 \
        libgl1 libglib2.0-0 libgomp1 || true
fi

# Activate the Oryx-managed virtualenv
source /home/site/wwwroot/antenv/bin/activate

exec gunicorn -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 --timeout 600 main:app
