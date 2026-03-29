/**
 * Generate placeholder screenshot for simulated test results
 * Creates a realistic browser window with webpage mockup showing failure/success points
 */
export async function generatePlaceholderScreenshot(
  outputPath: string,
  status: 'success' | 'failure' | 'error',
  testTitle: string,
  failureReason?: string,
  environmentUrl?: string
): Promise<void> {
  const fs = await import('fs/promises');
  const timestamp = new Date().toLocaleString();

  // Use provided environment URL or default to example.com
  const baseUrl = environmentUrl || 'https://example.com';

  // Generate different webpage mockups based on test type
  const isLogin = testTitle.toLowerCase().includes('login') || testTitle.toLowerCase().includes('sign in');
  const isButton = testTitle.toLowerCase().includes('button');
  const isForm = testTitle.toLowerCase().includes('form') || testTitle.toLowerCase().includes('input');

  const svg = isLogin
    ? generateLoginPageScreenshot(status, testTitle, failureReason, timestamp, baseUrl)
    : isButton
    ? generateButtonTestScreenshot(status, testTitle, failureReason, timestamp, baseUrl)
    : isForm
    ? generateFormTestScreenshot(status, testTitle, failureReason, timestamp, baseUrl)
    : generateGenericPageScreenshot(status, testTitle, failureReason, timestamp, baseUrl);

  await fs.writeFile(outputPath, svg, 'utf-8');
}

/**
 * Generate login page screenshot with annotations
 */
function generateLoginPageScreenshot(
  status: 'success' | 'failure' | 'error',
  testTitle: string,
  failureReason: string | undefined,
  timestamp: string,
  baseUrl: string
): string {
  const highlightColor = status === 'success' ? '#10b981' : status === 'failure' ? '#ef4444' : '#f59e0b';
  const annotationBg = status === 'success' ? '#d1fae5' : status === 'failure' ? '#fee2e2' : '#fef3c7';

  // Extract path from base URL or use /login
  const urlPath = baseUrl.includes('/login') ? baseUrl : `${baseUrl}/login`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
  <!-- Browser Window Background -->
  <rect width="1280" height="720" fill="#f3f4f6"/>

  <!-- Browser Chrome -->
  <rect x="20" y="20" width="1240" height="40" fill="#e5e7eb" rx="8" ry="8"/>
  <circle cx="40" cy="40" r="6" fill="#ef4444"/>
  <circle cx="60" cy="40" r="6" fill="#f59e0b"/>
  <circle cx="80" cy="40" r="6" fill="#10b981"/>
  <rect x="120" y="30" width="600" height="20" fill="white" rx="10"/>
  <text x="130" y="45" font-family="monospace" font-size="12" fill="#6b7280">${escapeXml(urlPath)}</text>

  <!-- Page Content Area -->
  <rect x="20" y="65" width="1240" height="635" fill="white"/>

  <!-- Header -->
  <rect x="20" y="65" width="1240" height="60" fill="#1f2937"/>
  <text x="640" y="100" font-family="Arial, sans-serif" font-size="20" fill="white" text-anchor="middle" font-weight="bold">MyApp</text>

  <!-- Login Form Container -->
  <rect x="440" y="200" width="400" height="320" fill="#ffffff" stroke="#e5e7eb" stroke-width="2" rx="8"/>
  <text x="640" y="240" font-family="Arial, sans-serif" font-size="24" fill="#1f2937" text-anchor="middle" font-weight="bold">Sign In</text>

  <!-- Email Input -->
  <rect x="480" y="270" width="320" height="40" fill="#f9fafb" stroke="#d1d5db" stroke-width="1" rx="4"/>
  <text x="490" y="295" font-family="Arial, sans-serif" font-size="14" fill="#6b7280">user@example.com</text>

  <!-- Password Input -->
  <rect x="480" y="330" width="320" height="40" fill="#f9fafb" stroke="#d1d5db" stroke-width="1" rx="4"/>
  <text x="490" y="355" font-family="Arial, sans-serif" font-size="14" fill="#6b7280">••••••••</text>

  <!-- Login Button - Highlighted based on status -->
  <rect x="480" y="390" width="320" height="45" fill="#3b82f6" stroke="${highlightColor}" stroke-width="${status !== 'success' ? '4' : '1'}" rx="6"/>
  <text x="640" y="418" font-family="Arial, sans-serif" font-size="16" fill="white" text-anchor="middle" font-weight="bold">Login</text>

  ${status !== 'success' ? `
  <!-- Failure/Error Annotation Arrow -->
  <path d="M 850 412 L 870 412" stroke="${highlightColor}" stroke-width="3" marker-end="url(#arrowhead-${status})"/>
  <defs>
    <marker id="arrowhead-${status}" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
      <polygon points="0 0, 10 3, 0 6" fill="${highlightColor}"/>
    </marker>
  </defs>

  <!-- Annotation Box -->
  <rect x="880" y="360" width="360" height="110" fill="${annotationBg}" stroke="${highlightColor}" stroke-width="2" rx="6"/>
  <text x="900" y="385" font-family="Arial, sans-serif" font-size="14" fill="#1f2937" font-weight="bold">${status === 'failure' ? '❌ Test Failed' : '⚠️ Test Error'}</text>
  <text x="900" y="410" font-family="Arial, sans-serif" font-size="12" fill="#4b5563" style="word-wrap: break-word">
    ${wrapText(failureReason || 'Element not clickable', 40, 900, 410, 12)}
  </text>
  ` : `
  <!-- Success Annotation -->
  <rect x="880" y="380" width="340" height="70" fill="${annotationBg}" stroke="${highlightColor}" stroke-width="2" rx="6"/>
  <text x="900" y="405" font-family="Arial, sans-serif" font-size="14" fill="#065f46" font-weight="bold">✓ Test Passed</text>
  <text x="900" y="428" font-family="Arial, sans-serif" font-size="12" fill="#047857">Login button clicked successfully</text>
  <text x="900" y="445" font-family="Arial, sans-serif" font-size="12" fill="#047857">Redirected to dashboard</text>
  `}

  <!-- Footer Info -->
  <rect x="20" y="680" width="1240" height="20" fill="#f3f4f6"/>
  <text x="30" y="695" font-family="monospace" font-size="10" fill="#6b7280">${escapeXml(testTitle.substring(0, 100))}</text>
  <text x="1250" y="695" font-family="monospace" font-size="10" fill="#6b7280" text-anchor="end">${timestamp}</text>
</svg>`;
}

/**
 * Generate button test screenshot
 */
function generateButtonTestScreenshot(
  status: 'success' | 'failure' | 'error',
  testTitle: string,
  failureReason: string | undefined,
  timestamp: string,
  baseUrl: string
): string {
  const highlightColor = status === 'success' ? '#10b981' : status === 'failure' ? '#ef4444' : '#f59e0b';
  const annotationBg = status === 'success' ? '#d1fae5' : status === 'failure' ? '#fee2e2' : '#fef3c7';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
  <!-- Browser Window -->
  <rect width="1280" height="720" fill="#f3f4f6"/>
  <rect x="20" y="20" width="1240" height="40" fill="#e5e7eb" rx="8"/>
  <circle cx="40" cy="40" r="6" fill="#ef4444"/>
  <circle cx="60" cy="40" r="6" fill="#f59e0b"/>
  <circle cx="80" cy="40" r="6" fill="#10b981"/>
  <rect x="120" y="30" width="600" height="20" fill="white" rx="10"/>
  <text x="130" y="45" font-family="monospace" font-size="12" fill="#6b7280">${escapeXml(baseUrl)}</text>

  <!-- Page Content -->
  <rect x="20" y="65" width="1240" height="635" fill="white"/>

  <!-- Navigation -->
  <rect x="20" y="65" width="1240" height="50" fill="#1f2937"/>
  <text x="50" y="95" font-family="Arial, sans-serif" font-size="16" fill="white" font-weight="bold">Dashboard</text>

  <!-- Main Content -->
  <text x="50" y="160" font-family="Arial, sans-serif" font-size="28" fill="#1f2937" font-weight="bold">Welcome to Your Dashboard</text>
  <text x="50" y="200" font-family="Arial, sans-serif" font-size="16" fill="#6b7280">Manage your account and settings</text>

  <!-- Button Being Tested - Highlighted -->
  <rect x="50" y="250" width="200" height="50" fill="#3b82f6" stroke="${highlightColor}" stroke-width="${status !== 'success' ? '4' : '2'}" rx="6"/>
  <text x="150" y="280" font-family="Arial, sans-serif" font-size="16" fill="white" text-anchor="middle" font-weight="bold">Get Started</text>

  ${status !== 'success' ? `
  <!-- Failure Annotation -->
  <path d="M 260 275 L 300 275" stroke="${highlightColor}" stroke-width="3" marker-end="url(#arrow-${status})"/>
  <defs>
    <marker id="arrow-${status}" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
      <polygon points="0 0, 10 3, 0 6" fill="${highlightColor}"/>
    </marker>
  </defs>
  <rect x="310" y="220" width="400" height="120" fill="${annotationBg}" stroke="${highlightColor}" stroke-width="2" rx="6"/>
  <text x="330" y="245" font-family="Arial, sans-serif" font-size="14" fill="#1f2937" font-weight="bold">${status === 'failure' ? '❌ Assertion Failed' : '⚠️ Error Occurred'}</text>
  <text x="330" y="270" font-family="Arial, sans-serif" font-size="12" fill="#4b5563">Expected: "Submit"</text>
  <text x="330" y="290" font-family="Arial, sans-serif" font-size="12" fill="#4b5563">Actual: "Get Started"</text>
  <text x="330" y="315" font-family="Arial, sans-serif" font-size="11" fill="#6b7280">${escapeXml((failureReason || 'Button text mismatch').substring(0, 50))}</text>
  ` : `
  <!-- Success Annotation -->
  <path d="M 260 275 L 300 275" stroke="${highlightColor}" stroke-width="2" marker-end="url(#arrow-success)"/>
  <defs>
    <marker id="arrow-success" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
      <polygon points="0 0, 10 3, 0 6" fill="${highlightColor}"/>
    </marker>
  </defs>
  <rect x="310" y="235" width="350" height="85" fill="${annotationBg}" stroke="${highlightColor}" stroke-width="2" rx="6"/>
  <text x="330" y="260" font-family="Arial, sans-serif" font-size="14" fill="#065f46" font-weight="bold">✓ Verification Passed</text>
  <text x="330" y="283" font-family="Arial, sans-serif" font-size="12" fill="#047857">Button text verified: "Get Started"</text>
  <text x="330" y="303" font-family="Arial, sans-serif" font-size="12" fill="#047857">Element is clickable and visible</text>
  `}

  <!-- Footer -->
  <rect x="20" y="680" width="1240" height="20" fill="#f3f4f6"/>
  <text x="30" y="695" font-family="monospace" font-size="10" fill="#6b7280">${escapeXml(testTitle.substring(0, 100))}</text>
  <text x="1250" y="695" font-family="monospace" font-size="10" fill="#6b7280" text-anchor="end">${timestamp}</text>
</svg>`;
}

/**
 * Generate form test screenshot
 */
function generateFormTestScreenshot(
  status: 'success' | 'failure' | 'error',
  testTitle: string,
  failureReason: string | undefined,
  timestamp: string,
  baseUrl: string
): string {
  const highlightColor = status === 'success' ? '#10b981' : status === 'failure' ? '#ef4444' : '#f59e0b';
  const annotationBg = status === 'success' ? '#d1fae5' : status === 'failure' ? '#fee2e2' : '#fef3c7';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
  <rect width="1280" height="720" fill="#f3f4f6"/>
  <rect x="20" y="20" width="1240" height="40" fill="#e5e7eb" rx="8"/>
  <circle cx="40" cy="40" r="6" fill="#ef4444"/>
  <circle cx="60" cy="40" r="6" fill="#f59e0b"/>
  <circle cx="80" cy="40" r="6" fill="#10b981"/>
  <rect x="120" y="30" width="600" height="20" fill="white" rx="10"/>
  <text x="130" y="45" font-family="monospace" font-size="12" fill="#6b7280">${escapeXml(baseUrl)}</text>

  <rect x="20" y="65" width="1240" height="635" fill="white"/>
  <rect x="20" y="65" width="1240" height="50" fill="#1f2937"/>
  <text x="50" y="95" font-family="Arial, sans-serif" font-size="16" fill="white" font-weight="bold">Registration Form</text>

  <!-- Form Fields -->
  <text x="100" y="180" font-family="Arial, sans-serif" font-size="16" fill="#1f2937" font-weight="bold">Create Account</text>

  <text x="100" y="220" font-family="Arial, sans-serif" font-size="14" fill="#374151">Name</text>
  <rect x="100" y="230" width="400" height="40" fill="#f9fafb" stroke="${status === 'failure' && failureReason?.includes('Name') ? highlightColor : '#d1d5db'}" stroke-width="${status === 'failure' && failureReason?.includes('Name') ? '3' : '1'}" rx="4"/>

  <text x="100" y="300" font-family="Arial, sans-serif" font-size="14" fill="#374151">Email</text>
  <rect x="100" y="310" width="400" height="40" fill="#f9fafb" stroke="${status === 'failure' && failureReason?.includes('Email') ? highlightColor : '#d1d5db'}" stroke-width="${status === 'failure' && failureReason?.includes('Email') ? '3' : '1'}" rx="4"/>

  <rect x="100" y="380" width="150" height="45" fill="#3b82f6" stroke="${status !== 'success' ? highlightColor : '#3b82f6'}" stroke-width="${status !== 'success' ? '3' : '1'}" rx="6"/>
  <text x="175" y="408" font-family="Arial, sans-serif" font-size="16" fill="white" text-anchor="middle" font-weight="bold">Submit</text>

  ${status !== 'success' ? `
  <rect x="600" y="250" width="450" height="140" fill="${annotationBg}" stroke="${highlightColor}" stroke-width="2" rx="6"/>
  <text x="620" y="275" font-family="Arial, sans-serif" font-size="14" fill="#1f2937" font-weight="bold">${status === 'failure' ? '❌ Validation Failed' : '⚠️ Form Error'}</text>
  <text x="620" y="300" font-family="Arial, sans-serif" font-size="12" fill="#4b5563">${escapeXml((failureReason || 'Required field missing').substring(0, 55))}</text>
  <text x="620" y="325" font-family="Arial, sans-serif" font-size="12" fill="#6b7280">The form did not submit as expected</text>
  <text x="620" y="345" font-family="Arial, sans-serif" font-size="12" fill="#6b7280">Check validation rules and error messages</text>
  ` : `
  <rect x="600" y="280" width="400" height="90" fill="${annotationBg}" stroke="${highlightColor}" stroke-width="2" rx="6"/>
  <text x="620" y="305" font-family="Arial, sans-serif" font-size="14" fill="#065f46" font-weight="bold">✓ Form Submitted Successfully</text>
  <text x="620" y="328" font-family="Arial, sans-serif" font-size="12" fill="#047857">All fields validated correctly</text>
  <text x="620" y="348" font-family="Arial, sans-serif" font-size="12" fill="#047857">Form submission completed</text>
  `}

  <rect x="20" y="680" width="1240" height="20" fill="#f3f4f6"/>
  <text x="30" y="695" font-family="monospace" font-size="10" fill="#6b7280">${escapeXml(testTitle.substring(0, 100))}</text>
  <text x="1250" y="695" font-family="monospace" font-size="10" fill="#6b7280" text-anchor="end">${timestamp}</text>
</svg>`;
}

/**
 * Generate generic page screenshot
 */
function generateGenericPageScreenshot(
  status: 'success' | 'failure' | 'error',
  testTitle: string,
  failureReason: string | undefined,
  timestamp: string,
  baseUrl: string
): string {
  const highlightColor = status === 'success' ? '#10b981' : status === 'failure' ? '#ef4444' : '#f59e0b';
  const annotationBg = status === 'success' ? '#d1fae5' : status === 'failure' ? '#fee2e2' : '#fef3c7';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
  <rect width="1280" height="720" fill="#f3f4f6"/>
  <rect x="20" y="20" width="1240" height="40" fill="#e5e7eb" rx="8"/>
  <circle cx="40" cy="40" r="6" fill="#ef4444"/>
  <circle cx="60" cy="40" r="6" fill="#f59e0b"/>
  <circle cx="80" cy="40" r="6" fill="#10b981"/>
  <rect x="120" y="30" width="600" height="20" fill="white" rx="10"/>
  <text x="130" y="45" font-family="monospace" font-size="12" fill="#6b7280">${escapeXml(baseUrl)}</text>

  <rect x="20" y="65" width="1240" height="635" fill="white"/>
  <rect x="20" y="65" width="1240" height="50" fill="#1f2937"/>
  <text x="50" y="95" font-family="Arial, sans-serif" font-size="16" fill="white" font-weight="bold">Application Page</text>

  <!-- Generic content with highlight -->
  <rect x="100" y="200" width="600" height="300" fill="#f9fafb" stroke="${highlightColor}" stroke-width="3" rx="8"/>
  <text x="400" y="240" font-family="Arial, sans-serif" font-size="18" fill="#1f2937" text-anchor="middle" font-weight="bold">Test Area</text>
  <text x="400" y="280" font-family="Arial, sans-serif" font-size="14" fill="#6b7280" text-anchor="middle">Element under test</text>

  ${status !== 'success' ? `
  <rect x="750" y="250" width="450" height="130" fill="${annotationBg}" stroke="${highlightColor}" stroke-width="2" rx="6"/>
  <text x="770" y="275" font-family="Arial, sans-serif" font-size="14" fill="#1f2937" font-weight="bold">${status === 'failure' ? '❌ Test Failed' : '⚠️ Test Error'}</text>
  <text x="770" y="300" font-family="Arial, sans-serif" font-size="12" fill="#4b5563">${escapeXml((failureReason || 'Test condition not met').substring(0, 60))}</text>
  <text x="770" y="325" font-family="Arial, sans-serif" font-size="11" fill="#6b7280">Check element state and expected values</text>
  ` : `
  <rect x="750" y="280" width="400" height="80" fill="${annotationBg}" stroke="${highlightColor}" stroke-width="2" rx="6"/>
  <text x="770" y="305" font-family="Arial, sans-serif" font-size="14" fill="#065f46" font-weight="bold">✓ Test Passed</text>
  <text x="770" y="328" font-family="Arial, sans-serif" font-size="12" fill="#047857">All assertions verified successfully</text>
  <text x="770" y="348" font-family="Arial, sans-serif" font-size="12" fill="#047857">Test completed as expected</text>
  `}

  <rect x="20" y="680" width="1240" height="20" fill="#f3f4f6"/>
  <text x="30" y="695" font-family="monospace" font-size="10" fill="#6b7280">${escapeXml(testTitle.substring(0, 100))}</text>
  <text x="1250" y="695" font-family="monospace" font-size="10" fill="#6b7280" text-anchor="end">${timestamp}</text>
</svg>`;
}

/**
 * Helper to wrap text (simplified for SVG text elements)
 */
function wrapText(text: string, maxChars: number, x: number, y: number, fontSize: number): string {
  const words = text.split(' ');
  let lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + word).length > maxChars) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  }
  if (currentLine) lines.push(currentLine.trim());

  return lines.slice(0, 3).map((line, i) =>
    `<tspan x="${x}" dy="${i === 0 ? 0 : fontSize + 4}">${escapeXml(line)}</tspan>`
  ).join('');
}

/**
 * Escape XML special characters
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
