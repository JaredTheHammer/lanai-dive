# Lanai Dive Conditions - Deployment Guide

## Architecture

```
iPhone (PWA)  -->  CloudFront  -->  S3 (static frontend)
                      |
                      +-------->  Lambda Function URL (API proxy)
                                      |
                                      +-> NOAA CO-OPS (tides)
                                      +-> NWS api.weather.gov (wind/rain)
                                      +-> NDBC 51213 (swell/wave)
```

## Prerequisites

```powershell
# Install SAM CLI (winget)
winget install Amazon.SAM-CLI

# Verify tools
aws --version
sam --version
node --version
```

## Local Development

```powershell
cd lanai-dive
npm install
npm run dev
# Opens at http://localhost:5173
# Vite proxy handles CORS for all APIs
```

## Deploy to AWS

### Step 1: Build and deploy the stack

```powershell
cd lanai-dive
sam build
sam deploy --guided --stack-name lanai-dive
```

### Step 2: Capture stack outputs

```powershell
$BUCKET = (aws cloudformation describe-stacks --stack-name lanai-dive --query "Stacks[0].Outputs[?OutputKey=='FrontendBucket'].OutputValue" --output text)
$CF_ID = (aws cloudformation describe-stacks --stack-name lanai-dive --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" --output text)
$CF_URL = (aws cloudformation describe-stacks --stack-name lanai-dive --query "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue" --output text)

Write-Host "Bucket:  $BUCKET"
Write-Host "CF ID:   $CF_ID"
Write-Host "URL:     $CF_URL"
```

### Step 3: Upload frontend to S3

```powershell
aws s3 sync dist/ "s3://$BUCKET" --delete
```

### Step 4: Invalidate CloudFront cache

```powershell
aws cloudfront create-invalidation --distribution-id $CF_ID --paths "/*"
```

### Step 5: Open your site

```powershell
Start-Process $CF_URL
```

## Redeploy after code changes

```powershell
npm run build
aws s3 sync dist/ "s3://$BUCKET" --delete
aws cloudfront create-invalidation --distribution-id $CF_ID --paths "/*"
```

## Tear down (remove everything)

```powershell
aws s3 rm "s3://$BUCKET" --recursive
sam delete --stack-name lanai-dive
```

## iPhone Installation

1. Open the CloudFront URL in Safari on iPhone
2. Tap the Share button (box with arrow)
3. Tap "Add to Home Screen"
4. The app appears as a standalone icon with no browser chrome

## Data Sources

| Source | Station | Update Freq | What it provides |
|--------|---------|-------------|------------------|
| NOAA CO-OPS | 1615680 (Kahului) | 6-min | Tide predictions |
| NWS | HFO gridpoint | 1-hr | Wind, rain, forecast |
| NDBC | 51213 (Lanai SW) | 30-min | Wave height, period, direction, water temp |

## Scoring Algorithm

Composite 0-100 score with weighted factors:

- **Wind (25%)**: Speed + offshore/onshore direction for south/west Lanai
- **Swell (25%)**: Wave height, period (ground vs wind swell), exposure
- **Tide (15%)**: Rate of change (slack = best), rising tide bonus
- **Rain/Runoff (20%)**: 24h/48h precipitation affecting visibility
- **Visibility (15%)**: Derived estimate from rain, swell, wind, tide

## Phase 2: Alerts (TODO)

Architecture for condition alerts:

- EventBridge rule: every 30 min
- Lambda: fetch conditions, compute score, compare to threshold
- DynamoDB: subscriber table (email, phone, threshold preferences)
- SNS: SMS notifications
- SES: Email digests
- API Gateway: subscriber management endpoints
