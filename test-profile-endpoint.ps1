$ErrorActionPreference = "SilentlyContinue"

# Test the profile endpoint with detailed logging
$url = "https://campus-valentine-backend.campusvalentine.workers.dev/api/health"

# First check health
Write-Host "Testing health endpoint..."
$healthResponse = Invoke-WebRequest -Uri $url -Method GET -ContentType "application/json"
Write-Host "Health Status: $($healthResponse.StatusCode)"
Write-Host "Health Response: $($healthResponse.Content)"

# Now check the actual ProfileSetup frontend to see the exact request being sent
Write-Host "`nChecking browser network logs would require running the app..."
Write-Host "Instead, let's trace the actual ProfileSetup.jsx request format..."
