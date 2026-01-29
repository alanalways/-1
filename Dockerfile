# Node.js Docker image for Hugging Face Spaces
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy all source files
COPY . .

# Expose port 7860 (Hugging Face default)
EXPOSE 7860

# Start the server
CMD ["node", "server.js"]
