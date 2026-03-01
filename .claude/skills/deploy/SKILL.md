---
name: deploy
description: Build the Vite frontend and deploy to AWS using SAM (S3 + CloudFront + Lambda)
disable-model-invocation: true
---

# /deploy - AWS SAM Deployment

Deploy the Lanai Dive Conditions app to AWS.

## Prerequisites Check

Before deploying, verify:

```bash
# Check AWS CLI is configured
aws sts get-caller-identity

# Check SAM CLI is installed
sam --version
```

If either command fails, stop and inform the user.

## Deployment Steps

### 1. Run tests

```bash
npx vitest run
```

If any tests fail, stop and report the failures. Do not proceed with deployment.

### 2. Build the frontend

```bash
npx vite build
```

Verify `dist/` directory was created and contains `index.html`.

### 3. SAM build and deploy

```bash
sam build
sam deploy --guided
```

Use `--guided` only on first deploy (when `samconfig.toml` doesn't exist). On subsequent deploys:

```bash
sam build && sam deploy
```

### 4. Sync frontend assets to S3

After SAM deploy completes, get the bucket name and CloudFront distribution ID from the stack outputs:

```bash
# Get stack outputs
sam list stack-outputs --stack-name lanai-dive --output json

# Sync dist/ to S3
aws s3 sync dist/ s3://<FrontendBucket> --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id <CloudFrontDistributionId> --paths "/*"
```

### 5. Report results

After deployment, display:
- CloudFront URL from stack outputs
- API URL from stack outputs
- Confirmation that cache invalidation was created
