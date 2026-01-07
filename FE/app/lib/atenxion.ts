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
  userId?: string;
  role?: string;
}

export interface AtenxionRequestBody {
  userId: string;
  senderId?: string;
  agentId?: string;
  role?: string;
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

// Fetch integration embed from MongoDB filtered by role
export async function fetchSenderIntegrationEmbed(role?: 'SENDER' | 'DISPATCHER' | 'COURIER' | 'ADMIN'): Promise<Integration | null> {
  try {
    // Fetch all integrations from MongoDB
    const allIntegrations = await integrationApi.getAll();
    console.log('[fetchSenderIntegrationEmbed] Fetched integrations from MongoDB:', allIntegrations.length);
    
    // Filter integrations based on role
    const filteredIntegrations = allIntegrations.filter((int: Integration) => {
      // If no role is set on integration, show it to everyone
      if (!int.role) {
        console.log('[fetchSenderIntegrationEmbed] Including integration (no role):', int.contextualKey);
        return true;
      }
      // If role is provided, show integrations matching that role
      if (role) {
        const matches = int.role === role;
        console.log(`[fetchSenderIntegrationEmbed] Integration ${int.contextualKey} (role: ${int.role}) matches requested role (${role}):`, matches);
        return matches;
      }
      // If no role provided, only show integrations with no role
      return false;
    });
    
    console.log(`[fetchSenderIntegrationEmbed] Filtered ${filteredIntegrations.length} integrations for role: ${role || 'none'}`);
    
    // Find integration - look for one with atenxion widget or use the first one
    const embed = filteredIntegrations.find((int: Integration) => 
      int.iframeScriptTag?.includes('atenxion') || 
      int.iframeScriptTag?.includes('widget')
    ) || filteredIntegrations[0] || null;
    
    console.log('[fetchSenderIntegrationEmbed] Selected embed:', embed?.contextualKey || 'none');
    
    return embed;
  } catch (error) {
    console.error('[fetchSenderIntegrationEmbed] Error fetching integrations from MongoDB:', error);
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
    role: credentials.role,
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
  token?: string | null,
  userRole?: 'SENDER' | 'DISPATCHER' | 'COURIER' | 'ADMIN',
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

  // Determine role from parameter or default to SENDER
  const role = userRole || 'SENDER';
  
  if (!resolvedToken) {
    // Use integration filtered by role
    const embed = useAdminIntegration
      ? await fetchSenderIntegrationEmbed(role)
      : null;
    
    // Use contextualKey as contextKey (they're the same in our MongoDB schema)
    resolvedToken = embed?.contextualKey;
  }

  if (!resolvedToken) {
    console.warn("Atenxion sender login: No contextKey found in integration embed");
  }

  // Extract agentId from embed if not provided in credentials
  let agentId = credentials.agentId;

  if (!agentId) {
    const embed = await fetchSenderIntegrationEmbed(role);
    
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
    role: role,
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

// Main login function for Atenxion Courier
export async function loginAtenxionCourier(
  credentials: AtenxionSenderCredentials,
  token?: string | null,
  useAdminIntegration: boolean = true
): Promise<boolean> {
  const baseUrl = resolveServerUrl();

  // If no URL is configured, skip the Atenxion login
  if (!baseUrl) {
    console.warn("Atenxion courier login: NEXT_PUBLIC_ATENXION_API_URL is not configured, skipping Atenxion login");
    return false;
  }
  
  const url = `${baseUrl}/api/post-login/user-login`;
  console.log("Atenxion courier login URL:", url);

  let resolvedToken = token;

  // Use COURIER role
  const userRole = 'COURIER';
  
  if (!resolvedToken) {
    // Use integration filtered by role
    const embed = useAdminIntegration
      ? await fetchSenderIntegrationEmbed(userRole)
      : null;
    
    // Use contextualKey as contextKey (they're the same in our MongoDB schema)
    resolvedToken = embed?.contextualKey;
  }

  if (!resolvedToken) {
    console.warn("Atenxion courier login: No contextKey found in integration embed");
  }

  // Extract agentId from embed if not provided in credentials
  let agentId = credentials.agentId;

  if (!agentId) {
    const embed = await fetchSenderIntegrationEmbed(userRole);
    
    if (embed?.iframeScriptTag) {
      console.log('[loginAtenxionCourier] Extracting agentId from embed...');
      
      // Extract agentchainId using the provided pattern
      const agentIdMatch = embed.iframeScriptTag.match(/agentchainId=([^&"']+)/);
      agentId = agentIdMatch ? agentIdMatch[1] : undefined;
      
      if (agentId) {
        console.log('[loginAtenxionCourier] ✓ Extracted agentId (agentchainId):', agentId);
      } else {
        console.log('[loginAtenxionCourier] No agentchainId found in embed');
      }
    }
    resolvedToken = embed?.contextualKey;
  }

  // Prepare credentials with userId and extracted agentId
  const credentialsWithExtracted: AtenxionSenderCredentials = {
    agentId: agentId || credentials.agentId,
    userId: credentials.userId,
    role: userRole,
  };
  const requestBody = normalizeSenderCredentials(credentialsWithExtracted, true);

  // If we have resolvedToken (contextKey from MongoDB), use it as Authorization in body
  // The contextKey from MongoDB is the token we need to send
  if (resolvedToken) {
    requestBody.Authorization = resolvedToken; // Use contextKey directly as token
  }

  const headers = getHeaders(resolvedToken); // Headers only for Content-Type, Authorization goes in body

  console.log("Atenxion courier login API call:", {
    url,  
    body: requestBody,
    headers,
    token: token ? token.substring(0, 20) + "..." : "none",
    hasContextKey: !!resolvedToken,
  });

  try {
    const pp = await axios.post(url, requestBody, { headers });
    console.log("Atenxion courier login response:", pp);
    return true;
  } catch (error) {
    console.error("Atenxion courier login failed:", error);
    if (axios.isAxiosError(error)) {
      console.error("Response status:", error.response?.status);
      console.error("Response data:", error.response?.data);
    }
    return handleAxiosError(error, "Unable to log in to Atenxion");
  }
}

// Main login function for Atenxion Dispatcher
export async function loginAtenxionDispatcher(
  credentials: AtenxionSenderCredentials,
  token?: string | null,
  useAdminIntegration: boolean = true
): Promise<boolean> {
  const baseUrl = resolveServerUrl();

  // If no URL is configured, skip the Atenxion login
  if (!baseUrl) {
    console.warn("Atenxion dispatcher login: NEXT_PUBLIC_ATENXION_API_URL is not configured, skipping Atenxion login");
    return false;
  }
  
  const url = `${baseUrl}/api/post-login/user-login`;
  console.log("Atenxion dispatcher login URL:", url);

  let resolvedToken = token;

  // Use DISPATCHER role
  const userRole = 'DISPATCHER';
  
  if (!resolvedToken) {
    // Use integration filtered by role
    const embed = useAdminIntegration
      ? await fetchSenderIntegrationEmbed(userRole)
      : null;
    
    // Use contextualKey as contextKey (they're the same in our MongoDB schema)
    resolvedToken = embed?.contextualKey;
  }

  if (!resolvedToken) {
    console.warn("Atenxion dispatcher login: No contextKey found in integration embed");
  }

  // Extract agentId from embed if not provided in credentials
  let agentId = credentials.agentId;

  if (!agentId) {
    const embed = await fetchSenderIntegrationEmbed(userRole);
    
    if (embed?.iframeScriptTag) {
      console.log('[loginAtenxionDispatcher] Extracting agentId from embed...');
      
      // Extract agentchainId using the provided pattern
      const agentIdMatch = embed.iframeScriptTag.match(/agentchainId=([^&"']+)/);
      agentId = agentIdMatch ? agentIdMatch[1] : undefined;
      
      if (agentId) {
        console.log('[loginAtenxionDispatcher] ✓ Extracted agentId (agentchainId):', agentId);
      } else {
        console.log('[loginAtenxionDispatcher] No agentchainId found in embed');
      }
    }
    resolvedToken = embed?.contextualKey;
  }

  // Prepare credentials with userId and extracted agentId
  const credentialsWithExtracted: AtenxionSenderCredentials = {
    agentId: agentId || credentials.agentId,
    userId: credentials.userId,
    role: userRole,
  };
  const requestBody = normalizeSenderCredentials(credentialsWithExtracted, true);

  // If we have resolvedToken (contextKey from MongoDB), use it as Authorization in body
  // The contextKey from MongoDB is the token we need to send
  if (resolvedToken) {
    requestBody.Authorization = resolvedToken; // Use contextKey directly as token
  }

  const headers = getHeaders(resolvedToken); // Headers only for Content-Type, Authorization goes in body

  console.log("Atenxion dispatcher login API call:", {
    url,  
    body: requestBody,
    headers,
    token: token ? token.substring(0, 20) + "..." : "none",
    hasContextKey: !!resolvedToken,
  });

  try {
    const pp = await axios.post(url, requestBody, { headers });
    console.log("Atenxion dispatcher login response:", pp);
    return true;
  } catch (error) {
    console.error("Atenxion dispatcher login failed:", error);
    if (axios.isAxiosError(error)) {
      console.error("Response status:", error.response?.status);
      console.error("Response data:", error.response?.data);
    }
    return handleAxiosError(error, "Unable to log in to Atenxion");
  }
}

