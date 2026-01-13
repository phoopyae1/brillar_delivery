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
// Works for SENDER, DISPATCHER, COURIER, PUBLIC, and ADMIN roles
export async function fetchSenderIntegrationEmbed(role?: 'SENDER' | 'DISPATCHER' | 'COURIER' | 'PUBLIC' | 'ADMIN'): Promise<Integration | null> {
  try {
    const requestedRole = role || 'none';
    console.log(`[fetchSenderIntegrationEmbed] Fetching integrations for role: ${requestedRole}`);
    
    // Validate role if provided
    if (role && !['SENDER', 'DISPATCHER', 'COURIER', 'PUBLIC', 'ADMIN'].includes(role)) {
      console.warn(`[fetchSenderIntegrationEmbed] Invalid role provided: ${role}. Valid roles: SENDER, DISPATCHER, COURIER, PUBLIC, ADMIN`);
    }
    
    // Fetch integrations from MongoDB - pass role to backend for filtering
    // Backend uses separate collections: SenderIntegration, CourierIntegration, DispatcherIntegration, AdminIntegration
    const allIntegrations = await integrationApi.getAll(role);
    console.log('[fetchSenderIntegrationEmbed] Fetched integrations from MongoDB:', Array.isArray(allIntegrations) ? allIntegrations.length : 0);
    
    // Log details about what was fetched
    if (Array.isArray(allIntegrations) && allIntegrations.length > 0) {
      console.log('[fetchSenderIntegrationEmbed] First integration details:', {
        role: allIntegrations[0]?.role,
        hasContextualKey: !!allIntegrations[0]?.contextualKey,
        hasIframeScriptTag: !!allIntegrations[0]?.iframeScriptTag
      });
    }
    
    if (!Array.isArray(allIntegrations) || allIntegrations.length === 0) {
      console.warn(`[fetchSenderIntegrationEmbed] No integrations found for role: ${requestedRole}`);
      if (role === 'DISPATCHER') {
        console.warn('[fetchSenderIntegrationEmbed] 💡 DISPATCHER: Ensure an integration exists in DispatcherIntegration MongoDB collection');
      } else if (role === 'COURIER') {
        console.warn('[fetchSenderIntegrationEmbed] 💡 COURIER: Ensure an integration exists in CourierIntegration MongoDB collection');
      } else if (role === 'ADMIN') {
        console.warn('[fetchSenderIntegrationEmbed] 💡 ADMIN: Ensure an integration exists in AdminIntegration MongoDB collection');
      } else if (role === 'SENDER') {
        console.warn('[fetchSenderIntegrationEmbed] 💡 SENDER: Ensure an integration exists in SenderIntegration MongoDB collection');
      } else if (role === 'PUBLIC') {
        console.warn('[fetchSenderIntegrationEmbed] 💡 PUBLIC: Ensure an integration exists in PublicIntegration MongoDB collection');
      }
      return null;
    }
    
    // Additional client-side filtering to ensure role matching (in case backend doesn't filter)
    const filteredIntegrations = allIntegrations.filter((int: Integration) => {
      // If no role is set on integration, show it to everyone
      if (!int.role) {
        console.log('[fetchSenderIntegrationEmbed] Including integration (no role):', int.contextualKey);
        return true;
      }
      // If role is provided, show integrations matching that role (case-insensitive comparison)
      if (role) {
        const matches = int.role.toUpperCase() === role.toUpperCase();
        console.log(`[fetchSenderIntegrationEmbed] Integration ${int.contextualKey} (role: ${int.role}) matches requested role (${role}):`, matches);
        return matches;
      }
      // If no role provided, only show integrations with no role
      return false;
    });
    
    console.log(`[fetchSenderIntegrationEmbed] Filtered ${filteredIntegrations.length} integrations for role: ${requestedRole}`);
    
    if (filteredIntegrations.length === 0) {
      console.warn(`[fetchSenderIntegrationEmbed] No integrations match role: ${requestedRole}`);
      console.warn(`[fetchSenderIntegrationEmbed] Available integrations roles:`, allIntegrations.map((int: Integration) => int.role || 'none'));
      return null;
    }
    
    // Sort integrations by updatedAt (most recent first), then createdAt (most recent first)
    // Use _id as final tie-breaker to ensure deterministic sorting
    // This ensures we always get the latest integration consistently
    const sortedIntegrations = [...filteredIntegrations].sort((a: Integration, b: Integration) => {
      const aUpdated = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bUpdated = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      
      // Sort by updatedAt first (descending), then createdAt (descending)
      if (aUpdated !== bUpdated) {
        return bUpdated - aUpdated;
      }
      if (aCreated !== bCreated) {
        return bCreated - aCreated;
      }
      // Final tie-breaker: use _id or contextualKey for deterministic sorting
      const aId = a._id || a.contextualKey || '';
      const bId = b._id || b.contextualKey || '';
      return aId.localeCompare(bId);
    });
    
    console.log(`[fetchSenderIntegrationEmbed] Sorted integrations by date (most recent first):`, 
      sortedIntegrations.map((int: Integration) => ({
        contextualKey: int.contextualKey?.substring(0, 20),
        updatedAt: int.updatedAt,
        createdAt: int.createdAt,
        _id: int._id?.substring(0, 10)
      }))
    );
    
    // Find integration - prioritize ones with atenxion widget from sorted list
    // Since list is sorted deterministically, this will always pick the same one
    // If multiple match, pick the first (most recent) one consistently
    const embedWithWidget = sortedIntegrations.find((int: Integration) => 
      int.iframeScriptTag?.includes('atenxion') || 
      int.iframeScriptTag?.includes('widget')
    );
    
    const embed = embedWithWidget || sortedIntegrations[0] || null;
    
    if (embed) {
      console.log(`[fetchSenderIntegrationEmbed] ✓ Selected embed for ${requestedRole}:`, {
        contextualKey: embed.contextualKey ? embed.contextualKey.substring(0, 30) + '...' : 'none',
        role: embed.role || 'none',
        hasIframeScriptTag: !!embed.iframeScriptTag,
        contextualKeyLength: embed.contextualKey?.length || 0,
        updatedAt: embed.updatedAt,
        createdAt: embed.createdAt,
        _id: embed._id?.substring(0, 10),
        selectionReason: embedWithWidget ? 'matched widget keyword' : 'most recent (no widget match)',
        totalAvailable: sortedIntegrations.length
      });
    } else {
      console.warn('[fetchSenderIntegrationEmbed] ✗ No embed selected from filtered integrations');
    }
    
    return embed;
  } catch (error) {
    console.error(`[fetchSenderIntegrationEmbed] Error fetching integrations for role ${role || 'none'}:`, error);
    if (error instanceof Error) {
      console.error('[fetchSenderIntegrationEmbed] Error message:', error.message);
      console.error('[fetchSenderIntegrationEmbed] Error stack:', error.stack);
    }
    return null;
  }
}

function normalizeSenderCredentials(
  credentials: AtenxionSenderCredentials,
  authToken?: string | null // This is for integration API (contextualKey), not for Authorization header
): AtenxionRequestBody {
  const userId = credentials.userId ? String(credentials.userId).trim() : '';
  const agentId = credentials.agentId?.trim();
  
  // Always get Authorization token from sender_session in localStorage (our app's token)
  let resolvedAuthToken = "";
  
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem("sender_session");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        resolvedAuthToken = parsed?.token || "";
      } catch (e) {
        // If not JSON, use as-is (might be a plain string token)
        resolvedAuthToken = stored;
      }
    }
  }
  
  console.log('resolvedAuthToken (from sender_session):', resolvedAuthToken);
  
  const body: AtenxionRequestBody = {
    userId,
    senderId: userId,
    role: credentials.role,
    Authorization: `Bearer ${resolvedAuthToken}`, // Always use token from sender_session
  };
  
  if (agentId) {
    body.agentId = agentId;
  }
  

  return body;
}

// Normalize courier credentials (following the pattern from normalizeCredentials)
// Note: authToken parameter is for integration API calls, not for Authorization header
// Authorization header always uses token from courier_session in localStorage
function normalizeCourierCredentials(
  credentials: AtenxionSenderCredentials,
  authToken?: string | null // This is for integration API (contextualKey), not for Authorization header
): AtenxionRequestBody {
  const userId = credentials.userId ? String(credentials.userId).trim() : '';
  const agentId = credentials.agentId?.trim();
  
  // Always get Authorization token from courier_session in localStorage (our app's token)
  let resolvedAuthToken = "";
  
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem("courier_session");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        resolvedAuthToken = parsed?.token || "";
      } catch (e) {
        // If not JSON, use as-is (might be a plain string token)
        resolvedAuthToken = stored;
      }
    }
  }
  
  console.log('resolvedAuthToken (from courier_session):', resolvedAuthToken);
  
  const body: AtenxionRequestBody = {
    userId,
    senderId: userId,
    role: credentials.role,
    Authorization: `Bearer ${resolvedAuthToken}`, // Always use token from courier_session
  };
  
  if (agentId) {
    body.agentId = agentId;
  }
  
  return body;
}

// Normalize dispatcher credentials (following the pattern from normalizeCredentials)
// Note: authToken parameter is for integration API calls, not for Authorization header
// Authorization header always uses token from dispatcher_session in localStorage
function normalizeDispatcherCredentials(
  credentials: AtenxionSenderCredentials,
  authToken?: string | null // This is for integration API (contextualKey), not for Authorization header
): AtenxionRequestBody {
  const userId = credentials.userId ? String(credentials.userId).trim() : '';
  const agentId = credentials.agentId?.trim();
  
  // Always get Authorization token from dispatcher_session in localStorage (our app's token)
  let resolvedAuthToken = "";
  
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem("dispatcher_session");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        resolvedAuthToken = parsed?.token || "";
      } catch (e) {
        // If not JSON, use as-is (might be a plain string token)
        resolvedAuthToken = stored;
      }
    }
  }
  
  console.log('resolvedAuthToken (from dispatcher_session):', resolvedAuthToken);
  
  const body: AtenxionRequestBody = {
    userId,
    senderId: userId,
    role: credentials.role,
    Authorization: `Bearer ${resolvedAuthToken}`, // Always use token from dispatcher_session
  };
  
  if (agentId) {
    body.agentId = agentId;
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
console.log('token', token);
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
  
  // Normalize credentials and include Authorization in body
  // resolvedToken (contextKey from MongoDB) is used for integration API calls (getHeaders)
  // Authorization header in body uses token from sender_session localStorage (handled in normalizeSenderCredentials)
  const requestBody = normalizeSenderCredentials(credentialsWithExtracted, resolvedToken);

  const headers = getHeaders(resolvedToken); // Headers for integration API (contextualKey), Authorization goes in body

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
  const userRole = 'COURIER';
  
  if (!resolvedToken) {
    const embed = useAdminIntegration
      ? await fetchSenderIntegrationEmbed(userRole)
      : null;
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
      
      const agentIdMatch = embed.iframeScriptTag.match(/agentchainId=([^&"']+)/);
      agentId = agentIdMatch ? agentIdMatch[1] : undefined;
      
      if (agentId) {
        console.log('[loginAtenxionCourier] ✓ Extracted agentId (agentchainId):', agentId);
      } else {
        console.log('[loginAtenxionCourier] No agentchainId found in embed');
      }
    }
    if (!resolvedToken) {
      resolvedToken = embed?.contextualKey;
    }
  }

  const credentialsWithExtracted: AtenxionSenderCredentials = {
    agentId: agentId || credentials.agentId,
    userId: credentials.userId,
    role: userRole,
  };
  
  // Normalize credentials and include Authorization in body
  // resolvedToken (contextKey from MongoDB) is used for integration API calls (getHeaders)
  // Authorization header in body uses token from courier_session localStorage (handled in normalizeCourierCredentials)
  const requestBody = normalizeCourierCredentials(credentialsWithExtracted, resolvedToken);
  const headers = getHeaders(resolvedToken); // Headers for integration API (contextualKey), Authorization goes in body

  console.log("Atenxion courier login API call:", {
    url,  
    body: requestBody,
    headers,
    token: token ? token.substring(0, 20) + "..." : "none",
    hasContextKey: !!resolvedToken,
  });

  try {
    const response = await axios.post(url, requestBody, { headers });
    console.log("Atenxion courier login response:", response);
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
  const userRole = 'DISPATCHER';
  
  if (!resolvedToken) {
    const embed = useAdminIntegration
      ? await fetchSenderIntegrationEmbed(userRole)
      : null;
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
      
      const agentIdMatch = embed.iframeScriptTag.match(/agentchainId=([^&"']+)/);
      agentId = agentIdMatch ? agentIdMatch[1] : undefined;
      
      if (agentId) {
        console.log('[loginAtenxionDispatcher] ✓ Extracted agentId (agentchainId):', agentId);
      } else {
        console.log('[loginAtenxionDispatcher] No agentchainId found in embed');
      }
    }
    if (!resolvedToken) {
      resolvedToken = embed?.contextualKey;
    }
  }

  const credentialsWithExtracted: AtenxionSenderCredentials = {
    agentId: agentId || credentials.agentId,
    userId: credentials.userId,
    role: userRole,
  };
  
  // Normalize credentials and include Authorization in body
  // resolvedToken (contextKey from MongoDB) is used for integration API calls (getHeaders)
  // Authorization header in body uses token from dispatcher_session localStorage (handled in normalizeDispatcherCredentials)
  const requestBody = normalizeDispatcherCredentials(credentialsWithExtracted, resolvedToken);
  const headers = getHeaders(resolvedToken); // Headers for integration API (contextualKey), Authorization goes in body

  console.log("Atenxion dispatcher login API call:", {
    url,  
    body: requestBody,
    headers,
    token: token ? token.substring(0, 20) + "..." : "none",
    hasContextKey: !!resolvedToken,
  });

  try {
    const response = await axios.post(url, requestBody, { headers });
    console.log("Atenxion dispatcher login response:", response);
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

