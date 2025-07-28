FROM node:22-alpine

WORKDIR /app

# Copy all files (already built)
COPY . .

# Install production dependencies only
RUN npm ci --omit=dev

# Start scheduler
CMD ["node", "scheduler.js"]