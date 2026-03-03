FROM node:20-slim

# Install Python 3 and pip
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node.js dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production=false

# Install Python dependencies
COPY python/requirements-core.txt ./python/
RUN pip3 install --no-cache-dir --break-system-packages -r python/requirements-core.txt

# Copy all source files
COPY . .

# Build the Next.js app
RUN npm run build

# Make startup script executable
RUN chmod +x /app/start.sh

# Expose port 7860 (HuggingFace default)
EXPOSE 7860

ENV PORT=7860
ENV HOSTNAME="0.0.0.0"
ENV VAULT_PATH=/tmp/AI_Employee_Vault
ENV PROJECT_ROOT=/app/python
ENV NODE_ENV=production

CMD ["/app/start.sh"]
