'use client';

import { useState } from 'react';

export default function TestGeneratorPage() {
  const [suiteId, setSuiteId] = useState<string>('');
  const [issueKey, setIssueKey] = useState<string>('PROJ-123');
  const [response, setResponse] = useState<any>(null);

  const createSuite = async () => {
    try {
      const res = await fetch('/api/generator/suite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueKey })
      });
      const data = await res.json();
      setResponse(data);
      if (data.id) setSuiteId(data.id);
    } catch (error) {
      setResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const createTestCase = async () => {
    if (!suiteId) return;
    try {
      const res = await fetch('/api/generator/case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suiteId,
          title: 'Test Case 1',
          description: 'Test description',
          steps: ['Step 1', 'Step 2']
        })
      });
      const data = await res.json();
      setResponse(data);
    } catch (error) {
      setResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const draftTestCases = async () => {
    try {
      const res = await fetch('/api/generator/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueKey,
          summary: 'User login functionality',
          description: 'Allow users to log in with email and password',
          acceptanceCriteria: 'User should be able to enter credentials and access the system'
        })
      });
      const data = await res.json();
      setResponse(data);
      if (data.suiteId) setSuiteId(data.suiteId);
    } catch (error) {
      setResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8">Test Generator API</h1>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Issue Key:</label>
          <input
            type="text"
            value={issueKey}
            onChange={(e) => setIssueKey(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={createSuite}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Create Suite
          </button>
          
          <button
            onClick={draftTestCases}
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
          >
            Draft Test Cases (LLM/Stub)
          </button>
          
          {suiteId && (
            <button
              onClick={createTestCase}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Create Test Case
            </button>
          )}
        </div>
        
        {response && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-2">Response:</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-auto">
              {JSON.stringify(response, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}