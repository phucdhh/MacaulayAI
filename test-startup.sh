#!/bin/bash
# Test script để verify Macaulay2Web sau khi reboot
# Usage: ./test-startup.sh

echo "=== Macaulay2Web Startup Check ==="
echo "Date: $(date)"
echo ""

echo "1. Checking PM2 processes..."
pm2 list

echo ""
echo "2. Checking LaunchAgents/Daemons..."
echo "PM2 LaunchAgent:"
ls -la ~/Library/LaunchAgents/pm2.mac.plist 2>/dev/null && echo "✅ Found" || echo "❌ Not found"

echo ""
echo "Cloudflare daemons:"
sudo launchctl list | grep cloudflare | head -5

echo ""
echo "3. Checking Macaulay2..."
M2 --version 2>&1 | head -1

echo ""
echo "4. Testing local server..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:5657

echo ""
echo "5. Testing public domain..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" https://macaulay2.truyenthong.edu.vn

echo ""
echo "6. Checking ports..."
lsof -i :5657 | head -3

echo ""
echo "=== Check complete ==="
