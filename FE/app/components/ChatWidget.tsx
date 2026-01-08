'use client';
import { useEffect, useState } from 'react';
import { integrationApi, Integration } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { Box } from '@mui/material';

export default function ChatWidget() {
  const { user, ready } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  // Load integrations from MongoDB filtered by user role
  useEffect(() => {
    // Wait for auth to be ready before loading integrations
    if (!ready) {
      console.log('[ChatWidget] Auth not ready yet, waiting...');
      return;
    }

    const loadIntegrations = async () => {
      try {
        // Fetch integrations filtered by user role from MongoDB
        // If user is logged in, fetch only their role's integrations
        // If not logged in, fetch all (for PUBLIC integrations)
        const roleToFetch = user?.role || undefined;
        const allIntegrations = await integrationApi.getAll(roleToFetch);
        console.log('[ChatWidget] Fetched integrations from MongoDB:', allIntegrations.length);
        console.log('[ChatWidget] Fetched for role:', roleToFetch || 'all (not logged in)');
        console.log('[ChatWidget] Current user:', user ? `Logged in as ${user.role}` : 'Not logged in');
        
        // Filter integrations based on user role
        // STRICT RULE: When logged in, ONLY show integrations that match the user's exact role
        const filteredIntegrations = allIntegrations.filter((integration: Integration) => {
          // If user is logged in, apply strict filtering
          if (user?.role) {
            const integrationRole = String(integration.role || '').trim();
            const userRole = String(user.role || '').trim();
            
            // Exclude PUBLIC integrations for logged-in users
            if (integrationRole === 'PUBLIC') {
              console.log(`[ChatWidget] ✗ Excluding PUBLIC integration ${integration.contextualKey} - user is logged in as ${userRole}`);
              return false;
            }
            
            // Exclude integrations with no role for logged-in users
            if (!integration.role || integration.role === null || integrationRole === '') {
              console.log(`[ChatWidget] ✗ Excluding integration ${integration.contextualKey} (no role) - user is logged in as ${userRole}`);
              return false;
            }
            
            // For ADMIN users: allow ADMIN integrations
            if (userRole === 'ADMIN' && integrationRole === 'ADMIN') {
              console.log(`[ChatWidget] ✓ Including ADMIN integration ${integration.contextualKey} - user is ADMIN`);
              return true;
            }
            
            // For all users: ONLY allow exact role match (SENDER, COURIER, DISPATCHER)
            const exactMatch = integrationRole === userRole;
            if (exactMatch) {
              console.log(`[ChatWidget] ✓ Including ${integrationRole} integration ${integration.contextualKey} - matches user role ${userRole}`);
            } else {
              console.log(`[ChatWidget] ✗ Excluding ${integration.contextualKey} (role: "${integrationRole}") - does not match user role "${userRole}"`);
            }
            return exactMatch;
          }
          
          // If user is NOT logged in, show PUBLIC integrations and integrations with no role
          if (integration.role === 'PUBLIC') {
            console.log('[ChatWidget] Including integration (PUBLIC) - user not logged in:', integration.contextualKey);
            return true;
          }
          
          // If no role is set, show it to non-logged-in users
          if (!integration.role) {
            console.log('[ChatWidget] Including integration (no role) - user not logged in:', integration.contextualKey);
            return true;
          }
          
          // If user is not logged in, don't show role-specific integrations
          console.log(`[ChatWidget] Excluding integration ${integration.contextualKey} (role: ${integration.role}) - user not logged in`);
          return false;
        });
        
        // For logged-in users: Only keep integrations that exactly match their role
        // For non-logged-in users: Keep PUBLIC and no-role integrations
        let finalIntegrations = filteredIntegrations;
        
        if (user?.role) {
          const userRole = String(user.role).trim();
          console.log(`[ChatWidget] Final filtering for logged-in user (${userRole}):`);
          
          finalIntegrations = filteredIntegrations.filter((integration: Integration) => {
            const integrationRole = String(integration.role || '').trim();
            
            // For ADMIN users: allow ADMIN integrations
            if (userRole === 'ADMIN' && integrationRole === 'ADMIN') {
              console.log(`[ChatWidget] ✓ Including ADMIN integration: ${integration.contextualKey}`);
              return true;
            }
            
            // For all users: only allow exact role match
            if (integrationRole === userRole) {
              console.log(`[ChatWidget] ✓ Including ${integrationRole} integration: ${integration.contextualKey} (matches user role ${userRole})`);
              return true;
            }
            
            // Exclude everything else
            console.log(`[ChatWidget] ✗ Excluding ${integration.contextualKey} (role: "${integrationRole}") - does not match user role "${userRole}"`);
            return false;
          });
        }
        
        console.log('[ChatWidget] Final filtered integrations:', finalIntegrations.length);
        console.log('[ChatWidget] Integration roles:', finalIntegrations.map(i => `${i.contextualKey} (${i.role || 'no role'})`));
        setIntegrations(finalIntegrations || []);
      } catch (error) {
        console.error('[ChatWidget] Error loading integrations:', error);
      }
    };

    loadIntegrations();
  }, [user?.role, user, ready]);

  // Process and inject integrations (scripts and iframes)
  useEffect(() => {
    if (!integrations || integrations.length === 0) {
      return;
    }

    integrations.forEach((integration: Integration) => {
      if (!integration.iframeScriptTag) return;

      const embedCode = integration.iframeScriptTag.trim();
      const integrationId = integration._id || integration.contextualKey;

      // Handle script tags
      if (embedCode.startsWith('<script')) {
        const scriptId = `chat-widget-script-${integrationId}`;
        
        // Remove existing script if present
        const existingScript = document.getElementById(scriptId);
        if (existingScript) {
          existingScript.remove();
        }

        // Extract src from script tag
        const scriptTagMatch = embedCode.match(/<script[^>]+src=["']([^"']+)["']/i);
        
        if (scriptTagMatch) {
          // Extract the script src URL
          let scriptSrc = scriptTagMatch[1];
          
          // Add userId parameter if user is logged in
          if (user?.id) {
            try {
              const url = new URL(scriptSrc, window.location.origin);
              url.searchParams.set("userId", String(user.id));
              scriptSrc = url.toString();
            } catch {
              const separator = scriptSrc.includes("?") ? "&" : "?";
              scriptSrc = `${scriptSrc}${separator}userId=${String(user.id)}`;
            }
          }

          // Create new script element with updated src
          const script = document.createElement('script');
          script.id = scriptId;
          script.src = scriptSrc;
          document.head.appendChild(script);
        } else {
          // Inline script content
          const contentMatch = embedCode.match(/>(.*?)<\/script>/s);
          if (contentMatch) {
            const script = document.createElement('script');
            script.id = scriptId;
            script.textContent = contentMatch[1];
            document.head.appendChild(script);
          }
        }
      }
      // Handle iframe tags - we'll render these in the component
    });

    // Cleanup function
    return () => {
      integrations.forEach((integration: Integration) => {
        if (integration.iframeScriptTag?.trim().startsWith('<script')) {
          const scriptId = `chat-widget-script-${integration._id || integration.contextualKey}`;
          const script = document.getElementById(scriptId);
          if (script) {
            script.remove();
          }
        }
      });
    };
  }, [integrations, user?.id]);

  // Process iframe integrations and inject userId if user is logged in
  const [processedIframes, setProcessedIframes] = useState<Array<{
    integration: Integration;
    src: string;
    title: string;
    allow?: string | null;
    loading?: string | null;
  }>>([]);

  useEffect(() => {
    if (!integrations || integrations.length === 0) {
      setProcessedIframes([]);
      return;
    }

    const processed = integrations
      .filter((integration: Integration) => {
        return integration.iframeScriptTag?.trim().startsWith('<iframe');
      })
      .map((integration: Integration) => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = integration.iframeScriptTag;
        const iframe = wrapper.querySelector('iframe');

        if (!iframe) return null;

        const srcAttr = iframe.getAttribute('src');
        if (!srcAttr) return null;

        let sanitizedSrc = srcAttr.trim();
        
        // Inject userId into iframe URL if user is logged in
        if (user?.id) {
          try {
            const url = new URL(sanitizedSrc, window.location.origin);
            url.searchParams.set('userId', String(user.id));
            sanitizedSrc = url.toString();
          } catch {
            if (!sanitizedSrc.includes('userId=')) {
              const separator = sanitizedSrc.includes('?') ? '&' : '?';
              sanitizedSrc = `${sanitizedSrc}${separator}userId=${String(user.id)}`;
            }
          }
        } else {
          // Remove userId if user is not logged in
          try {
            const url = new URL(sanitizedSrc, window.location.origin);
            url.searchParams.delete('userId');
            sanitizedSrc = url.toString();
          } catch {
            // If URL parsing fails, leave as is
          }
        }

        return {
          integration,
          src: sanitizedSrc,
          title: iframe.getAttribute('title') || integration.name || integration.contextualKey || 'Chat Widget',
          allow: iframe.getAttribute('allow'),
          loading: iframe.getAttribute('loading'),
        };
      })
      .filter((item) => item !== null) as Array<{
        integration: Integration;
        src: string;
        title: string;
        allow?: string | null;
        loading?: string | null;
      }>;

    setProcessedIframes(processed);
  }, [integrations, user?.id]);

  // Don't render anything if no iframes found
  if (processedIframes.length === 0) {
    return null;
  }

  return (
    <>
      {processedIframes.map((iframeData, index: number) => (
        <Box
          key={iframeData.integration._id || iframeData.integration.contextualKey || index}
          component="div"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 9999,
            width: '400px',
            height: '600px',
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100vh - 32px)',
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            '@media (max-width: 600px)': {
              width: 'calc(100vw - 32px)',
              height: 'calc(100vh - 32px)',
              bottom: 16,
              right: 16,
            },
          }}
        >
          <iframe
            src={iframeData.src}
            title={iframeData.title}
            allow={iframeData.allow || undefined}
            loading={(iframeData.loading === 'lazy' || iframeData.loading === 'eager') ? iframeData.loading : 'lazy'}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
            }}
          />
        </Box>
      ))}
    </>
  );
}

