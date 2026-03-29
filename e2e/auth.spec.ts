import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/login');
    
    await expect(page).toHaveTitle(/QA CaseForge/);
    await expect(page.getByRole('heading', { name: 'Sign in to QA CaseForge' })).toBeVisible();
    
    // Check for email input
    await expect(page.getByLabel('Email address')).toBeVisible();
    
    // Check for magic link button
    await expect(page.getByRole('button', { name: 'Send magic link' })).toBeVisible();
    
    // Check for Jira connect button
    await expect(page.getByRole('button', { name: 'Connect Jira' })).toBeVisible();
  });

  test('should send magic link', async ({ page }) => {
    await page.goto('/login');
    
    // Fill email
    await page.getByLabel('Email address').fill('test@example.com');
    
    // Submit magic link form
    await page.getByRole('button', { name: 'Send magic link' }).click();
    
    // Should show success message
    await expect(page.getByText('Magic link sent!')).toBeVisible();
  });

  test('should redirect to dashboard after login', async ({ page, context }) => {
    // Mock magic link callback
    await page.goto('/api/auth/magic-link/callback?token=test-token');
    
    // Should redirect to dashboard
    await page.waitForURL('/');
    await expect(page.getByText('QA CaseForge Dashboard')).toBeVisible();
  });
});

test.describe('OAuth Flow', () => {
  test('should start OAuth flow when authenticated', async ({ page }) => {
    // First login with magic link
    await page.goto('/api/auth/magic-link/callback?token=test-token');
    await page.waitForURL('/');
    
    // Go back to login to test Jira connect
    await page.goto('/login');
    
    // Click Connect Jira button
    await page.getByRole('button', { name: 'Connect Jira' }).click();
    
    // Should redirect to Atlassian (or show error in dev mode)
    // In real test, we'd mock the OAuth endpoints
  });
});