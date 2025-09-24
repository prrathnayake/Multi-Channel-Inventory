FROM node:20-alpine
WORKDIR /app

# Copy manifest files first for better layer caching
COPY package.json package-lock.json* ./

# If lockfile exists -> npm ci, else -> npm install
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund ; \
    else \
      npm install --no-audit --no-fund ; \
    fi

# Now copy the rest
COPY . .
EXPOSE 3000
CMD ["npm","run","dev"]
