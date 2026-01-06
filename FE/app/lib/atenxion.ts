import axios from 'axios';
import { integrationApi, Integration } from './api';
import { User } from './api';

// Extended User type that allows role to be optional
type UserWithOptionalRole = Omit<User, 'role'> & {
  role?: User['role'];
};

// Types
export interface AtenxionSenderCredentials {
  agentId?: string;
  userId?: number;

}

export interface AtenxionRequestBody {
  userId: string;
  senderId?: string;
  agentId?: string;
  Authorization?: string;
  
}

function resolveServerUrl(): string {
  return process.env.NEXT_PUBLIC_ATENXION_API_URL;
}

// Helper function to get headers with token
function getHeaders(token: string | null): Record<string, string> | null {
  if (!token) return null;
  return {
    'Content-Type': 'application/json',
    'Authorization': `${token}`,
  };
}

// Fetch admin integration embed from MongoDB
export async function fetchSenderIntegrationEmbed(): Promise<Integration | null> {
  try {
    // Fetch all integrations from MongoDB
    const allIntegrations = await integrationApi.getAll();
    console.log('[fetchAdminIntegrationEmbed] Fetched integrations from MongoDB:', allIntegrations.length);
    
    // Find integration - look for one with atenxion widget or use the first one
    const embed = allIntegrations.find((int: Integration) => 
      int.iframeScriptTag?.includes('atenxion') || 
      int.iframeScriptTag?.includes('widget')
    ) || allIntegrations[0] || null;
    
    return embed;
  } catch (error) {
    console.error('[fetchAdminIntegrationEmbed] Error fetching integrations from MongoDB:', error);
    return null;
  }
}

// Normalize sender credentials (following the pattern from normalizeCredentials)
function normalizeSenderCredentials(
  credentials: AtenxionSenderCredentials,
  userToken: boolean = false
): AtenxionRequestBody {
  const userId = credentials.userId ? String(credentials.userId).trim() : '';
  const agentId = credentials.agentId?.trim();
  
  let authToken = "";
  
  if (userToken) {
    // Use user token for senders (if available)
    const userToken = typeof window !== 'undefined' ? localStorage.getItem("sender_session") : null;
    if (userToken) {
      authToken = userToken;
    }
  } else {
    // Use sender token from localStorage (if available)
    const stored = typeof window !== 'undefined' ? localStorage.getItem("sender_session") : null;
    if (stored) {
      try {
        authToken = JSON.parse(stored).token;
      } catch (e) {
        // If not JSON, use as-is
        authToken = stored;
      }
    }
  }
  
  const body: AtenxionRequestBody = {
    userId,
    senderId: userId, 
    agentId: agentId,
  };
  
  // Only set Authorization if we have a token
  if (authToken) {
    body.Authorization = authToken;
  }
  
  return body;
}

// Handle axios errors
function handleAxiosError(error: any, defaultMessage: string): boolean {
  console.error('Axios error:', error);
  return false;
}

// Main login function for Atenxion Sender (following the pattern from loginAtenxionUser)
export async function loginAtenxionSender(
  credentials: AtenxionSenderCredentials,
  // user: UserWithOptionalRole,
  token?: string | null,
  useAdminIntegration: boolean = true
): Promise<boolean> {
  const baseUrl = resolveServerUrl();

  // If no URL is configured, skip the Atenxion login
  if (!baseUrl) {
    console.warn("Atenxion sender login: NEXT_PUBLIC_ATENXION_API_URL is not configured, skipping Atenxion login");
    return false;
  }
  
  const url = `${baseUrl}/api/post-login/user-login`;
  console.log("Atenxion sender login URL:", url);

  let resolvedToken = token;

  if (!resolvedToken) {
    // Use admin integration for senders
    const embed = useAdminIntegration
      ? await fetchSenderIntegrationEmbed()
      : null;
    
    // Use contextualKey as contextKey (they're the same in our MongoDB schema)
    resolvedToken = embed?.contextualKey;
  }

  if (!resolvedToken) {
    console.warn("Atenxion sender login: No contextKey found in admin integration embed");
  }

  // Extract agentId from embed if not provided in credentials
  let agentId = credentials.agentId;

  if (!agentId) {
    const embed = await fetchSenderIntegrationEmbed();
    
    if (embed?.iframeScriptTag) {
      console.log('[loginAtenxionSender] Extracting agentId from embed...');
      
      // Extract agentchainId using the provided pattern
      const agentIdMatch = embed.iframeScriptTag.match(/agentchainId=([^&"']+)/);
      agentId = agentIdMatch ? agentIdMatch[1] : undefined;
      
      if (agentId) {
        console.log('token', token);
        console.log('[loginAtenxionSender] ✓ Extracted agentId (agentchainId):', agentId);
      } else {
        console.log('[loginAtenxionSender] No agentchainId found in embed');
      }
    }
    resolvedToken = embed?.contextualKey;
  }

  // Prepare credentials with userId and extracted agentId
  const credentialsWithExtracted: AtenxionSenderCredentials = {
    agentId: agentId || credentials.agentId,
    userId: credentials.userId,
  };
  const requestBody = normalizeSenderCredentials(credentialsWithExtracted, true);

  // If we have resolvedToken (contextKey from MongoDB), use it as Authorization in body
  // The contextKey from MongoDB is the token we need to send
  if (resolvedToken) {
    requestBody.Authorization = resolvedToken; // Use contextKey directly as token
  }

  const headers = getHeaders(resolvedToken); // Headers only for Content-Type, Authorization goes in body

  console.log("Atenxion sender login API call:", {
    url,  
    body: requestBody,
    headers,
    token: token ? token.substring(0, 20) + "..." : "none",
    hasContextKey: !!resolvedToken,
  });

  try {
    const pp = await axios.post(url, requestBody, { headers });
    console.log("Atenxion login response:", pp);
    return true;
  } catch (error) {
    console.error("Atenxion login failed:", error);
    if (axios.isAxiosError(error)) {
      console.error("Response status:", error.response?.status);
      console.error("Response data:", error.response?.data);
    }
    return handleAxiosError(error, "Unable to log in to Atenxion");
  }
}

