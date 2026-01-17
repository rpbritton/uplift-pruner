# Privacy Policy

**Effective Date:** January 17, 2026

## Overview

Uplift Pruner is a privacy-focused tool that helps you remove uplift segments from your Strava activities. We are committed to protecting your privacy and being transparent about our data practices.

## What We Collect

### Authentication Data

- When you connect your Strava account, we receive an OAuth access token that allows us to access your Strava data on your behalf
- This token is stored in a session cookie in your browser

### Activity Data

- We temporarily access your Strava activity data (GPS tracks, segments, elevation, etc.) only when you explicitly select an activity to process
- This data is processed in real-time in your browser and on our serverless infrastructure

## How We Use Your Data

- **Activity Processing:** We use your Strava activity data solely to remove selected uplift segments and generate a modified FIT file
- **No Storage:** We do not store your activity data, GPS tracks, or any personal information on our servers
- **Session Management:** OAuth tokens are stored only in HTTP-only session cookies for the duration of your session

## What We Don't Do

- We do not sell, rent, or share your data with third parties
- We do not use your data for analytics, advertising, or any purpose other than the core functionality of removing uplift segments
- We do not track your activities or build profiles
- We do not store your activity data after processing

## Data Retention

- **Session Cookies:** Stored only while you are actively using the service
- **Activity Data:** Processed in real-time and immediately discarded after processing
- **No Long-term Storage:** We do not maintain any database of user activities or personal information

## Third-Party Services

### Strava

We connect to Strava via their official API to access your activity data. Your use of Strava is governed by [Strava's Privacy Policy](https://www.strava.com/legal/privacy) and [Terms of Service](https://www.strava.com/legal/terms).

### Cloudflare Pages

Our application is hosted on Cloudflare Pages. Cloudflare may collect standard web server logs. Please see [Cloudflare's Privacy Policy](https://www.cloudflare.com/privacypolicy/) for more information.

## Your Rights

You have the right to:

- Access your data by logging into your Strava account
- Revoke access at any time by disconnecting the app in your [Strava settings](https://www.strava.com/settings/apps)
- Request deletion of your session data by logging out

## Data Security

- All data transmission uses HTTPS encryption
- OAuth tokens are stored in HTTP-only cookies to prevent client-side access
- We implement security best practices to protect your data during processing

## Children's Privacy

Our service is not directed to individuals under the age of 18. We do not knowingly collect personal information from children.

## Changes to This Privacy Policy

We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated effective date.

## Contact

If you have questions about this Privacy Policy, please open an issue on our [GitHub repository](https://github.com/rpbritton/uplift-pruner) or contact us through Strava's developer support.

## Compliance

This privacy policy is designed to comply with:

- General Data Protection Regulation (GDPR)
- California Consumer Privacy Act (CCPA)
- Strava API Agreement requirements

## Open Source

Uplift Pruner is open source. You can review our code and data practices at [github.com/rpbritton/uplift-pruner](https://github.com/rpbritton/uplift-pruner).
