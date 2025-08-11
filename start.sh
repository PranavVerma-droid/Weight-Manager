#!/bin/bash

# Weight Manager Startup Script

echo "Starting Weight Manager..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Create data directory if it doesn't exist
mkdir -p data

# Start the server
echo "Starting server on http://localhost:3000"
echo "Default login: admin@example.com / admin123"
npm start