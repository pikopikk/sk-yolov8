FROM python:3.12-slim

WORKDIR /app

# Install library yang dibutuhkan OpenCV
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libxcb1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements terlebih dahulu agar cache Docker lebih efektif
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Copy seluruh project
COPY . .

# Railway menggunakan PORT dari environment variable
ENV PORT=8080

CMD gunicorn --bind 0.0.0.0:$PORT app:app