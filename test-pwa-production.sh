#!/bin/bash

# PWA Production Testing Script
# Run this to test your PWA deployment on https://your-domain.com

BASE_URL="https://your-domain.com"
echo "🔍 Testing PWA deployment at: $BASE_URL"
echo "=================================================="

# Test 1: Check if main site loads
echo "1. Testing main site..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL")
if [ "$response" = "200" ]; then
    echo "✅ Main site accessible (HTTP $response)"
else
    echo "❌ Main site failed (HTTP $response)"
fi

# Test 2: Check manifest
echo ""
echo "2. Testing manifest.webmanifest..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/manifest.webmanifest")
content_type=$(curl -s -I "$BASE_URL/manifest.webmanifest" | grep -i content-type)
if [ "$response" = "200" ]; then
    echo "✅ Manifest accessible (HTTP $response)"
    echo "   Content-Type: $content_type"
    # Show manifest content
    echo "   Manifest content:"
    curl -s "$BASE_URL/manifest.webmanifest" | head -c 200
    echo "..."
else
    echo "❌ Manifest failed (HTTP $response)"
fi

# Test 3: Check service worker
echo ""
echo "3. Testing service worker..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/sw.js")
content_type=$(curl -s -I "$BASE_URL/sw.js" | grep -i content-type)
if [ "$response" = "200" ]; then
    echo "✅ Service worker accessible (HTTP $response)"
    echo "   Content-Type: $content_type"
else
    echo "❌ Service worker failed (HTTP $response)"
fi

# Test 4: Check PWA icons
echo ""
echo "4. Testing PWA icons..."
for icon in "pwa-64x64.png" "pwa-192x192.png" "pwa-512x512.png" "pwa-maskable-512x512.png"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/$icon")
    if [ "$response" = "200" ]; then
        echo "✅ $icon accessible (HTTP $response)"
    else
        echo "❌ $icon failed (HTTP $response)"
    fi
done

# Test 5: Check debug endpoint
echo ""
echo "5. Testing debug endpoint..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/debug/pwa")
if [ "$response" = "200" ]; then
    echo "✅ Debug endpoint accessible (HTTP $response)"
    echo "   Debug info:"
    curl -s "$BASE_URL/debug/pwa" | head -c 300
    echo "..."
else
    echo "❌ Debug endpoint failed (HTTP $response)"
fi

# Test 6: Check headers
echo ""
echo "6. Testing PWA-specific headers..."
echo "Checking Service-Worker-Allowed header:"
curl -s -I "$BASE_URL/sw.js" | grep -i service-worker-allowed || echo "   Header not found"

echo ""
echo "Checking manifest Content-Type:"
curl -s -I "$BASE_URL/manifest.webmanifest" | grep -i content-type || echo "   Header not found"

# Test 7: SSL Certificate
echo ""
echo "7. Testing SSL certificate..."
ssl_info=$(curl -s -I "$BASE_URL" 2>&1 | head -1)
echo "   SSL Status: $ssl_info"

echo ""
echo "=================================================="
echo "🧪 Testing complete!"
echo ""
echo "📱 To test PWA installation:"
echo "1. Visit $BASE_URL on your Android Chrome"
echo "2. Look for install notification or ⊕ icon"
echo "3. Check DevTools → Application → Manifest"
echo "4. Check DevTools → Application → Service Workers"
echo ""
echo "🔧 If issues persist:"
echo "1. Check browser DevTools console for errors"
echo "2. Verify all icons loaded with HTTP 200"
echo "3. Confirm manifest.webmanifest returns valid JSON"
echo "4. Ensure service worker registers successfully"