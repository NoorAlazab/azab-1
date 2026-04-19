export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { denyIfProduction } from "@/lib/security/debugGate";

export async function GET() {
  const blocked = denyIfProduction();
  if (blocked) return blocked;

  const groqKey = process.env.GROQ_API_KEY;
  
  console.log('Testing Groq API key:', {
    hasKey: !!groqKey,
    keyPreview: groqKey ? groqKey.substring(0, 20) + '...' : 'none'
  });

  if (!groqKey) {
    return NextResponse.json({ 
      error: 'No Groq API key found',
      hasKey: false 
    });
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        temperature: 0.3,
        messages: [{ role: "user", content: "Say 'Hello World' in JSON format: {\"message\": \"Hello World\"}" }],
        max_tokens: 50,
      }),
    });

    console.log('Groq API response:', response.status, response.ok);
    
    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({ 
        success: true, 
        hasKey: true,
        apiResponse: data.choices[0].message.content
      });
    } else {
      const errorText = await response.text();
      console.log('Groq API error:', errorText);
      return NextResponse.json({ 
        error: 'Groq API failed', 
        status: response.status,
        details: errorText 
      });
    }
  } catch (error: any) {
    console.log('Groq API exception:', error);
    return NextResponse.json({ 
      error: 'Exception calling Groq API', 
      message: error.message 
    });
  }
}