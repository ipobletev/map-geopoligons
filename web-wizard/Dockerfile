FROM node:18-alpine

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Expose port (Vite default)
EXPOSE 5173

# Run the application
CMD ["npm", "run", "dev", "--", "--host"]
