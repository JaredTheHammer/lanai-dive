# =========================================================================
# Lanai Dive Conditions -- Deployment Script (PowerShell)
#
# Usage:
#   .\infra\deploy.ps1 [-Action stack|site|all] [-Stage prod|staging]
#
# Prerequisites:
#   - AWS CLI v2 configured with appropriate credentials
#   - AWS SAM CLI installed (for Lambda packaging)
#   - Node.js 20+
#   - VAPID keys generated (see: npx web-push generate-vapid-keys)
#   - Docker NOT required (native build, no container deps)
#
# Environment variables (set before running):
#   $env:VAPID_PUBLIC_KEY  = "<your base64url public key>"
#   $env:VAPID_PRIVATE_KEY = "<your base64url private key>"
#   $env:VAPID_SUBJECT     = "mailto:jared.m.hamm@gmail.com"  (optional)
#   $env:DOMAIN_NAME       = "dive.lanai.app"                  (optional)
#   $env:CERTIFICATE_ARN   = "arn:aws:acm:..."                 (optional)
# =========================================================================

param(
    [ValidateSet("stack", "site", "all")]
    [string]$Action = "all",

    [ValidateSet("prod", "staging")]
    [string]$Stage = "prod"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$StackName = "lanai-dive-$Stage"
$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-east-1" }

Write-Host "========================================="
Write-Host "  Lanai Dive Deploy"
Write-Host "  Action: $Action | Stage: $Stage"
Write-Host "  Region: $Region"
Write-Host "========================================="

# -------------------------------------------------------------------------
# Deploy CloudFormation stack (SAM)
# -------------------------------------------------------------------------
function Deploy-Stack {
    Write-Host ""
    Write-Host ">>> Deploying CloudFormation stack..."

    Push-Location $ScriptDir

    # Install push Lambda dependencies
    Write-Host "  Installing push Lambda dependencies..."
    Push-Location lambda-push
    npm ci --production
    Pop-Location

    # SAM build + deploy
    # Build natively (no Docker required -- both Lambdas are pure ESM, no native deps)
    sam build --template template.yaml

    $samParams = @(
        "--stack-name", $StackName,
        "--region", $Region,
        "--capabilities", "CAPABILITY_IAM", "CAPABILITY_AUTO_EXPAND",
        "--resolve-s3",
        "--no-confirm-changeset",
        "--parameter-overrides"
    )

    if (-not $env:VAPID_PUBLIC_KEY) { throw "Set `$env:VAPID_PUBLIC_KEY before deploying" }
    if (-not $env:VAPID_PRIVATE_KEY) { throw "Set `$env:VAPID_PRIVATE_KEY before deploying" }

    $overrides = @(
        "Stage=$Stage",
        "VapidPublicKey=$($env:VAPID_PUBLIC_KEY)",
        "VapidPrivateKey=$($env:VAPID_PRIVATE_KEY)",
        "VapidSubject=$( if ($env:VAPID_SUBJECT) { $env:VAPID_SUBJECT } else { 'mailto:jared.m.hamm@gmail.com' } )"
    )

    if ($env:DOMAIN_NAME) { $overrides += "DomainName=$($env:DOMAIN_NAME)" }
    if ($env:CERTIFICATE_ARN) { $overrides += "CertificateArn=$($env:CERTIFICATE_ARN)" }

    sam deploy @samParams @overrides

    Pop-Location

    Write-Host "  Stack deployed successfully."
    Get-StackOutputs
}

function Get-StackOutputs {
    $script:Bucket = (aws cloudformation describe-stacks `
        --stack-name $StackName --region $Region `
        --query "Stacks[0].Outputs[?OutputKey=='SiteBucketName'].OutputValue" `
        --output text)
    $script:DistributionId = (aws cloudformation describe-stacks `
        --stack-name $StackName --region $Region `
        --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" `
        --output text)
    $script:SiteUrl = (aws cloudformation describe-stacks `
        --stack-name $StackName --region $Region `
        --query "Stacks[0].Outputs[?OutputKey=='SiteUrl'].OutputValue" `
        --output text)
    $script:ApiUrl = (aws cloudformation describe-stacks `
        --stack-name $StackName --region $Region `
        --query "Stacks[0].Outputs[?OutputKey=='ApiProxyUrl'].OutputValue" `
        --output text)
    $script:PushUrl = (aws cloudformation describe-stacks `
        --stack-name $StackName --region $Region `
        --query "Stacks[0].Outputs[?OutputKey=='PushSubscribeUrl'].OutputValue" `
        --output text)

    Write-Host ""
    Write-Host "  Bucket:          $Bucket"
    Write-Host "  Distribution:    $DistributionId"
    Write-Host "  Site URL:        $SiteUrl"
    Write-Host "  API Proxy URL:   $ApiUrl"
    Write-Host "  Push Subscribe:  $PushUrl"
}

# -------------------------------------------------------------------------
# Build & deploy site to S3 + invalidate CloudFront
# -------------------------------------------------------------------------
function Deploy-Site {
    Write-Host ""
    Write-Host ">>> Building site..."

    Push-Location $ProjectDir

    if (-not $script:Bucket) { Get-StackOutputs }

    # Build with production environment
    $env:VITE_API_BASE = ""
    $env:VITE_PUSH_SUBSCRIBE_URL = $script:PushUrl
    $env:VITE_VAPID_PUBLIC_KEY = $env:VAPID_PUBLIC_KEY

    npm run build

    Write-Host "  Build complete. Uploading to S3..."

    # Hashed assets: immutable cache
    aws s3 sync dist/ "s3://$Bucket/" `
        --delete `
        --region $Region `
        --cache-control "public, max-age=31536000, immutable" `
        --exclude "*.html" `
        --exclude "sw.js" `
        --exclude "manifest.webmanifest"

    # HTML: must revalidate
    aws s3 sync dist/ "s3://$Bucket/" `
        --region $Region `
        --cache-control "no-cache" `
        --exclude "*" `
        --include "*.html"

    # Service worker: must revalidate
    if (Test-Path dist/sw.js) {
        aws s3 cp dist/sw.js "s3://$Bucket/sw.js" `
            --region $Region `
            --cache-control "no-cache"
    }

    # Manifest: short cache
    if (Test-Path dist/manifest.webmanifest) {
        aws s3 cp dist/manifest.webmanifest "s3://$Bucket/manifest.webmanifest" `
            --region $Region `
            --cache-control "public, max-age=3600"
    }

    Write-Host "  Upload complete. Invalidating CloudFront..."

    aws cloudfront create-invalidation `
        --distribution-id $DistributionId `
        --paths "/*" `
        --region $Region `
        --output text

    Pop-Location

    Write-Host ""
    Write-Host "========================================="
    Write-Host "  Deployment complete!"
    Write-Host "  $SiteUrl"
    Write-Host "========================================="
}

# -------------------------------------------------------------------------
# Main
# -------------------------------------------------------------------------
switch ($Action) {
    "stack" { Deploy-Stack }
    "site"  { Deploy-Site }
    "all"   { Deploy-Stack; Deploy-Site }
}
