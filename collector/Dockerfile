FROM node:22-alpine

WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache sqlite

# Copy all files (already built)
COPY . .

# Install production dependencies only
RUN npm ci --omit=dev

# Create data directory
RUN mkdir -p /data

EXPOSE 3000

CMD ["node", "index.js"]