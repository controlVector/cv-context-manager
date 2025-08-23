#!/bin/bash

# API Testing Script for CV Context Manager
# Run with: bash test-api.sh

echo "🌐 CV Context Manager - API Testing Suite"
echo "=========================================="

BASE_URL="http://localhost:3002"

echo ""
echo "🔍 1. Service Health Check"
echo "-------------------------"
curl -s "$BASE_URL/" | python -m json.tool

echo ""
echo "🏥 2. Database Health Check" 
echo "---------------------------"
curl -s "$BASE_URL/health" | python -m json.tool

echo ""
echo "🔐 3. Test Encryption Endpoint"
echo "------------------------------"
curl -s -X POST "$BASE_URL/test/encrypt" \
  -H "Content-Type: application/json" \
  -d '{"data":"my-super-secret-api-key-test-123"}' | python -m json.tool

echo ""
echo "🧪 4. Test with Different Data Types"
echo "------------------------------------"

echo "Testing with JSON data:"
curl -s -X POST "$BASE_URL/test/encrypt" \
  -H "Content-Type: application/json" \
  -d '{"data":"{\"api_key\":\"sk-123\",\"secret\":\"password\"}"}' | python -m json.tool

echo ""
echo "Testing with special characters:"
curl -s -X POST "$BASE_URL/test/encrypt" \
  -H "Content-Type: application/json" \
  -d '{"data":"Special chars: !@#$%^&*()_+ 🔐 中文"}' | python -m json.tool

echo ""
echo "✅ API Testing Complete!"
echo "========================"