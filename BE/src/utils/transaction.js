const axios = require('axios');
const Integration = require('../models/Integration');

const SERVER_URL = process.env.ATENXION_API_URL || 'https://api-qa.brillar.ai';

/**
 * Extract agentId from iframe/script tag
 * @param {string} iframeScriptTag - The iframe or script tag string
 * @returns {string|undefined} - The extracted agentId or undefined
 */
function extractAgentId(iframeScriptTag) {
  if (!iframeScriptTag) return undefined;
  
  // Try to extract agentchainId pattern
  const agentIdMatch = iframeScriptTag.match(/agentchainId=([^&"']+)/);
  if (agentIdMatch) {
    return agentIdMatch[1];
  }
  
  return undefined;
}

/**
 * Get integration credentials from MongoDB
 * @param {string} role - Optional role filter (SENDER, DISPATCHER, COURIER)
 * @returns {Promise<{agentId: string, token: string}|null>} - Integration credentials or null
 */
async function getIntegrationCredentials(role = null) {
  try {
    const query = role ? { role } : {};
    const integration = await Integration.findOne(query).sort({ createdAt: -1 });
    
    if (!integration) {
      console.log(`[Transaction] No integration found for role: ${role || 'any'}`);
      return null;
    }
    
    const agentId = extractAgentId(integration.iframeScriptTag);
    const token = integration.contextualKey;
    
    if (!agentId || !token) {
      console.log('[Transaction] Missing agentId or token in integration');
      return null;
    }
    
    return { agentId, token };
  } catch (error) {
    console.error('[Transaction] Error fetching integration:', error);
    return null;
  }
}

/**
 * Create a transaction via Atenxion API
 * @param {string} userId - User ID performing the action
 * @param {object} transactionData - Transaction data to send
 * @param {string} role - Optional role to filter integration (SENDER, DISPATCHER, COURIER)
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function createTransaction(userId, transactionData, role = null) {
  try {
    // Get integration credentials
    const credentials = await getIntegrationCredentials(role);
    
    if (!credentials) {
      console.log('[Transaction] No credentials available, skipping transaction');
      return false;
    }
    
    const { agentId, token } = credentials;
    
    // Make API call to Atenxion
    const response = await axios.post(
      `${SERVER_URL}/api/post-login/new-transaction`,
      {
        userId: userId,
        agentId: agentId
      },
      {
        headers: { 
          Authorization: `${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('[Transaction] Transaction created successfully:', response.data);
    return true;
  } catch (error) {
    console.error('[Transaction] Transaction failed:', error.response?.data || error.message);
    // Don't throw - this is non-blocking
    return false;
  }
}

/**
 * Logout user via Atenxion API
 * @param {string} userId - User ID to logout
 * @param {string} agentId - Agent ID from integration
 * @param {string} token - Authorization token (contextualKey)
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function logoutUser(userId, agentId, token) {
  try {
    await axios.post(
      `${SERVER_URL}/api/post-login/user-logout`,
      {
        userId: userId,
        agentId: agentId
      },
      {
        headers: { 
          Authorization: `${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('[Logout] User logged out successfully');
    return true;
  } catch (error) {
    console.error('[Logout] Logout failed:', error.response?.data || error.message);
    // Don't throw - this is non-blocking
    return false;
  }
}

module.exports = {
  createTransaction,
  getIntegrationCredentials,
  extractAgentId,
  logoutUser
};

