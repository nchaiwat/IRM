FROM python:3.11-slim

WORKDIR /app

ENV PYTHONPATH=/app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    freetds-dev \
    freetds-bin \
    tzdata \
    && ln -snf /usr/share/zoneinfo/Asia/Bangkok /etc/localtime && echo "Asia/Bangkok" > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

ENV TZ=Asia/Bangkok

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Start FastAPI server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
