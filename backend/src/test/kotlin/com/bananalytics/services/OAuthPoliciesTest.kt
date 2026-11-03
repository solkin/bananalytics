package com.bananalytics.services

import java.net.InetAddress
import kotlin.test.*

class OAuthPoliciesTest {
    @Test fun `metadata fetches never reach internal addresses`() {
        for (address in listOf("127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1",
            "0.0.0.0", "::1", "fe80::1", "fc00::1", "fd12:3456::1", "224.0.0.1")) {
            assertTrue(HttpClientMetadataSource.isInternal(InetAddress.getByName(address)), address)
        }
        for (address in listOf("8.8.8.8", "100.128.0.1", "172.32.0.1", "2001:4860:4860::8888")) {
            assertFalse(HttpClientMetadataSource.isInternal(InetAddress.getByName(address)), address)
        }
    }

    @Test fun `redirect URIs are https, loopback http or a private-use scheme`() {
        for (uri in listOf("https://claude.ai/api/mcp/auth_callback", "http://127.0.0.1:33418/callback",
            "http://localhost/callback", "http://[::1]:8080/cb", "cursor://anysphere.cursor-retrieval/oauth/callback",
            "com.example.app:/oauth")) {
            assertTrue(RedirectUris.isAllowed(uri), uri)
        }
        for (uri in listOf("http://example.com/cb", "javascript:alert(1)", "data:text/html,x", "file:///etc/passwd",
            "https://user@example.com/cb", "https://example.com/cb#x", "relative/path", "https:///nohost",
            "https://example.com/" + "a".repeat(2000))) {
            assertFalse(RedirectUris.isAllowed(uri), uri)
        }
    }

    @Test fun `only loopback redirects may change their port`() {
        assertTrue(RedirectUris.matches("http://127.0.0.1/callback", "http://127.0.0.1:51234/callback"))
        assertTrue(RedirectUris.matches("http://localhost:1/cb?x=1", "http://localhost:2/cb?x=1"))
        assertFalse(RedirectUris.matches("http://127.0.0.1/callback", "http://127.0.0.1:5/other"))
        assertFalse(RedirectUris.matches("http://127.0.0.1/callback", "http://localhost/callback"))
        assertFalse(RedirectUris.matches("https://claude.ai/cb", "https://claude.ai:444/cb"))
        assertFalse(RedirectUris.matches("https://claude.ai/cb", "https://claude.ai/cb/"))
    }

    @Test fun `metadata client IDs are https URLs with a path`() {
        assertNotNull(OAuthService.metadataUrl("https://claude.ai/oauth/claude-code-client-metadata"))
        for (id in listOf("https://claude.ai", "https://claude.ai/", "http://claude.ai/client.json",
            "https://user@claude.ai/c.json", "https://claude.ai/c.json#x", "https://claude.ai/a/../c.json", "https:// bad")) {
            assertNull(OAuthService.metadataUrl(id), id)
        }
    }

    @Test fun `PKCE uses the S256 transform from RFC 7636`() {
        assertEquals("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM", OAuthService.s256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"))
    }

    @Test fun `unknown scopes are ignored and write implies read`() {
        assertEquals(setOf("mcp:read"), OAuthService.requestedScopes(null))
        assertEquals(setOf("mcp:read"), OAuthService.requestedScopes("offline_access profile"))
        assertEquals(setOf("mcp:read", "mcp:write"), OAuthService.requestedScopes("mcp:write"))
    }
}
