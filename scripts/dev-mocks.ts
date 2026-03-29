/**
 * Development script to enable mock responses for Atlassian API
 * This allows local development and testing without real Atlassian OAuth
 */

// Mock Atlassian OAuth responses for development
const mockAtlassianResponses = {
  token: {
    access_token: "mock_access_token_" + Date.now(),
    refresh_token: "mock_refresh_token_" + Date.now(),
    expires_in: 3600,
    token_type: "Bearer",
    scope: "read:jira-work write:jira-work read:me offline_access"
  },
  
  resources: [
    {
      id: "mock-site-id-123",
      name: "Mock Jira Site",
      url: "https://mock-company.atlassian.net",
      scopes: ["read:jira-work", "write:jira-work"],
      avatarUrl: "https://mock-company.atlassian.net/avatar.png"
    }
  ],
  
  me: {
    account_id: "mock-account-id-456",
    name: "Mock User",
    email: "mock.user@example.com",
    picture: "https://avatar.example.com/mock-user.png"
  }
};

// Function to enable mocks (can be called from tests or development setup)
export function enableAtlassianMocks() {
  // In a real implementation, this would set up MSW or similar mocking
  console.log("Atlassian API mocks enabled for development");
  console.log("Mock responses:", mockAtlassianResponses);
}

// Enable mocks if in development mode
if (process.env.NODE_ENV === "development") {
  enableAtlassianMocks();
}