#!/usr/bin/env bash
set -euo pipefail

# =========================================================================
# Lanai Dive Conditions -- Deployment Script
#
# Usage:
#   ./infra/deploy.sh [stack|site|all] [--stage prod|staging]
#
# Prerequisites:
#   - AWS CLI v2 configured with appropriate credentials
#   - AWS SAM CLI installed (for Lambda packaging)
#   - Node.js 20+
#   - VAPID keys generated (see: npx web-push generate-vapid-keys)
# =========================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
STAGE="prod"
ACTION="all"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    stack|site|all) ACTION="$1"; shift ;;
    --stage) STAGE="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

STACK_NAME="lanai-dive-${STAGE}"
REGION="${AWS_REGION:-us-east-1}"

echo "========================================="
echo "  Lanai Dive Deploy"
echo "  Action: ${ACTION} | Stage: ${STAGE}"
echo "  Region: ${REGION}"
echo "========================================="

# -------------------------------------------------------------------------
# Deploy CloudFormation stack (SAM)
# -------------------------------------------------------------------------
deploy_stack() {
  echo ""
  echo ">>> Deploying CloudFormation stack..."

  cd "$SCRIPT_DIR"

  # Install push Lambda dependencies
  echo "  Installing push Lambda dependencies..."
  cd lambda-push && npm ci --production && cd ..

  # SAM build + deploy
  sam build --template template.yaml --use-container

  sam deploy \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
    --resolve-s3 \
    --no-confirm-changeset \
    --parameter-overrides \
      "Stage=${STAGE}" \
      "VapidPublicKey=${VAPID_PUBLIC_KEY:?Set VAPID_PUBLIC_KEY env var}" \
      "VapidPrivateKey=${VAPID_PRIVATE_KEY:?Set VAPID_PRIVATE_KEY env var}" \
      "VapidSubject=${VAPID_SUBJECT:-mailto:jared.m.hamm@gmail.com}" \
      ${DOMAIN_NAME:+DomainName=${DOMAIN_NAME}} \
      ${CERTIFICATE_ARN:+CertificateArn=${CERTIFICATE_ARN}}

  echo "  Stack deployed successfully."

  # Extract outputs
  BUCKET=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='SiteBucketName'].OutputValue" \
    --output text)
  DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
    --output text)
  SITE_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='SiteUrl'].OutputValue" \
    --output text)
  API_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='ApiProxyUrl'].OutputValue" \
    --output text)
  PUSH_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='PushSubscribeUrl'].OutputValue" \
    --output text)

  echo ""
  echo "  Bucket:          ${BUCKET}"
  echo "  Distribution:    ${DISTRIBUTION_ID}"
  echo "  Site URL:        ${SITE_URL}"
  echo "  API Proxy URL:   ${API_URL}"
  echo "  Push Subscribe:  ${PUSH_URL}"
}

# -------------------------------------------------------------------------
# Build & deploy site to S3 + invalidate CloudFront
# -------------------------------------------------------------------------
deploy_site() {
  echo ""
  echo ">>> Building site..."

  cd "$PROJECT_DIR"

  # Get stack outputs if not already set
  if [[ -z "${BUCKET:-}" ]]; then
    BUCKET=$(aws cloudformation describe-stacks \
      --stack-name "$STACK_NAME" --region "$REGION" \
      --query "Stacks[0].Outputs[?OutputKey=='SiteBucketName'].OutputValue" \
      --output text)
    DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
      --stack-name "$STACK_NAME" --region "$REGION" \
      --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
      --output text)
    API_URL=$(aws cloudformation describe-stacks \
      --stack-name "$STACK_NAME" --region "$REGION" \
      --query "Stacks[0].Outputs[?OutputKey=='ApiProxyUrl'].OutputValue" \
      --output text)
    PUSH_URL=$(aws cloudformation describe-stacks \
      --stack-name "$STACK_NAME" --region "$REGION" \
      --query "Stacks[0].Outputs[?OutputKey=='PushSubscribeUrl'].OutputValue" \
      --output text)
  fi

  # Build with production API base URL
  # The API proxy Lambda URL serves as VITE_API_BASE, but we strip the trailing /
  # so that /api/tides maps correctly
  VITE_API_BASE="" \
  VITE_PUSH_SUBSCRIBE_URL="${PUSH_URL}" \
  VITE_VAPID_PUBLIC_KEY="${VAPID_PUBLIC_KEY}" \
    npm run build

  echo "  Build complete. Uploading to S3..."

  # Sync with smart caching headers
  # HTML: no-cache (always revalidate)
  aws s3 sync dist/ "s3://${BUCKET}/" \
    --delete \
    --region "$REGION" \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "*.html" \
    --exclude "sw.js" \
    --exclude "manifest.webmanifest"

  # HTML files: must revalidate
  aws s3 sync dist/ "s3://${BUCKET}/" \
    --region "$REGION" \
    --cache-control "no-cache" \
    --exclude "*" \
    --include "*.html"

  # Service worker: must revalidate
  aws s3 cp dist/sw.js "s3://${BUCKET}/sw.js" \
    --region "$REGION" \
    --cache-control "no-cache" \
    2>/dev/null || true

  # Manifest: short cache
  aws s3 cp dist/manifest.webmanifest "s3://${BUCKET}/manifest.webmanifest" \
    --region "$REGION" \
    --cache-control "public, max-age=3600" \
    2>/dev/null || true

  echo "  Upload complete. Invalidating CloudFront..."

  aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "/*" \
    --region "$REGION" \
    --output text

  echo ""
  echo "========================================="
  echo "  Deployment complete!"
  echo "  ${SITE_URL:-https://<distribution>.cloudfront.net}"
  echo "========================================="
}

# -------------------------------------------------------------------------
# Main
# -------------------------------------------------------------------------
case "$ACTION" in
  stack) deploy_stack ;;
  site)  deploy_site ;;
  all)   deploy_stack && deploy_site ;;
esac
