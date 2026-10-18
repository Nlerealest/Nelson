#!/bin/bash
# Double-click this file to install and start Ndalama for testing on your phone.
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Your browser will open the download page."
  echo "Install the LTS version, then double-click this file again."
  open https://nodejs.org/en/download
  read -r -p "Press Enter to close."
  exit 1
fi

if ! node -e "process.exit(Number(process.versions.node.split('.')[0]) < 20 ? 1 : 0)"; then
  echo "Your Node.js is too old. Ndalama needs version 20 or newer."
  open https://nodejs.org/en/download
  read -r -p "Press Enter to close."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing Ndalama for the first time. This takes a few minutes..."
  if ! npm install; then
    echo "Installing failed. Check your internet connection and try again."
    read -r -p "Press Enter to close."
    exit 1
  fi
fi

echo
echo "Starting Ndalama. When the QR code appears:"
echo "  Android: open Expo Go and tap \"Scan QR code\""
echo "  iPhone:  open the Camera app and point it at the QR code"
echo "Keep this window open while you use the app. Close it to stop."
echo
npx expo start
