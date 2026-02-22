# Stage 1: Build Frontend
FROM --platform=linux/arm64 arm64v8/node:18-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Setup Backend (PocketBase)
FROM --platform=linux/arm64 arm64v8/alpine:latest

ARG PB_VERSION=0.36.1  # Updated to match local version

RUN apk add --no-cache \
    unzip \
    ca-certificates \
    curl

# Download and unzip PocketBase (Linux arm64 for QNAP TS-932PX)
ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_arm64.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /pb/

# Clean up zip
RUN rm /tmp/pb.zip

# Set working directory for PocketBase
WORKDIR /pb

# Copy frontend build to PocketBase public directory
# PocketBase automatically serves 'pb_public' in the working directory
COPY --from=frontend-builder /app/dist /pb/pb_public

# Copy local migrations and hooks
COPY ./backend/pb_migrations /pb/pb_migrations
COPY ./backend/pb_hooks /pb/pb_hooks

# Inject environment variables for PocketBase
COPY .env /pb/.env

EXPOSE 8090

# Start PocketBase
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090"]
